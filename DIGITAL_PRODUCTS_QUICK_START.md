# 🚀 Digital Products - Quick Start Guide

## What You Have NOW

✅ **Two products on your landing page:**
1. Starter Kit - $19.99
2. Custom Kit - $39.99

✅ **Complete purchase flow:**
- Product showcase with buy buttons
- Customization form for Custom Kit
- Stripe Checkout integration
- Payment processing
- Order management in Firestore
- Success page

---

## 🎯 To Start Selling TODAY

### 1. Get Stripe Account (15 minutes)

```bash
# 1. Sign up at https://stripe.com
# 2. Get your test API key from Dashboard → Developers → API Keys
# 3. Copy the "Secret key" (starts with sk_test_)

# 4. Set environment variable:
# Windows:
set STRIPE_SECRET_KEY=sk_test_your_key_here

# Mac/Linux:
export STRIPE_SECRET_KEY=sk_test_your_key_here
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Test It!

```bash
# Start backend
python app.py

# Open browser
http://localhost:5000

# Scroll to "Get Printable Materials"
# Click "Buy Starter Kit"

# Use test card: 4242 4242 4242 4242
# Any future date, any CVC, any ZIP
```

---

## 📍 Where Everything Is

### On Landing Page

**Section:** "Get Printable Materials"
- Between "Why It Works" and "Built for Real Families"
- Both `index.html` and `landing.html`

**Navigation:**
- "Downloads" link added to nav menu

### Purchase Flow

1. **Buy Button** → 
2. **Customization Form** (Custom Kit only) → 
3. **Stripe Checkout** → 
4. **Success Page** (`/success`)

### Backend Endpoints

- `POST /api/create-checkout-session` - Creates Stripe checkout
- `POST /api/stripe-webhook` - Receives payment events
- `GET /success` - Success page

### Database

- Collection: `orders`
- Document ID: Stripe session ID
- Contains: product info, customer email, customization

---

## 💳 Stripe Test Cards

| Scenario | Card Number | Result |
|----------|-------------|--------|
| Success | 4242 4242 4242 4242 | ✅ Payment succeeds |
| Decline | 4000 0000 0000 0002 | ❌ Card declined |
| Auth Required | 4000 0025 0000 3155 | 🔐 3D Secure |

**All test cards:**
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

---

## 🔜 What Needs Setup (Phase 2)

### 1. PDF Files

**Starter Kit:**
- Create 20-page PDF with printable materials
- Upload to Firebase Storage or S3
- Link in backend

**Custom Kit:**
- Build PDF generator using ReportLab
- Template for customization
- Generate after purchase

### 2. Email Delivery

- Set up SendGrid (100 emails/day free)
- Create email template
- Send download link after purchase

### 3. Download Page

- Secure download token
- Track download count
- Set expiration date

---

## 📊 View Orders

### Firestore Console

1. Go to Firebase Console
2. Firestore Database
3. Collection: `orders`
4. See all purchases with details

### Query Orders Locally

```python
import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('serviceAccountKey.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

# Get all orders
orders = db.collection('orders').stream()
for order in orders:
    print(order.to_dict())
```

---

## 🚨 Important Notes

### Test Mode vs Production

**Test Mode (Current):**
- Use test API keys (sk_test_...)
- Use test cards
- No real money charged
- Safe to test unlimited

**Production Mode (Go Live):**
- Switch to live API keys (sk_live_...)
- Real cards only
- Real money charged
- Set up webhook properly

### Switching to Production

1. Stripe Dashboard → Toggle "Test mode" OFF
2. Copy live secret key
3. Update environment variable
4. Set up production webhook
5. Test with small purchase first

---

## 💰 Revenue Calculator

### Per Sale

| Product | Price | Stripe Fee | Net Revenue |
|---------|-------|------------|-------------|
| Starter Kit | $19.99 | $0.88 | **$19.11** |
| Custom Kit | $39.99 | $1.46 | **$38.53** |

### Monthly Projections

| Sales/Month | Revenue (50/50 mix) | Annual |
|-------------|---------------------|---------|
| 10 | $288 | $3,456 |
| 50 | $1,441 | $17,292 |
| 100 | $2,882 | $34,584 |
| 500 | $14,410 | $172,920 |

---

## 📈 Track Performance

### Google Analytics

Already integrated! Track:
- `product_purchase_initiated` - User clicked buy
- `purchase` - Completed purchase

View in GA4:
- Events → Filter by "purchase"

### Stripe Dashboard

Monitor:
- Total revenue
- Number of transactions
- Success rate
- Failed payments

---

## 🛠️ Troubleshooting

### "Payment system not configured"

**Fix:** Set Stripe API key
```bash
export STRIPE_SECRET_KEY=sk_test_your_key
```

### Buy button doesn't work

**Check:**
1. Backend running?
2. Console errors? (F12)
3. Stripe key set?
4. API endpoint responding?

### Payment succeeds but no order created

**Check:**
1. Webhook endpoint accessible?
2. Webhook secret set?
3. Firestore rules deployed?
4. Backend logs for errors

### Test webhook locally

```bash
# Install Stripe CLI
# Forward events to local server
stripe listen --forward-to localhost:5000/api/stripe-webhook

# In another terminal, trigger test payment
stripe trigger checkout.session.completed
```

---

## 📞 Support

### Resources

- Full setup: `DIGITAL_PRODUCTS_SETUP.md`
- Implementation plan: `DIGITAL_PRODUCTS_PLAN.md`
- Stripe docs: https://stripe.com/docs
- Test cards: https://stripe.com/docs/testing

### Need Help?

1. Check backend logs: `python app.py` output
2. Check browser console: F12 → Console
3. Check Stripe dashboard: Logs section
4. Check Firestore: orders collection

---

## ✅ Launch Checklist

### Before Going Live

- [ ] Stripe account created
- [ ] Test purchase successful
- [ ] Order appears in Firestore
- [ ] Success page works
- [ ] PDF files ready
- [ ] Email system configured
- [ ] Refund policy page created
- [ ] Terms of Service added
- [ ] Mobile testing complete
- [ ] Switch to live Stripe keys
- [ ] Set up production webhook
- [ ] Test real purchase (small amount)
- [ ] Announce to email list

---

## 🎉 You're Ready!

**What works NOW:**
- Landing page products ✅
- Buy buttons ✅
- Stripe Checkout ✅
- Payment processing ✅
- Order creation ✅
- Success page ✅

**Just need:**
1. Stripe API key (15 min)
2. PDF files (your content)
3. Email delivery (optional for testing)

**Time to first sale: ~15 minutes!**

---

## 🚀 Next Steps

1. **Right Now:**
   - Get Stripe test keys
   - Test a purchase
   - See order in Firestore

2. **This Week:**
   - Create Starter Kit PDF
   - Set up email delivery
   - Build PDF generator for Custom Kit

3. **Go Live:**
   - Switch to production keys
   - Real purchase test
   - Launch! 🎉

---

**Ready to make money teaching financial literacy? Let's go! 💰**

