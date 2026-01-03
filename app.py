import os, time, json, hashlib
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory
import stripe

import firebase_admin
from firebase_admin import credentials, auth, firestore

# Import Secret Manager for secure credential management
try:
    from google.cloud import secretmanager
    SECRET_MANAGER_AVAILABLE = True
except ImportError:
    SECRET_MANAGER_AVAILABLE = False
    print("⚠️  Secret Manager not available - using local credentials only")

APP_DIR = os.path.dirname(os.path.abspath(__file__))

# -------------------------
# Secure Config with Secret Manager
# -------------------------
def get_secret(secret_id, project_id="goodbodybucks"):
    """Retrieve secret from Google Secret Manager"""
    if not SECRET_MANAGER_AVAILABLE:
        return None
    
    try:
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8")
    except Exception as e:
        print(f"⚠️  Error fetching secret '{secret_id}': {e}")
        return None

def get_firebase_credentials():
    """
    Get Firebase credentials securely:
    1. Try environment variable (for Secret Manager)
    2. Try Secret Manager directly (Cloud Run)
    3. Fall back to local file (development)
    """
    # Option 1: Environment variable (from Cloud Run secret mount)
    env_creds = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if env_creds:
        print("🔐 Using Firebase credentials from environment variable")
        return credentials.Certificate(json.loads(env_creds))
    
    # Option 2: Secret Manager (Cloud Run)
    if SECRET_MANAGER_AVAILABLE:
        secret_data = get_secret("goodbodybucks-service-account")
        if secret_data:
            print("🔐 Using Firebase credentials from Secret Manager")
            return credentials.Certificate(json.loads(secret_data))
    
    # Option 3: Local file (development)
    local_key_path = os.path.join(APP_DIR, "serviceAccountKey.json")
    if os.path.exists(local_key_path):
        print("🔑 Using local Firebase credentials (development mode)")
        return credentials.Certificate(local_key_path)
    
    raise Exception("❌ No Firebase credentials found! Check Secret Manager or local serviceAccountKey.json")

FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID")  # optional
PORT = int(os.environ.get("PORT", "5000"))

# If using emulator locally (optional):
# set FIRESTORE_EMULATOR_HOST=localhost:8080
# set FIREBASE_AUTH_EMULATOR_HOST=localhost:9099   (NOTE: firebase-admin token verify doesn't use this)
# For easiest start: do NOT use emulators; use real Firebase project.

# -------------------------
# App
# -------------------------
app = Flask(__name__, static_folder='public', static_url_path='')
app.config["JSON_SORT_KEYS"] = False

# Enable CORS for all routes (needed for localhost/127.0.0.1 cross-origin and production)
@app.before_request
def handle_preflight():
    """Handle CORS preflight requests"""
    if request.method == "OPTIONS":
        origin = request.headers.get('Origin')
        allowed_origins = [
            'http://localhost:5000',
            'http://127.0.0.1:5000',
            'https://goodbodybucks.web.app',
            'https://goodbodybucks.firebaseapp.com'
        ]
        
        response = app.make_default_options_response()
        
        if origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
        else:
            response.headers['Access-Control-Allow-Origin'] = '*'
            
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Family-Id'
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Max-Age'] = '3600'
        
        return response

@app.after_request
def after_request(response):
    """Add CORS headers to all responses"""
    origin = request.headers.get('Origin')
    allowed_origins = [
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        'https://goodbodybucks.web.app',
        'https://goodbodybucks.firebaseapp.com'
    ]
    
    if origin in allowed_origins:
        response.headers['Access-Control-Allow-Origin'] = origin
    else:
        response.headers['Access-Control-Allow-Origin'] = '*'
        
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Family-Id'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    
    return response

# -------------------------
# Defaults (stored per family in Firestore)
# -------------------------
DEFAULT_REWARDS = [
    {"id":"math_correct","label":"Math: Correct problem","delta_gb":0.25},
    {"id":"math_3row","label":"Math: 3 correct in a row","delta_gb":0.50},
    {"id":"math_hard","label":"Math: Hard problem","delta_gb":1.00},
    {"id":"lit_read1","label":"Reading: 1 page aloud","delta_gb":0.25},
    {"id":"lit_read5","label":"Reading: 5 pages","delta_gb":1.00},
    {"id":"spell_word","label":"Spelling: 1 word correct","delta_gb":0.25},
    {"id":"write_sentence","label":"Writing: 1 sentence","delta_gb":0.50},
]

DEFAULT_SCREEN_PACKAGES = [
    {"id":"tab10","label":"Tablet 10 min","cost_gb":0.50,"minutes":10,"image_url":"/images/tablet_time/tab10.jpg"},
    {"id":"tab20","label":"Tablet 20 min","cost_gb":1.00,"minutes":20,"image_url":"/images/tablet_time/tab20.jpg"},
    {"id":"tab30","label":"Tablet 30 min","cost_gb":1.50,"minutes":30,"image_url":"/images/tablet_time/tab30.jpg"},
    {"id":"tab45","label":"Tablet 45 min","cost_gb":2.25,"minutes":45,"image_url":"/images/tablet_time/tab45.jpg"},
    {"id":"tab60","label":"Tablet 60 min","cost_gb":3.00,"minutes":60,"image_url":"/images/tablet_time/tab60.jpg"},
    {"id":"game15","label":"Game 15 min","cost_gb":0.75,"minutes":15,"image_url":"/images/tablet_time/game15.jpg"},
    {"id":"game30","label":"Game 30 min","cost_gb":1.50,"minutes":30,"image_url":"/images/tablet_time/game30.jpg"},
    {"id":"game45","label":"Game 45 min","cost_gb":2.25,"minutes":45,"image_url":"/images/tablet_time/game45.jpg"},
    {"id":"game60","label":"Game 60 min","cost_gb":3.00,"minutes":60,"image_url":"/images/tablet_time/game60.jpg"},
]

DEFAULT_FOOD_MENU = [
    {"id":"b_eggs","category":"Breakfast","label":"Eggs","cost_gb":2.00,"image_url":"/images/food/b_eggs.jpg"},
    {"id":"b_bacon","category":"Breakfast","label":"Bacon","cost_gb":3.00,"image_url":"/images/food/b_bacon.jpg"},
    {"id":"b_sausage","category":"Breakfast","label":"Sausage","cost_gb":3.00,"image_url":"/images/food/b_sausage.jpg"},
    {"id":"b_waffles","category":"Breakfast","label":"Waffles","cost_gb":4.00,"image_url":"/images/food/b_waffles.jpg"},
    {"id":"b_chobani_flip","category":"Breakfast","label":"Chobani Flip Yogurt","cost_gb":2.50,"image_url":"/images/food/b_chobani_flip.jpg"},

    {"id":"l_poor_sandwich","category":"Lunch","label":"Poor Man's Sandwich","cost_gb":5.00,"image_url":"/images/food/l_poor_sandwich.jpg"},
    {"id":"l_combo","category":"Lunch","label":"Nuggets + Fries","cost_gb":6.00,"image_url":"/images/food/l_combo.jpg"},
    {"id":"l_coke","category":"Lunch","label":"Coke (Can)","cost_gb":1.00,"image_url":"/images/food/l_coke.jpg"},

    {"id":"d_spaghetti","category":"Dinner","label":"Spaghetti","cost_gb":7.00,"image_url":"/images/food/d_spaghetti.jpg"},
    {"id":"d_tacos2","category":"Dinner","label":"Tacos (2)","cost_gb":6.00,"image_url":"/images/food/d_tacos2.jpg"},
    {"id":"d_dessert","category":"Dinner","label":"Dessert","cost_gb":2.50,"image_url":"/images/food/d_dessert.jpg"},
]

