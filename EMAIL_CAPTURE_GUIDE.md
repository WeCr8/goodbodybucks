# 📧 Email Capture System - Complete Guide

## Overview

The GoodbodyBucks email capture system allows you to collect email addresses from interested visitors on your landing page. Captured emails are securely stored in Firebase Firestore for future marketing and communication.

## Features

✅ **Secure Email Storage** - All emails stored in Firestore with timestamps  
✅ **Duplicate Detection** - Prevents the same email from being captured multiple times  
✅ **Email Validation** - Client and server-side validation  
✅ **Beautiful UI** - Styled form that matches the landing page design  
✅ **User Feedback** - Success/error messages with icons  
✅ **Analytics Ready** - Tracks email capture success/failure events  
✅ **Privacy Focused** - Firestore rules prevent public access to emails

---

## How It Works

### 1. **User Interaction**
- Visitor enters email in the form on the landing page
- Clicks "Notify Me" button
- Form validates email format client-side

### 2. **Backend Processing**
- Email sent to `/api/capture-email` endpoint
- Server validates email format
- Checks for duplicate emails
- Saves to Firestore `email_captures` collection

### 3. **Data Storage**
Each email capture creates a document with:
```json
{
  "email": "user@example.com",
  "timestamp": "2026-01-02T10:30:00Z",
  "source": "landing_page_hero",
  "userAgent": "Mozilla/5.0...",
  "ipAddress": "192.168.1.1"
}
```

---

## Setup & Deployment

### Local Testing

1. **Start the Flask backend:**
```bash
python app.py
```

2. **Visit the landing page:**
```
http://localhost:5000
```

3. **Scroll to the email capture form**
- Enter an email address
- Click "Notify Me"
- You should see a success message

4. **Verify in Firestore:**
- Go to Firebase Console
- Navigate to Firestore Database
- Check the `email_captures` collection

### Production Deployment

#### Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

#### Deploy Backend (Cloud Run)
```bash
gcloud run deploy goodbodybucks-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

#### Deploy Frontend (Firebase Hosting)
```bash
firebase deploy --only hosting
```

---

## Accessing Captured Emails

### Option 1: Firebase Console (GUI)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **goodbodybucks**
3. Navigate to **Firestore Database**
4. Click on **email_captures** collection
5. View all captured emails with timestamps

### Option 2: Export to CSV (Python Script)

Create `export_emails.py`:
```python
import firebase_admin
from firebase_admin import credentials, firestore
import csv
from datetime import datetime

