import os, time, json, hashlib
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory

import firebase_admin
from firebase_admin import credentials, auth, firestore

APP_DIR = os.path.dirname(os.path.abspath(__file__))

# -------------------------
# Config
# -------------------------
SERVICE_ACCOUNT_PATH = os.environ.get(
    "GOOGLE_APPLICATION_CREDENTIALS",
    os.path.join(APP_DIR, "serviceAccountKey.json")
)

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

# Enable CORS for all routes (needed for localhost/127.0.0.1 cross-origin)
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Family-Id')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
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
    {"id":"minus5","label":"Time -5 minutes","delta_minutes":-5,"image_url":"/images/consequences/minus5.jpg"},
    {"id":"minus10","label":"Time -10 minutes","delta_minutes":-10,"image_url":"/images/consequences/minus10.jpg"},
    {"id":"end_session","label":"End current session (minutes=0)","set_minutes":0,"image_url":"/images/consequences/end_session.jpg"},
    {"id":"lock_day","label":"Lock screens for today","lock":True,"image_url":"/images/consequences/lock_day.jpg"},
    {"id":"unlock","label":"Unlock screens","lock":False,"image_url":"/images/consequences/unlock.jpg"},
]

DEFAULT_MONEY_CONSEQUENCES = [
    {"id":"deduct25","label":"-$0.25","delta_gb":-0.25,"image_url":"/images/consequences/deduct25.jpg"},
    {"id":"deduct50","label":"-$0.50","delta_gb":-0.50,"image_url":"/images/consequences/deduct50.jpg"},
    {"id":"deduct100","label":"-$1.00","delta_gb":-1.00,"image_url":"/images/consequences/deduct100.jpg"},
    {"id":"deduct200","label":"-$2.00","delta_gb":-2.00,"image_url":"/images/consequences/deduct200.jpg"},
]

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
if not os.path.exists(SERVICE_ACCOUNT_PATH):
    raise RuntimeError(
        f"Missing service account key at {SERVICE_ACCOUNT_PATH}. "
        f"Put serviceAccountKey.json next to app.py or set GOOGLE_APPLICATION_CREDENTIALS."
    )

cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
firebase_admin.initialize_app(cred, {"projectId": FIREBASE_PROJECT_ID} if FIREBASE_PROJECT_ID else None)
db = firestore.client()

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
# Static: serve index.html and images
# -------------------------
@app.get("/")
def index():
    # If you keep your index.html next to app.py for local testing
    return send_from_directory(APP_DIR, "index.html")

@app.route("/test-image", methods=["GET"])
def test_image():
    """Test endpoint to verify image serving works"""
    images_dir = os.path.join(APP_DIR, "public", "images")
    test_file = os.path.join(images_dir, "gbucks-coin.png")
    if os.path.exists(test_file):
        return jsonify({"ok": True, "message": "Image file exists", "path": test_file, "version": "2026-01-02-v2"})
    else:
        return jsonify({"ok": False, "error": "Image file not found", "path": test_file}), 404

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
    member_ref(family_id, uid).set({
        "uid": uid,
        "name": final_name,
        "role": final_role,
        "createdTs": now_ts()
    })
    
    wallet_ref(family_id, uid).set({
        "balanceGb": 0.0,
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
    wallet_ref(family_id, uid).set({
        "balanceGb": balance_gb,
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
            "balance_gb": clamp_money(w.get("balanceGb") or 0.0),
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
        if bal < cost:
            raise ValueError("Not enough GB$")

        new_bal = clamp_money(bal - cost)
        new_min = int(w.get("minutes") or 0) + int(pkg["minutes"])

        txn.update(wref, {"balanceGb": new_bal, "minutes": new_min, "updatedTs": now_ts()})

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
        if bal < cost:
            raise ValueError("Not enough GB$")

        txn.update(wref, {"balanceGb": clamp_money(bal - cost), "updatedTs": now_ts()})

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

        def txn_op(txn):
            wref = wallet_ref(family_id, kid_uid)
            w = txn.get(wref).to_dict() or {}
            bal = float(w.get("balanceGb") or 0.0)
            txn.set(wref, {"balanceGb": clamp_money(bal + amt), "updatedTs": now_ts()}, merge=True)

        db.transaction()(txn_op)
        ledger_add(family_id, request.user["uid"], kid_uid, "DAILY_ALLOTMENT", {"amount_gb": amt})
        applied.append({"kid": kid_name, "amount": amt})

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
# Health
# -------------------------
@app.get("/api/health")
def api_health():
    return jsonify({"ok": True, "ts": now_ts()})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=False)