DEFAULT_TIME_CONSEQUENCES = [
    {"id":"minus5","label":"⏱️ -5 minutes","delta_minutes":-5,"image_url":"/images/consequences/minus5.jpg"},
    {"id":"minus10","label":"⏱️ -10 minutes","delta_minutes":-10,"image_url":"/images/consequences/minus10.jpg"},
    {"id":"minus15","label":"⏱️ -15 minutes","delta_minutes":-15,"image_url":"/images/consequences/minus15.jpg"},
    {"id":"minus30","label":"⏱️ -30 minutes","delta_minutes":-30,"image_url":"/images/consequences/minus30.jpg"},
    {"id":"end_session","label":"⛔ End session now","set_minutes":0,"image_url":"/images/consequences/end_session.jpg"},
    {"id":"lock_day","label":"🔒 Lock screens","lock":True,"image_url":"/images/consequences/lock_day.jpg"},
    {"id":"unlock","label":"🔓 Unlock screens","lock":False,"image_url":"/images/consequences/unlock.jpg"},
]

DEFAULT_MONEY_CONSEQUENCES = [
    {"id":"deduct25","label":"💸 -$0.25","delta_gb":-0.25,"image_url":"/images/consequences/deduct25.jpg"},
    {"id":"deduct50","label":"💸 -$0.50","delta_gb":-0.50,"image_url":"/images/consequences/deduct50.jpg"},
    {"id":"deduct100","label":"💸 -$1.00","delta_gb":-1.00,"image_url":"/images/consequences/deduct100.jpg"},
    {"id":"deduct200","label":"💸 -$2.00","delta_gb":-2.00,"image_url":"/images/consequences/deduct200.jpg"},
    {"id":"deduct500","label":"💸 -$5.00","delta_gb":-5.00,"image_url":"/images/consequences/deduct500.jpg"},
]

DEFAULT_SAVINGS_SETTINGS = {
    "enabled": False,
    "defaultPercentage": 0,
    "perKidSettings": {}  # kid_uid -> {"percentage": 10, "enabled": True}
}

def now_ts() -> int:
    return int(time.time())

def clamp_money(x) -> float:
    return round(float(x), 2)

def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def compute_ledger_hash(ts, actor_uid, target_uid, typ, payload_json, prev_hash):
    s = f"{ts}|{actor_uid}|{target_uid}|{typ}|{payload_json}|{prev_hash}"
    return sha256(s)

# -------------------------
# Firebase init
# -------------------------
# Initialize Firebase Admin SDK with secure credentials
try:
    cred = get_firebase_credentials()
    firebase_admin.initialize_app(cred, {"projectId": FIREBASE_PROJECT_ID} if FIREBASE_PROJECT_ID else None)
    db = firestore.client()
    print("✅ Firebase Admin SDK initialized successfully")
except Exception as e:
    print(f"❌ Failed to initialize Firebase: {e}")
    raise

# -------------------------
# Firestore helpers
# -------------------------
def fam_ref(family_id: str):
    return db.collection("families").document(family_id)

def member_ref(family_id: str, uid: str):
    return fam_ref(family_id).collection("members").document(uid)

def wallet_ref(family_id: str, uid: str):
    return fam_ref(family_id).collection("wallets").document(uid)

def session_ref(family_id: str, uid: str):
    return fam_ref(family_id).collection("sessions").document(uid)

def purchases_col(family_id: str):
    return fam_ref(family_id).collection("purchases")

def ledger_col(family_id: str):
    return fam_ref(family_id).collection("ledger")

def get_family_config(family_id: str) -> dict:
    snap = fam_ref(family_id).get()
    if not snap.exists:
        return None
    data = snap.to_dict()
    return data.get("config")

def is_admin(family_id: str, uid: str) -> bool:
    snap = member_ref(family_id, uid).get()
    if not snap.exists:
        return False
    return snap.to_dict().get("role") == "admin"

def get_role(family_id: str, uid: str) -> str:
    snap = member_ref(family_id, uid).get()
    if not snap.exists:
        return None
    return snap.to_dict().get("role")

def ledger_add(family_id: str, actor_uid: str, target_uid: str, typ: str, payload: dict):
    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    # find last hash
    last = ledger_col(family_id).order_by("ts", direction=firestore.Query.DESCENDING).limit(1).get()
    prev_hash = last[0].to_dict().get("hash") if last else "0"*64
    ts = now_ts()
    h = compute_ledger_hash(ts, actor_uid or "", target_uid or "", typ, payload_json, prev_hash)

    ledger_col(family_id).add({
        "ts": ts,
        "actorUid": actor_uid or "",
        "targetUid": target_uid or "",
        "type": typ,
        "payload": payload,
        "payloadJson": payload_json,
        "prevHash": prev_hash,
        "hash": h
    })

# -------------------------
# Auth middleware (Firebase ID token)
# -------------------------
def auth_required(roles=None, allow_bootstrap=False):
    roles = roles or ["admin", "kid"]
    def deco(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            authz = request.headers.get("Authorization", "")
            if not authz.startswith("Bearer "):
                return jsonify({"ok": False, "error": "Missing Bearer token"}), 401
            token = authz.replace("Bearer ", "").strip()
            try:
                decoded = auth.verify_id_token(token)
            except Exception:
                return jsonify({"ok": False, "error": "Invalid/expired token"}), 401

            # Client must send X-Family-Id header (simple + explicit)
            family_id = request.headers.get("X-Family-Id", "").strip()
            if not family_id:
                return jsonify({"ok": False, "error": "Missing X-Family-Id header"}), 400

            uid = decoded.get("uid")
            role = get_role(family_id, uid)
            
            # If allow_bootstrap and no role exists, allow through (bootstrap endpoint will handle)
            if allow_bootstrap and role is None:
                request.user = {
                    "uid": uid,
                    "role": None,
                    "family_id": family_id,
                    "name": decoded.get("name") or decoded.get("email") or uid,
                    "email": decoded.get("email") or ""
                }
                return fn(*args, **kwargs)
            
            if role not in roles:
                return jsonify({"ok": False, "error": "Forbidden"}), 403

            request.user = {
                "uid": uid,
                "role": role,
                "family_id": family_id,
                "name": decoded.get("name") or decoded.get("email") or uid,
                "email": decoded.get("email") or ""
            }
            return fn(*args, **kwargs)
        return wrapper
    return deco

# -------------------------
# Static: serve landing page, app, and images
# -------------------------
@app.get("/")
def landing():
    # Serve landing page at root
    return send_from_directory(APP_DIR, "landing.html")

@app.get("/app")
def index():
    # Serve main app at /app
    return send_from_directory(APP_DIR, "index.html")

@app.get("/landing")
def landing_alias():
    # Alternative route to landing page
    return send_from_directory(APP_DIR, "landing.html")

@app.get("/test-nav")
def test_navigation():
    # Navigation test page
    return send_from_directory(APP_DIR, "test_navigation.html")

@app.get("/index.html")
def index_html():
    # Direct access to index.html redirects to /app
    from flask import redirect
    return redirect("/app", code=302)

# -------------------------
# Email Capture Endpoint (Landing Page Newsletter)
# -------------------------
@app.post("/api/capture-email")
def capture_email():
    """Capture email addresses from landing page for newsletter/interest list"""
    try:
        data = request.get_json()
        if not data or 'email' not in data:
            return jsonify({"ok": False, "error": "Email is required"}), 400
        
        email = data['email'].strip().lower()
        
        # Basic email validation
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return jsonify({"ok": False, "error": "Invalid email format"}), 400
        
        # Check if email already exists
        existing = db.collection('email_captures').where('email', '==', email).limit(1).get()
        if len(list(existing)) > 0:
            return jsonify({"ok": True, "message": "Email already registered"}), 200
        
        # Save to Firestore
        capture_data = {
            "email": email,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "source": data.get('source', 'landing_page'),
            "userAgent": request.headers.get('User-Agent', ''),
            "ipAddress": request.headers.get('X-Forwarded-For', request.remote_addr)
        }
        
        db.collection('email_captures').add(capture_data)
        
        return jsonify({
            "ok": True,
            "message": "Thank you! We'll keep you updated."
        }), 201
        
    except Exception as e:
        print(f"[ERROR] Email capture failed: {e}")
        return jsonify({"ok": False, "error": "Failed to save email"}), 500

# -------------------------
# Stripe Configuration & Digital Products
# -------------------------

# Initialize Stripe (use environment variable or Secret Manager)
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY') or get_secret('stripe-secret-key')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET') or get_secret('stripe-webhook-secret')

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY
    print("✅ Stripe initialized")
