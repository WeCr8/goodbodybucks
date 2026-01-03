# 📧 Email Capture - Quick Start

## What You Have

✅ Email capture form on landing page  
✅ Backend API endpoint (`/api/capture-email`)  
✅ Secure Firestore storage  
✅ Export script to download emails  
✅ Duplicate prevention  
✅ Analytics tracking

---

## Test It Now (Local)

1. **Start Flask backend:**
```bash
python app.py
```

2. **Open landing page:**
```
http://localhost:5000
```

3. **Scroll down to email form** (before "Ready to Start?" section)

4. **Enter email and click "Notify Me"**

5. **Check Firestore Console** to see the captured email

---

## Deploy to Production

### 1. Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### 2. Deploy Backend
```bash
# If using Cloud Run
./deploy_backend.sh

# Or manually
gcloud run deploy goodbodybucks-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

### 3. Deploy Frontend
```bash
firebase deploy --only hosting
```

---

## Export Captured Emails

**Run the export script:**
```bash
python export_emails.py
```

**Output files:**
- `email_captures.csv` - Full data with timestamps, source, etc.
- `emails_only.txt` - Just email addresses (one per line)

---

## View Emails in Firebase Console

1. Go to https://console.firebase.google.com/
2. Select **goodbodybucks** project
3. Click **Firestore Database**
4. Open **email_captures** collection
5. View all captured emails

---

## API Endpoint

**URL:** `POST /api/capture-email`

**Request:**
```json
{
  "email": "user@example.com",
  "source": "landing_page_hero"
}
```

**Response (Success):**
```json
{
  "ok": true,
  "message": "Thank you! We'll keep you updated."
}
```

---

## Where the Email Form Appears

The email capture form is located on both:
- `index.html` (line ~1315)
- `landing.html` (line ~1082)

**Section:** Between "Built for Real Families" and "Ready to Start?" CTA

**Styling:** Matches the landing page design (dark theme with green accents)

---

## Customization

### Change Button Text
Edit `index.html` or `landing.html`:
```html
<button type="submit" id="emailSubmitBtn">
  Join Waitlist  <!-- Change this -->
</button>
```

### Change Heading
```html
<h2 class="section-title" style="margin-bottom: 20px;">
    Get Early <span style="color: var(--primary);">Access</span>
</h2>
```

### Change Description
```html
<p style="font-size: 1.2rem; color: var(--text-muted); margin-bottom: 40px;">
    Be the first to know when we launch!
</p>
```

---

## Troubleshooting

### Form Not Submitting?
1. Check browser console for errors
2. Verify backend is running
3. Test API endpoint directly:
```bash
curl -X POST http://localhost:5000/api/capture-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### Emails Not Saving?
1. Check Firestore rules are deployed
2. Verify `serviceAccountKey.json` exists
3. Check backend logs for errors

### Duplicate Email Message?
- This is expected behavior
- Prevents spam and duplicate entries
- Email was already captured previously

---

## What Happens When Someone Submits

1. ✅ **Client-side validation** - Email format checked
2. ✅ **Server receives request** - `/api/capture-email` endpoint
3. ✅ **Server validation** - Email format re-validated
4. ✅ **Duplicate check** - Queries Firestore for existing email
5. ✅ **Save to database** - Creates document in `email_captures` collection
6. ✅ **Success response** - User sees "Thank you!" message
7. ✅ **Analytics tracking** - Event logged to Google Analytics

---

## Data Stored Per Capture

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

## Security Features

✅ **Email format validation** (client + server)  
✅ **Firestore security rules** (no public read access)  
✅ **Duplicate prevention**  
✅ **IP address logging** (spam prevention)  
✅ **Server-side validation**  
✅ **HTTPS only** (in production)

---

## Next Steps

1. ✅ Test locally
2. ✅ Deploy to production
3. ✅ Export emails regularly
4. 📬 Set up email marketing (Mailchimp, SendGrid, etc.)
5. 📧 Send your first newsletter!

---

## Full Documentation

For complete details, see: `EMAIL_CAPTURE_GUIDE.md`

---

## Support

Questions? Check:
1. `EMAIL_CAPTURE_GUIDE.md` - Full documentation
2. Firebase Console logs
3. Browser console (F12)
4. Backend logs (`python app.py` output)

---

**That's it! Your email capture system is ready to go! 🚀**