# Initialize Firebase
cred = credentials.Certificate('serviceAccountKey.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

# Fetch all email captures
captures = db.collection('email_captures').order_by('timestamp', direction=firestore.Query.DESCENDING).stream()

# Export to CSV
with open('email_captures.csv', 'w', newline='', encoding='utf-8') as csvfile:
    fieldnames = ['email', 'timestamp', 'source', 'userAgent', 'ipAddress']
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    
    writer.writeheader()
    for doc in captures:
        data = doc.to_dict()
        # Convert timestamp to readable format
        if 'timestamp' in data and data['timestamp']:
            data['timestamp'] = data['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
        writer.writerow(data)

print("✅ Emails exported to email_captures.csv")
```

Run it:
```bash
python export_emails.py
```

### Option 3: Firebase CLI Export

```bash
# Export entire Firestore database
firebase firestore:export ./firestore-backup

# Then parse the email_captures collection data
```

### Option 4: Cloud Function (Automated Email List Sync)

Create a Cloud Function to automatically sync emails to your email marketing platform (Mailchimp, SendGrid, etc.):

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.syncEmailToMailchimp = functions.firestore
  .document('email_captures/{captureId}')
  .onCreate(async (snap, context) => {
    const emailData = snap.data();
    // Add to Mailchimp/SendGrid/etc.
    console.log('New email captured:', emailData.email);
  });
```

---

## API Reference

### POST `/api/capture-email`

Captures an email address and stores it in Firestore.

#### Request Body
```json
{
  "email": "user@example.com",
  "source": "landing_page_hero"
}
```

#### Success Response (201 Created)
```json
{
  "ok": true,
  "message": "Thank you! We'll keep you updated."
}
```

#### Already Exists Response (200 OK)
```json
{
  "ok": true,
  "message": "Email already registered"
}
```

#### Error Responses

**400 Bad Request - Missing Email**
```json
{
  "ok": false,
  "error": "Email is required"
}
```

**400 Bad Request - Invalid Format**
```json
{
  "ok": false,
  "error": "Invalid email format"
}
```

**500 Internal Server Error**
```json
{
  "ok": false,
  "error": "Failed to save email"
}
```

---

## Security & Privacy

### Firestore Security Rules

```javascript
// Email captures collection
match /email_captures/{captureId} {
  // Allow anyone to create (newsletter signup)
  allow create: if request.resource.data.keys().hasAll(['email', 'timestamp']) &&
                   request.resource.data.email is string &&
                   request.resource.data.email.matches('.*@.*\\..*') &&
                   request.resource.data.timestamp == request.time;
  
  // No public read/write access (privacy)
  allow read, update, delete: if false;
}
```

**What this means:**
- ✅ Anyone can **create** (submit email)
- ❌ No one can **read** emails (privacy protection)
- ❌ No one can **update** or **delete** emails
- ✅ Server (Admin SDK) can access everything

### Backend Validation

- Email format validation (regex)
- Duplicate detection
- IP address logging (for spam prevention)
- User agent logging (for analytics)

---

## Analytics Integration

The email capture form automatically tracks events:

```javascript
// Success
trackMenuInteraction('email_capture', 'success');

// Error
trackMenuInteraction('email_capture', 'error');
```

View in Google Analytics:
1. Go to GA4 Dashboard
2. Events → `menu_interaction`
3. Filter by `menu_type` = `email_capture`

---

## Customization

### Change Button Text
Edit `index.html` or `landing.html`:
```html
<button type="submit" id="emailSubmitBtn">
  Join Waitlist  <!-- Change this text -->
</button>
```

### Change Success Message
Edit `app.py`:
```python
return jsonify({
    "ok": True,
    "message": "You're on the list! Check your email."  # Custom message
}), 201
```

### Add Additional Fields

**Frontend (index.html):**
```html
<input type="text" id="nameInput" placeholder="Your name">
```

**Backend (app.py):**
```python
capture_data = {
    "email": email,
    "name": data.get('name', ''),  # Add name field
    "timestamp": firestore.SERVER_TIMESTAMP,
    # ...
}
```

### Change Form Source Tag
```javascript
body: JSON.stringify({
    email: email,
    source: 'footer_cta'  // Change source identifier
})
```

---

## Troubleshooting

### Problem: Emails not saving to Firestore

**Solution 1:** Check Firestore rules are deployed
```bash
firebase deploy --only firestore:rules
```

**Solution 2:** Verify backend is running
```bash
# Check Cloud Run logs
gcloud run services logs read goodbodybucks-backend
```

**Solution 3:** Test the API directly
```bash
curl -X POST https://your-backend-url/api/capture-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","source":"test"}'
```

### Problem: "Failed to save email" error

**Check:**
1. Firebase Admin SDK credentials are correct
2. Service account key (`serviceAccountKey.json`) exists
3. Backend logs for detailed error messages

### Problem: Duplicate submissions allowed

**Check:**
- Duplicate detection query is working
- Firestore has proper indexes

---

## Best Practices

### 1. **GDPR Compliance**
Add a checkbox for consent:
```html
<label>
  <input type="checkbox" required>
  I agree to receive emails about GoodbodyBucks
</label>
```

### 2. **Double Opt-In**
Send confirmation email before adding to marketing list

### 3. **Unsubscribe Link**
Add `unsubscribed` field to allow opt-outs

### 4. **Rate Limiting**
Implement rate limiting to prevent spam:
```python
# Add to app.py
from flask_limiter import Limiter

limiter = Limiter(app, key_func=lambda: request.remote_addr)

@limiter.limit("5 per minute")
@app.post("/api/capture-email")
def capture_email():
    # ...
```

### 5. **Email Verification**
Send verification code to confirm email ownership

---

## Integration with Email Marketing Platforms

### Mailchimp Integration

```python
import requests

MAILCHIMP_API_KEY = "your-api-key"
MAILCHIMP_LIST_ID = "your-list-id"
MAILCHIMP_SERVER = "us1"  # e.g., us1, us2, etc.

def add_to_mailchimp(email):
    url = f"https://{MAILCHIMP_SERVER}.api.mailchimp.com/3.0/lists/{MAILCHIMP_LIST_ID}/members"
    headers = {
        "Authorization": f"Bearer {MAILCHIMP_API_KEY}"
    }
    data = {
        "email_address": email,
        "status": "subscribed"
    }
    response = requests.post(url, json=data, headers=headers)
    return response.status_code == 200
```

### SendGrid Integration

```python
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

def add_to_sendgrid_list(email):
    sg = SendGridAPIClient(api_key='YOUR_API_KEY')
    data = {
        "contacts": [{"email": email}]
    }
    response = sg.client.marketing.contacts.put(request_body=data)
    return response.status_code == 202
```

---

## Monitoring & Metrics

### Key Metrics to Track

1. **Conversion Rate**
   - Landing page visitors → Email submissions
   - Track in Google Analytics

2. **Email Capture Growth**
   - Daily/weekly/monthly captures
   - Query Firestore for counts

3. **Duplicate Submissions**
   - Monitor 200 OK responses (already exists)

4. **Error Rate**
   - Track 400/500 errors
   - Alert if error rate > 5%

### Query Examples

**Total captures:**
```python
total = len(list(db.collection('email_captures').stream()))
print(f"Total emails captured: {total}")
```

**Captures today:**
```python
from datetime import datetime, timedelta
today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
captures = db.collection('email_captures').where('timestamp', '>=', today).stream()
count = len(list(captures))
print(f"Captures today: {count}")
```

---

## Future Enhancements

- [ ] Email verification flow
- [ ] Welcome email automation
- [ ] Email preferences management
- [ ] A/B testing different form designs
- [ ] Progressive disclosure (capture name after email)
- [ ] Social proof (show # of signups)
- [ ] Exit-intent popup
- [ ] Scroll-triggered popup

---

## Support

If you encounter issues:

1. Check Firebase Console logs
2. Review Cloud Run logs
3. Test API endpoint directly
4. Verify Firestore rules
5. Check browser console for errors

---

## Summary

You now have a complete email capture system that:
- ✅ Collects emails from your landing page
- ✅ Stores them securely in Firestore
- ✅ Prevents duplicates
- ✅ Provides beautiful user feedback
- ✅ Tracks analytics events
- ✅ Ready for marketing integrations

**Next Steps:**
1. Test locally
2. Deploy to production
3. Export emails regularly
4. Integrate with email marketing platform
5. Send your first newsletter!