else:
    print("⚠️  WARNING: Stripe not configured - digital products disabled")

# Product configurations
PRODUCTS = {
    'standard_pdf': {
        'name': 'GoodbodyBucks Starter Kit',
        'description': 'Ready-to-print GB$ system with all essential materials',
        'price': 1999,  # $19.99 in cents
        'currency': 'usd',
        'pdf_file': 'gb_starter_kit.pdf'
    },
    'custom_pdf': {
        'name': 'GoodbodyBucks Custom Kit',
        'description': 'Personalized GB$ system tailored to your family',
        'price': 3999,  # $39.99 in cents
        'currency': 'usd',
        'requires_customization': True
    }
}

@app.post("/api/create-checkout-session")
def create_checkout_session():
    """Create Stripe Checkout session for digital product purchase"""
    try:
        if not STRIPE_SECRET_KEY:
            return jsonify({"ok": False, "error": "Payment system not configured"}), 503
        
        data = request.get_json()
        product_id = data.get('productId')
        customization = data.get('customization')
        
        if product_id not in PRODUCTS:
            return jsonify({"ok": False, "error": "Invalid product"}), 400
        
        product = PRODUCTS[product_id]
        
        # Get domain from request
        domain = request.headers.get('Origin') or 'http://localhost:5000'
        
        # Create checkout session
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': product['currency'],
                    'unit_amount': product['price'],
                    'product_data': {
                        'name': product['name'],
                        'description': product['description'],
                    },
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{domain}/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{domain}/#digital-products",
            customer_email=customization.get('email') if customization else None,
            metadata={
                'product_id': product_id,
                'customization': json.dumps(customization) if customization else None
            }
        )
        
        print(f"[INFO] Created checkout session: {session.id} for product: {product_id}")
        
        return jsonify({
            "ok": True,
            "checkoutUrl": session.url,
            "sessionId": session.id
        }), 200
        
    except stripe.error.StripeError as e:
        print(f"[ERROR] Stripe error: {e}")
        return jsonify({"ok": False, "error": "Payment system error"}), 500
    except Exception as e:
        print(f"[ERROR] Checkout session creation failed: {e}")
        return jsonify({"ok": False, "error": "Failed to create checkout"}), 500

@app.post("/api/stripe-webhook")
def stripe_webhook():
    """Handle Stripe webhook events (payment completion, etc.)"""
    try:
        if not STRIPE_WEBHOOK_SECRET:
            print("⚠️  WARNING: Webhook secret not configured")
            return jsonify({"ok": False}), 400
        
        payload = request.data
        sig_header = request.headers.get('Stripe-Signature')
        
        # Verify webhook signature
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET
            )
        except ValueError:
            return jsonify({"ok": False, "error": "Invalid payload"}), 400
        except stripe.error.SignatureVerificationError:
            return jsonify({"ok": False, "error": "Invalid signature"}), 400
        
        # Handle the event
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            handle_successful_payment(session)
        
        return jsonify({"ok": True}), 200
        
    except Exception as e:
        print(f"[ERROR] Webhook handling failed: {e}")
        return jsonify({"ok": False}), 500

def handle_successful_payment(session):
    """Process successful payment and create order"""
    try:
        product_id = session['metadata'].get('product_id')
        customization_json = session['metadata'].get('customization')
        customization = json.loads(customization_json) if customization_json else None
        
        # Create order in Firestore
        order_data = {
            'orderId': session['id'],
            'productId': product_id,
            'productName': PRODUCTS[product_id]['name'],
            'price': PRODUCTS[product_id]['price'] / 100,  # Convert cents to dollars
            'currency': PRODUCTS[product_id]['currency'],
            'status': 'completed',
            'customerEmail': session['customer_email'] or (customization.get('email') if customization else None),
            'customername': customization.get('familyName') if customization else None,
            'stripeSessionId': session['id'],
            'stripePaymentIntentId': session.get('payment_intent'),
            'customization': customization,
            'createdAt': firestore.SERVER_TIMESTAMP,
            'downloadCount': 0
        }
        
        # Save order to Firestore
        order_ref = db.collection('orders').document(session['id'])
        order_ref.set(order_data)
        
        print(f"[INFO] Order created: {session['id']} for product: {product_id}")
        
        # TODO: Generate/retrieve PDF and send email with download link
        # This will be implemented in the next phase
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to handle successful payment: {e}")
        return False

@app.get("/success")
def payment_success():
    # Payment success page
    return send_from_directory(APP_DIR, "success.html")

@app.get("/landing.html")
def landing_html():
    # Direct access to landing.html redirects to /
    from flask import redirect
    return redirect("/", code=302)

@app.route("/test-image", methods=["GET"])
def test_image():
    """Test endpoint to verify image serving works"""
    images_dir = os.path.join(APP_DIR, "public", "images")
    test_file = os.path.join(images_dir, "gbucks-coin.png")
    if os.path.exists(test_file):
        return jsonify({"ok": True, "message": "Image file exists", "path": test_file, "version": "2026-01-02-v2"})
    else:
        return jsonify({"ok": False, "error": "Image file not found", "path": test_file}), 404

@app.route("/nav.css", methods=["GET"])
def serve_nav_css():
    """Serve navigation CSS component"""
    return send_from_directory(os.path.join(APP_DIR, "public"), "nav.css")

@app.route("/nav.js", methods=["GET"])
def serve_nav_js():
    """Serve navigation JavaScript component"""
    return send_from_directory(os.path.join(APP_DIR, "public"), "nav.js")

@app.route("/images/<path:filename>", methods=["GET"])
def serve_image(filename):
    """Serve images from public/images directory"""
    images_dir = os.path.join(APP_DIR, "public", "images")
    try:
        # Log for debugging
        full_path = os.path.join(images_dir, filename)
        print(f"[IMAGE] Request: {filename}", flush=True)
        print(f"[IMAGE] Full path: {full_path}", flush=True)
        print(f"[IMAGE] Exists: {os.path.exists(full_path)}", flush=True)
        app.logger.info(f"[IMAGE] Request: {filename}")
        app.logger.info(f"[IMAGE] Full path: {full_path}")
        app.logger.info(f"[IMAGE] Exists: {os.path.exists(full_path)}")
        
        if not os.path.exists(full_path):
            print(f"[IMAGE] NOT FOUND: {full_path}", flush=True)
            app.logger.warning(f"[IMAGE] NOT FOUND: {full_path}")
            # List available files for debugging
            if os.path.exists(images_dir):
                available = []
                for root, dirs, files in os.walk(images_dir):
                    for f in files:
                        rel_path = os.path.relpath(os.path.join(root, f), images_dir)
                        available.append(rel_path.replace('\\', '/'))
                print(f"[IMAGE] Available files: {available[:10]}", flush=True)
                app.logger.info(f"[IMAGE] Available files: {available[:10]}")
            from flask import abort
            abort(404)
        
        print(f"[IMAGE] OK Serving: {filename}", flush=True)
        app.logger.info(f"[IMAGE] OK Serving: {filename}")
        return send_from_directory(images_dir, filename)
    except Exception as e:
        print(f"[IMAGE] Error serving {filename}: {e}", flush=True)
        app.logger.error(f"[IMAGE] Error serving {filename}: {e}")
        import traceback
        traceback.print_exc()
        from flask import abort
        abort(404)

# -------------------------
# Setup (creates family + config; users should be created in Firebase Auth from frontend/admin flow later)
# For now: setup only creates Firestore family/config. Membership docs must already exist or be created by admin endpoint later.
# -------------------------
@app.post("/api/setup_family")
def api_setup_family():
    """
    Minimal Firestore-only setup.
    Body:
    { "family_name":"Goodbody" }

    Returns:
    { ok:true, family_id:"<autoid>" }
    """
    data = request.get_json(force=True)
    name = (data.get("family_name") or "").strip()
    if not name:
        return jsonify({"ok": False, "error": "family_name required"}), 400

    cfg = {
        "rewards": DEFAULT_REWARDS,
        "screen": DEFAULT_SCREEN_PACKAGES,
        "food": DEFAULT_FOOD_MENU,
        "time_consequences": DEFAULT_TIME_CONSEQUENCES,
        "money_consequences": DEFAULT_MONEY_CONSEQUENCES,
        "savings": DEFAULT_SAVINGS_SETTINGS,
    }

    try:
        doc = db.collection("families").document()
        family_id = doc.id
        doc.set({
            "name": name,
            "createdTs": now_ts(),
            "config": cfg
        })

        # Genesis ledger
        ledger_add(family_id, "", "", "GENESIS", {"note": "GENESIS"})

        return jsonify({"ok": True, "family_id": family_id})
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback.print_exc()
        return jsonify({"ok": False, "error": f"Failed to create family: {error_msg}"}), 500

# -------------------------
# Bootstrap: Auto-register first-time users
# -------------------------
@app.post("/api/bootstrap")
@auth_required(allow_bootstrap=True)
def api_bootstrap():
    """
    Safe bootstrap endpoint for first-time user registration.
    Body (optional):
    { "name": "Miles", "role": "kid" }  # for kid registration
    { "name": "Parent", "role": "admin" }  # for admin registration
    
    Rules:
    - If family has no members → first user becomes admin
    - If caller is kid (email matches {kidSlug}.{familyId}@gbucks.local) → auto-register as kid
    - If caller is admin and family has members → allow admin registration (for additional admins)
    - Never allow role escalation after bootstrap
    """
    family_id = request.user["family_id"]
    uid = request.user["uid"]
    email = request.user.get("email", "")
    
    # Check if already registered
    if get_role(family_id, uid) is not None:
        return jsonify({"ok": True, "role": get_role(family_id, uid), "message": "Already registered"})
    
    data = request.get_json(force=True) or {}
    requested_name = (data.get("name") or "").strip()
    requested_role = (data.get("role") or "").strip()
    
    # Check if family exists
    if not fam_ref(family_id).get().exists:
        return jsonify({"ok": False, "error": "Family not found"}), 404
    
    # Count existing members
    members_count = len(list(fam_ref(family_id).collection("members").stream()))
    
    # Determine role
    final_role = None
    final_name = requested_name
    
    # Rule 1: First user becomes admin
    if members_count == 0:
        final_role = "admin"
        if not final_name:
            final_name = "Admin"
        ledger_add(family_id, "", uid, "BOOTSTRAP_FIRST_ADMIN", {"name": final_name})
    
    # Rule 2: Kid email pattern detection
    elif email.endswith(f".{family_id}@gbucks.local"):
        final_role = "kid"
        if not final_name:
            # Extract kid name from email: {name}.{familyId}@gbucks.local
            parts = email.split(".")
            if len(parts) > 0:
                final_name = parts[0].capitalize()
            else:
                final_name = "Kid"
        ledger_add(family_id, "", uid, "BOOTSTRAP_KID", {"name": final_name, "email": email})
    
    # Rule 3: Explicit admin request (only if family has members and no role specified)
    elif requested_role == "admin" and members_count > 0:
        # Check if there's at least one existing admin
        existing_admins = list(fam_ref(family_id).collection("members").where("role", "==", "admin").stream())
        if len(existing_admins) == 0:
            return jsonify({"ok": False, "error": "Cannot create admin: no existing admin to authorize"}), 403
        final_role = "admin"
        if not final_name:
            final_name = "Admin"
        ledger_add(family_id, existing_admins[0].id, uid, "BOOTSTRAP_ADMIN", {"name": final_name})
    
    # Rule 4: Explicit kid request
    elif requested_role == "kid":
        final_role = "kid"
        if not final_name:
            final_name = "Kid"
        # Find an admin to authorize (or use system)
        existing_admins = list(fam_ref(family_id).collection("members").where("role", "==", "admin").stream())
        actor_uid = existing_admins[0].id if existing_admins else ""
        ledger_add(family_id, actor_uid, uid, "BOOTSTRAP_KID_EXPLICIT", {"name": final_name})
    
    if not final_role:
        return jsonify({"ok": False, "error": "Cannot determine role. Provide name and role, or use kid email pattern."}), 400
    
    if not final_name:
        return jsonify({"ok": False, "error": "Name required"}), 400
    
    # Create member, wallet, and session
    member_data = {
        "uid": uid,
        "name": final_name,
        "role": final_role,
        "createdTs": now_ts()
    }
    
    # Add optional kid metadata (age, avatar, onboarding status)
    if final_role == "kid":
        member_data["age"] = data.get("age", 8)  # Default age 8
        member_data["avatar"] = data.get("avatar", "👧")  # Default avatar
        member_data["onboarding_completed"] = data.get("onboarding_completed", False)
    
    member_ref(family_id, uid).set(member_data)
    
    wallet_ref(family_id, uid).set({
        "balanceGb": 0.0,
        "spendingBalance": 0.0,
        "savingsBalance": 0.0,
        "minutes": 0,
        "locked": False,
        "updatedTs": now_ts()
    })
    
    session_ref(family_id, uid).set({
        "active": False,
        "mode": None,
        "startTs": None,
        "endTs": None,
        "updatedTs": now_ts()
    })
    
    return jsonify({"ok": True, "role": final_role, "name": final_name})

@app.post("/api/complete_onboarding")
@auth_required(["kid"])
def api_complete_onboarding():
    """
    Mark kid's onboarding as completed.
    Called when kid finishes the first-time onboarding wizard.
    """
    family_id = request.user["family_id"]
    uid = request.user["uid"]
    
    # Update member record
    member_ref(family_id, uid).update({
        "onboarding_completed": True,
        "onboarding_completed_ts": now_ts()
    })
    
    ledger_add(family_id, uid, uid, "ONBOARDING_COMPLETED", {"name": request.user["name"]})
    return jsonify({"ok": True})

# -------------------------
# Admin: register members (creates membership + initial wallet/session docs)
# This requires Firebase Auth token of an ADMIN who is already marked as admin in this family.
# For bootstrap: you can manually create the first admin membership in Firestore (one time),
# or I can add a bootstrap endpoint that uses a shared secret.
# -------------------------
@app.post("/api/admin/add_member")
@auth_required(["admin"])
def api_admin_add_member():
    """
    Admin adds a member UID into the family (kid/admin).
    Body:
    { "uid":"firebaseAuthUid", "name":"Miles", "role":"kid" }
    """
    family_id = request.user["family_id"]
    data = request.get_json(force=True)
    uid = (data.get("uid") or "").strip()
    name = (data.get("name") or "").strip()
    role = (data.get("role") or "").strip()

    if not uid or not name or role not in ("admin","kid"):
        return jsonify({"ok": False, "error": "uid, name, role required (role=admin|kid)"}), 400

    member_ref(family_id, uid).set({
        "uid": uid,
        "name": name,
        "role": role,
        "createdTs": now_ts()
    }, merge=True)

    wallet_ref(family_id, uid).set({
        "balanceGb": 0.0,
        "spendingBalance": 0.0,
        "savingsBalance": 0.0,
        "minutes": 0,
        "locked": False,
        "updatedTs": now_ts()
    }, merge=True)

    session_ref(family_id, uid).set({
        "active": False,
        "mode": None,
        "startTs": None,
        "endTs": None,
        "updatedTs": now_ts()
    }, merge=True)

    ledger_add(family_id, request.user["uid"], uid, "ADD_MEMBER", {"name": name, "role": role})
    return jsonify({"ok": True})

@app.post("/api/admin/remove_member")
@auth_required(["admin"])
def api_admin_remove_member():
    """
    Admin removes a member from the family (deletes membership, wallet, session).
    Body:
    { "uid":"firebaseAuthUid" }
    """
    family_id = request.user["family_id"]
    data = request.get_json(force=True)
    uid = (data.get("uid") or "").strip()
    
    if not uid:
        return jsonify({"ok": False, "error": "uid required"}), 400
    
    # Get member info before deletion
    member_snap = member_ref(family_id, uid).get()
    if not member_snap.exists:
        return jsonify({"ok": False, "error": "Member not found"}), 404
    
    member_data = member_snap.to_dict()
    member_name = member_data.get("name", uid)
    member_role = member_data.get("role", "unknown")
    
    # Don't allow removing the last admin
    if member_role == "admin":
        admin_count = len(list(fam_ref(family_id).collection("members").where("role", "==", "admin").stream()))
        if admin_count <= 1:
            return jsonify({"ok": False, "error": "Cannot remove last admin"}), 400
    
    # Delete member, wallet, and session
    member_ref(family_id, uid).delete()
    wallet_ref(family_id, uid).delete()
    session_ref(family_id, uid).delete()
    
    ledger_add(family_id, request.user["uid"], uid, "REMOVE_MEMBER", {"name": member_name, "role": member_role})
    return jsonify({"ok": True, "message": f"Member {member_name} removed"})

@app.post("/api/admin/reset_kid")
@auth_required(["admin"])
def api_admin_reset_kid():
    """
    Admin resets a kid's wallet and session to default values.
    Body:
    { "uid":"firebaseAuthUid", "balance_gb":0.0, "minutes":0, "locked":false }
    Optional: balance_gb, minutes, locked (defaults to 0, 0, false)
    """
    family_id = request.user["family_id"]
    data = request.get_json(force=True)
    uid = (data.get("uid") or "").strip()
    
    if not uid:
        return jsonify({"ok": False, "error": "uid required"}), 400
    
    # Verify member exists and is a kid
    member_snap = member_ref(family_id, uid).get()
    if not member_snap.exists:
        return jsonify({"ok": False, "error": "Member not found"}), 404
    
    member_data = member_snap.to_dict()
    if member_data.get("role") != "kid":
        return jsonify({"ok": False, "error": "Can only reset kids"}), 400
    
    # Get reset values (defaults to 0, 0, false)
    balance_gb = clamp_money(data.get("balance_gb", 0.0))
    minutes = int(data.get("minutes", 0))
    locked = bool(data.get("locked", False))
    
    # Reset wallet
    spending = clamp_money(data.get("spending_balance", balance_gb))
    savings = clamp_money(data.get("savings_balance", 0.0))
    wallet_ref(family_id, uid).set({
        "balanceGb": balance_gb,
        "spendingBalance": spending,
        "savingsBalance": savings,
        "minutes": minutes,
        "locked": locked,
        "updatedTs": now_ts()
    })
    
    # Reset session
    session_ref(family_id, uid).set({
        "active": False,
        "mode": None,
        "startTs": None,
        "endTs": None,
        "updatedTs": now_ts()
    })
    
    ledger_add(family_id, request.user["uid"], uid, "RESET_KID", {
        "name": member_data.get("name"),
        "balance_gb": balance_gb,
        "minutes": minutes,
        "locked": locked
    })
    
    return jsonify({"ok": True, "message": f"Kid {member_data.get('name')} reset"})

# -------------------------
# Catalog & State
# -------------------------
@app.get("/api/catalog")
@auth_required(["admin","kid"])
def api_catalog():
    cfg = get_family_config(request.user["family_id"])
    if not cfg:
        return jsonify({"ok": False, "error": "Family not found"}), 404
    return jsonify({"ok": True, "config": cfg})

def sync_timer_for_kid(family_id: str, uid: str):
    s_snap = session_ref(family_id, uid).get()
    w_snap = wallet_ref(family_id, uid).get()
    if not s_snap.exists or not w_snap.exists:
        return

    s = s_snap.to_dict()
    w = w_snap.to_dict()

    if not s.get("active"):
        return

    start_ts = int(s.get("startTs") or 0)
    if start_ts <= 0:
        return

    elapsed_seconds = max(0, now_ts() - start_ts)
    elapsed_minutes = elapsed_seconds // 60
    if elapsed_minutes <= 0:
        return

    cur_minutes = int(w.get("minutes") or 0)
    new_minutes = max(0, cur_minutes - int(elapsed_minutes))
    new_start = start_ts + int(elapsed_minutes) * 60

    # Atomic-ish update: do in a transaction to avoid races
    def txn_op(txn):
        wref = wallet_ref(family_id, uid)
        sref = session_ref(family_id, uid)
        w2 = txn.get(wref).to_dict()
        s2 = txn.get(sref).to_dict()
        if not s2.get("active"):
            return

        cur_m = int(w2.get("minutes") or 0)
        nm = max(0, cur_m - int(elapsed_minutes))
        txn.update(wref, {"minutes": nm, "updatedTs": now_ts()})

        if nm == 0:
            txn.update(sref, {"active": False, "startTs": new_start, "endTs": now_ts(), "updatedTs": now_ts()})
        else:
            txn.update(sref, {"startTs": new_start, "updatedTs": now_ts()})

    db.transaction()(txn_op)

@app.get("/api/state")
@auth_required(["admin","kid"])
def api_state():
    family_id = request.user["family_id"]

    # Sync timers for all kids (admin sees all; kid syncs self)
    if request.user["role"] == "admin":
        members = fam_ref(family_id).collection("members").where("role", "==", "kid").stream()
        for m in members:
            uid = m.id
            sync_timer_for_kid(family_id, uid)
    else:
        sync_timer_for_kid(family_id, request.user["uid"])

    # Build state
    kids = []
    members = fam_ref(family_id).collection("members").where("role", "==", "kid").stream()
    for m in members:
        md = m.to_dict()
        uid = m.id
        w = wallet_ref(family_id, uid).get().to_dict() or {}
        s = session_ref(family_id, uid).get().to_dict() or {}
        kids.append({
            "kid_user_id": uid,  # keep naming for frontend compatibility
            "name": md.get("name") or uid,
            "age": md.get("age", 8),
            "avatar": md.get("avatar", "👧"),
            "onboarding_completed": md.get("onboarding_completed", False),
            "balance_gb": clamp_money(w.get("balanceGb") or 0.0),
            "spending_balance": clamp_money(w.get("spendingBalance") or 0.0),
            "savings_balance": clamp_money(w.get("savingsBalance") or 0.0),
            "minutes": int(w.get("minutes") or 0),
            "locked": bool(w.get("locked") or False),
            "session": {
                "active": bool(s.get("active") or False),
                "mode": s.get("mode"),
                "start_ts": s.get("startTs"),
                "end_ts": s.get("endTs"),
            }
        })

    # latest ledger entry
    last = ledger_col(family_id).order_by("ts", direction=firestore.Query.DESCENDING).limit(1).get()
    latest = last[0].to_dict() if last else None

    return jsonify({"ok": True, "kids": kids, "latest_ledger": latest})

# -------------------------
# Purchase history
# -------------------------
@app.get("/api/purchase_history")
@auth_required(["admin","kid"])
def api_purchase_history():
    family_id = request.user["family_id"]
    kid_uid = (request.args.get("kid_user_id") or "").strip()
    if not kid_uid:
        return jsonify({"ok": False, "error": "kid_user_id required"}), 400

    if request.user["role"] == "kid" and kid_uid != request.user["uid"]:
        return jsonify({"ok": False, "error": "Kids can only view their own history"}), 403

    q = purchases_col(family_id).where("kidUid", "==", kid_uid).order_by("ts", direction=firestore.Query.DESCENDING).limit(50)
    rows = [r.to_dict() for r in q.stream()]

    history = []
    for r in rows:
        history.append({
            "ts": int(r.get("ts") or 0),
            "type": r.get("type"),
            "label": r.get("label"),
            "cost_gb": clamp_money(r.get("costGb") or 0.0),
            "extra": r.get("extra")
        })

    return jsonify({"ok": True, "history": history})

# -------------------------
# Kid purchases
# -------------------------
@app.post("/api/purchase_screen")
@auth_required(["kid"])
def api_purchase_screen():
    family_id = request.user["family_id"]
    uid = request.user["uid"]
    data = request.get_json(force=True)
    package_id = data.get("package_id")

    cfg = get_family_config(family_id)
    pkg = next((p for p in (cfg.get("screen") or []) if p["id"] == package_id), None)
    if not pkg:
        return jsonify({"ok": False, "error": "Unknown package"}), 400

    sync_timer_for_kid(family_id, uid)

    cost = clamp_money(pkg["cost_gb"])
    
    def txn_op(txn):
        wref = wallet_ref(family_id, uid)
        w = txn.get(wref).to_dict() or {}
        if w.get("locked"):
            raise ValueError("Screens locked for today")

        bal = float(w.get("balanceGb") or 0.0)
        spending = float(w.get("spendingBalance") or 0.0)
        
        # Purchases come from spending balance
        if spending < cost:
            raise ValueError("Not enough GB$ in spending wallet")

        new_bal = clamp_money(bal - cost)
        new_spending = clamp_money(spending - cost)
        new_min = int(w.get("minutes") or 0) + int(pkg["minutes"])

        txn.update(wref, {
            "balanceGb": new_bal,
            "spendingBalance": new_spending,
            "minutes": new_min,
            "updatedTs": now_ts()
        })

    try:
        db.transaction()(txn_op)
        # Add purchase record outside transaction (audit trail)
        purchases_col(family_id).add({
            "familyId": family_id,
            "kidUid": uid,
            "ts": now_ts(),
            "type": "screen",
            "label": pkg["label"],
            "costGb": cost,
            "extra": {"minutes": int(pkg["minutes"])}
        })
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    ledger_add(family_id, uid, uid, "PURCHASE_SCREEN", {"package": pkg, "cost_gb": cost})
    return jsonify({"ok": True})

@app.post("/api/purchase_food")
@auth_required(["kid"])
def api_purchase_food():
    family_id = request.user["family_id"]
    uid = request.user["uid"]
    data = request.get_json(force=True)
    item_id = data.get("item_id")

    cfg = get_family_config(family_id)
    item = next((i for i in (cfg.get("food") or []) if i["id"] == item_id), None)
    if not item:
        return jsonify({"ok": False, "error": "Unknown food item"}), 400

    sync_timer_for_kid(family_id, uid)

    cost = clamp_money(item["cost_gb"])
    
    def txn_op(txn):
        wref = wallet_ref(family_id, uid)
        w = txn.get(wref).to_dict() or {}
        bal = float(w.get("balanceGb") or 0.0)
        spending = float(w.get("spendingBalance") or 0.0)
        
        # Purchases come from spending balance
        if spending < cost:
            raise ValueError("Not enough GB$ in spending wallet")

        txn.update(wref, {
            "balanceGb": clamp_money(bal - cost),
            "spendingBalance": clamp_money(spending - cost),
            "updatedTs": now_ts()
        })

    try:
        db.transaction()(txn_op)
        # Add purchase record outside transaction (audit trail)
        purchases_col(family_id).add({
            "familyId": family_id,
            "kidUid": uid,
            "ts": now_ts(),
            "type": "food",
            "label": item["label"],
            "costGb": cost,
            "extra": {"category": item["category"]}
        })
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    ledger_add(family_id, uid, uid, "PURCHASE_FOOD", {"item": item, "cost_gb": cost})
    return jsonify({"ok": True})

# -------------------------
# Sessions
# -------------------------
@app.post("/api/session/start")
@auth_required(["kid"])
def api_session_start():
    family_id = request.user["family_id"]
    uid = request.user["uid"]
    data = request.get_json(force=True)
    mode = (data.get("mode") or "screen").strip()

    sync_timer_for_kid(family_id, uid)

    def txn_op(txn):
        wref = wallet_ref(family_id, uid)
        sref = session_ref(family_id, uid)
        w = txn.get(wref).to_dict() or {}
        s = txn.get(sref).to_dict() or {}

        if w.get("locked"):
            raise ValueError("Screens locked for today")
        if int(w.get("minutes") or 0) <= 0:
            raise ValueError("No minutes available")
        if s.get("active"):
            raise ValueError("Session already running")

        txn.set(sref, {"active": True, "mode": mode, "startTs": now_ts(), "endTs": None, "updatedTs": now_ts()}, merge=True)

    try:
        db.transaction()(txn_op)
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    ledger_add(family_id, uid, uid, "SESSION_START", {"mode": mode})
    return jsonify({"ok": True})

@app.post("/api/session/stop")
@auth_required(["admin","kid"])
def api_session_stop():
    family_id = request.user["family_id"]
    data = request.get_json(force=True)
    kid_uid = (data.get("kid_user_id") or request.user["uid"]).strip()

    if request.user["role"] == "kid" and kid_uid != request.user["uid"]:
        return jsonify({"ok": False, "error": "Kids can only stop their own session"}), 403

    sync_timer_for_kid(family_id, kid_uid)

    s_snap = session_ref(family_id, kid_uid).get()
    if not s_snap.exists or not s_snap.to_dict().get("active"):
        return jsonify({"ok": False, "error": "No active session"}), 400

    session_ref(family_id, kid_uid).set({"active": False, "endTs": now_ts(), "updatedTs": now_ts()}, merge=True)
    ledger_add(family_id, request.user["uid"], kid_uid, "SESSION_STOP", {"stopped_by": request.user["uid"]})
    return jsonify({"ok": True})

# -------------------------
# Admin controls
# -------------------------
@app.post("/api/daily_allotment")
@auth_required(["admin"])
def api_daily_allotment():
    family_id = request.user["family_id"]
    data = request.get_json(force=True)
    amounts = data.get("amounts") or {}

    if not isinstance(amounts, dict):
        return jsonify({"ok": False, "error": "amounts must be a JSON object map"}), 400

    # Get savings settings
    cfg = get_family_config(family_id)
    savings_config = cfg.get("savings", DEFAULT_SAVINGS_SETTINGS) if cfg else DEFAULT_SAVINGS_SETTINGS

    applied = []
    for kid_name, amt in amounts.items():
        amt = clamp_money(amt)
        if amt <= 0:
            continue

        # find kid uid by member name
        matches = fam_ref(family_id).collection("members").where("role", "==", "kid").where("name", "==", kid_name).limit(1).get()
        if not matches:
            continue
        kid_uid = matches[0].id

        # Calculate savings split
        kid_settings = savings_config.get("perKidSettings", {}).get(kid_uid, {})
        savings_enabled = kid_settings.get("enabled", savings_config.get("enabled", False))
        savings_pct = kid_settings.get("percentage", savings_config.get("defaultPercentage", 0))
        
        if savings_enabled and savings_pct > 0:
            savings_pct = max(0, min(100, savings_pct))  # clamp to 0-100
            savings_amt = clamp_money(amt * (savings_pct / 100.0))
            spending_amt = clamp_money(amt - savings_amt)
        else:
            savings_amt = 0.0
            spending_amt = amt

        def txn_op(txn):
            wref = wallet_ref(family_id, kid_uid)
            w = txn.get(wref).to_dict() or {}
            bal = float(w.get("balanceGb") or 0.0)
            spending = float(w.get("spendingBalance") or 0.0)
            savings = float(w.get("savingsBalance") or 0.0)
            
            txn.set(wref, {
                "balanceGb": clamp_money(bal + amt),
                "spendingBalance": clamp_money(spending + spending_amt),
                "savingsBalance": clamp_money(savings + savings_amt),
                "updatedTs": now_ts()
            }, merge=True)

        db.transaction()(txn_op)
        ledger_add(family_id, request.user["uid"], kid_uid, "DAILY_ALLOTMENT", {
            "amount_gb": amt,
            "spending_amt": spending_amt,
            "savings_amt": savings_amt,
            "savings_pct": savings_pct
        })
        applied.append({
            "kid": kid_name,
            "amount": amt,
            "spending": spending_amt,
            "savings": savings_amt
        })

    return jsonify({"ok": True, "applied": applied})

@app.post("/api/reward")
@auth_required(["admin"])
def api_reward():
    family_id = request.user["family_id"]
    data = request.get_json(force=True)
    kid_name = (data.get("kid_name") or "").strip()
    action_id = data.get("action_id")

    cfg = get_family_config(family_id)
    action = next((a for a in (cfg.get("rewards") or []) if a["id"] == action_id), None)
    if not action:
        return jsonify({"ok": False, "error": "Unknown reward action"}), 400

    matches = fam_ref(family_id).collection("members").where("role", "==", "kid").where("name", "==", kid_name).limit(1).get()
    if not matches:
        return jsonify({"ok": False, "error": "Unknown kid"}), 400
    kid_uid = matches[0].id

    delta = clamp_money(action["delta_gb"])

    def txn_op(txn):
        wref = wallet_ref(family_id, kid_uid)
        w = txn.get(wref).to_dict() or {}
        bal = float(w.get("balanceGb") or 0.0)
        txn.set(wref, {"balanceGb": clamp_money(bal + delta), "updatedTs": now_ts()}, merge=True)

    db.transaction()(txn_op)
    ledger_add(family_id, request.user["uid"], kid_uid, "REWARD", {"action": action, "delta_gb": delta})
    return jsonify({"ok": True})

@app.post("/api/consequence_time")
@auth_required(["admin"])
def api_consequence_time():
    family_id = request.user["family_id"]
    data = request.get_json(force=True)
    kid_name = (data.get("kid_name") or "").strip()
    consequence_id = data.get("consequence_id")
    note = (data.get("note") or "")[:120]

    cfg = get_family_config(family_id)
    c = next((x for x in (cfg.get("time_consequences") or []) if x["id"] == consequence_id), None)
    if not c:
        return jsonify({"ok": False, "error": "Unknown time consequence"}), 400

    matches = fam_ref(family_id).collection("members").where("role", "==", "kid").where("name", "==", kid_name).limit(1).get()
    if not matches:
        return jsonify({"ok": False, "error": "Unknown kid"}), 400
    kid_uid = matches[0].id

    sync_timer_for_kid(family_id, kid_uid)

    def txn_op(txn):
        wref = wallet_ref(family_id, kid_uid)
        sref = session_ref(family_id, kid_uid)
        w = txn.get(wref).to_dict() or {}
        minutes = int(w.get("minutes") or 0)
        locked = bool(w.get("locked") or False)

        if "delta_minutes" in c:
            minutes = max(0, minutes + int(c["delta_minutes"]))
        if "set_minutes" in c:
            minutes = int(c["set_minutes"])
        if "lock" in c:
            locked = bool(c["lock"])

        txn.set(wref, {"minutes": minutes, "locked": locked, "updatedTs": now_ts()}, merge=True)

        if c["id"] in ("end_session", "lock_day"):
            txn.set(sref, {"active": False, "endTs": now_ts(), "updatedTs": now_ts()}, merge=True)

    db.transaction()(txn_op)

    ledger_add(family_id, request.user["uid"], kid_uid, "CONSEQUENCE_TIME", {"consequence": c, "note": note})
    return jsonify({"ok": True})

@app.post("/api/consequence_money")
@auth_required(["admin"])
def api_consequence_money():
    family_id = request.user["family_id"]
    data = request.get_json(force=True)
    kid_name = (data.get("kid_name") or "").strip()
    consequence_id = data.get("consequence_id")
    note = (data.get("note") or "")[:120]

    cfg = get_family_config(family_id)
    c = next((x for x in (cfg.get("money_consequences") or []) if x["id"] == consequence_id), None)
    if not c:
        return jsonify({"ok": False, "error": "Unknown money consequence"}), 400

    matches = fam_ref(family_id).collection("members").where("role", "==", "kid").where("name", "==", kid_name).limit(1).get()
    if not matches:
        return jsonify({"ok": False, "error": "Unknown kid"}), 400
    kid_uid = matches[0].id

    delta = clamp_money(c["delta_gb"])

    def txn_op(txn):
        wref = wallet_ref(family_id, kid_uid)
        w = txn.get(wref).to_dict() or {}
        bal = float(w.get("balanceGb") or 0.0)
        new_bal = max(0.0, clamp_money(bal + delta))
        txn.set(wref, {"balanceGb": new_bal, "updatedTs": now_ts()}, merge=True)

    db.transaction()(txn_op)

    ledger_add(family_id, request.user["uid"], kid_uid, "CONSEQUENCE_MONEY", {"consequence": c, "delta_gb": delta, "note": note})
    return jsonify({"ok": True})

# -------------------------
# Savings & Transfers
# -------------------------
@app.post("/api/transfer_to_savings")
@auth_required(["admin", "kid"])
def api_transfer_to_savings():
    """
    Transfer money from spending to savings.
    Admin can transfer for any kid.
    Kid can only transfer their own money.
    Body:
    { "kid_user_id": "uid", "amount": 5.0 }
    """
    family_id = request.user["family_id"]
    data = request.get_json(force=True)
    kid_uid = (data.get("kid_user_id") or "").strip()
    amount = clamp_money(data.get("amount", 0.0))
    
    if not kid_uid:
        return jsonify({"ok": False, "error": "kid_user_id required"}), 400
    
    if amount <= 0:
        return jsonify({"ok": False, "error": "amount must be positive"}), 400
    
    # Authorization check
    if request.user["role"] == "kid" and kid_uid != request.user["uid"]:
        return jsonify({"ok": False, "error": "Kids can only transfer their own money"}), 403
    
    def txn_op(txn):
        wref = wallet_ref(family_id, kid_uid)
        w = txn.get(wref).to_dict() or {}
        spending = float(w.get("spendingBalance") or 0.0)
        savings = float(w.get("savingsBalance") or 0.0)
        
        if spending < amount:
            raise ValueError("Not enough in spending wallet")
        
        txn.update(wref, {
            "spendingBalance": clamp_money(spending - amount),
            "savingsBalance": clamp_money(savings + amount),
            "updatedTs": now_ts()
        })
    
    try:
        db.transaction()(txn_op)
        ledger_add(family_id, request.user["uid"], kid_uid, "TRANSFER_TO_SAVINGS", {"amount": amount})
        return jsonify({"ok": True})
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400

@app.post("/api/transfer_to_spending")
@auth_required(["admin"])
def api_transfer_to_spending():
    """
    Transfer money from savings to spending (admin only).
    Body:
    { "kid_user_id": "uid", "amount": 5.0 }
    """
    family_id = request.user["family_id"]
    data = request.get_json(force=True)
    kid_uid = (data.get("kid_user_id") or "").strip()
    amount = clamp_money(data.get("amount", 0.0))
    
    if not kid_uid:
        return jsonify({"ok": False, "error": "kid_user_id required"}), 400
    
    if amount <= 0:
        return jsonify({"ok": False, "error": "amount must be positive"}), 400
    
    def txn_op(txn):
        wref = wallet_ref(family_id, kid_uid)
        w = txn.get(wref).to_dict() or {}
        spending = float(w.get("spendingBalance") or 0.0)
        savings = float(w.get("savingsBalance") or 0.0)
        
        if savings < amount:
            raise ValueError("Not enough in savings")
        
        txn.update(wref, {
            "spendingBalance": clamp_money(spending + amount),
            "savingsBalance": clamp_money(savings - amount),
            "updatedTs": now_ts()
        })
    
    try:
        db.transaction()(txn_op)
        ledger_add(family_id, request.user["uid"], kid_uid, "TRANSFER_TO_SPENDING", {"amount": amount})
        return jsonify({"ok": True})
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400

@app.post("/api/admin/update_savings_settings")
@auth_required(["admin"])
def api_update_savings_settings():
    """
    Update savings settings for the family.
    Body:
    {
      "enabled": true,
      "defaultPercentage": 10,
      "perKidSettings": {
        "kid_uid": {"enabled": true, "percentage": 15}
      }
    }
    """
    family_id = request.user["family_id"]
    data = request.get_json(force=True)
    
    cfg = get_family_config(family_id) or {}
    savings = cfg.get("savings", DEFAULT_SAVINGS_SETTINGS.copy())
    
    # Update settings
    if "enabled" in data:
        savings["enabled"] = bool(data["enabled"])
    if "defaultPercentage" in data:
        pct = max(0, min(100, int(data["defaultPercentage"])))
        savings["defaultPercentage"] = pct
    if "perKidSettings" in data:
        savings["perKidSettings"] = data["perKidSettings"]
    
    cfg["savings"] = savings
    
    # Update family config
    fam_ref(family_id).update({"config": cfg})
    
    ledger_add(family_id, request.user["uid"], "", "UPDATE_SAVINGS_SETTINGS", {"settings": savings})
    return jsonify({"ok": True, "savings": savings})

# -------------------------
# Health
# -------------------------
@app.get("/api/health")
def api_health():
    return jsonify({"ok": True, "ts": now_ts()})

# -------------------------
# Error Handlers
# -------------------------
@app.errorhandler(404)
def not_found(e):
    """Custom 404 error page"""
    return send_from_directory(os.path.join(APP_DIR, "public"), "404.html"), 404

@app.errorhandler(500)
def internal_error(e):
    """Custom 500 error handler"""
    return jsonify({
        "ok": False,
        "error": "Internal server error",
        "message": "Something went wrong. Please try again later."
    }), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=False)
