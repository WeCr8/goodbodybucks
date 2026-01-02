# 🎮 GB$ (Goodbody Bucks) - Family Economy System

A Firebase-backed family economy and learning rewards system that teaches kids financial literacy, time management, and academic skills through a fun, interactive game.

[![Firebase](https://img.shields.io/badge/Firebase-Hosting-orange)](https://goodbodybucks.web.app)
[![Python](https://img.shields.io/badge/Python-3.12-blue)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-Backend-green)](https://flask.palletsprojects.com/)

## 🌐 Live Demo

**Frontend (Firebase Hosting)**: https://goodbodybucks.web.app

## 📖 What Is GB$?

GB$ is a family economy system where:
- **Kids earn virtual currency (GB$)** by completing educational activities
- **Kids spend GB$** on food and screen time
- **Parents manage** rewards, consequences, and daily allotments
- **Timer system** tracks screen time usage in real-time
- **Purchase history** teaches financial record-keeping

Think of it as a **real-world economy simulator** for your family!

## ✨ Features

### For Kids
- 💰 **Wallet Display** - View GB$ balance and available screen time
- 🎓 **Earn Rewards** - Complete math, reading, spelling, writing tasks
- 🍕 **Buy Food** - Spend GB$ on food items
- 📱 **Buy Screen Time** - Purchase minutes for gaming/tablet time
- ⏱️ **Timer System** - Track active screen time sessions
- 📊 **Purchase History** - View past purchases and spending patterns

### For Parents (Admins)
- 👨‍👩‍👧‍👦 **Member Management** - Add/remove family members, reset accounts
- 💵 **Daily Allotments** - Give kids their daily GB$ allowance
- 🎁 **Rewards** - Award GB$ for completed learning activities
- ⚠️ **Consequences** - Apply time or money penalties when needed
- 🔒 **Screen Locks** - Lock/unlock screen time access
- 📈 **Visual Menus** - Manage food, screen time, and learning catalogs

### System Features
- 🔐 **Firebase Authentication** - Secure email/password login
- 💾 **Firestore Database** - Real-time data synchronization
- 📝 **Audit Ledger** - Hash-chained transaction history
- 🖼️ **Visual Menus** - Image-based item selection
- ✅ **Purchase Confirmation** - Modal with preview before buying
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- Firebase account
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/WeCr8/goodbodybucks.git
cd goodbodybucks
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Firebase

#### Get Service Account Key
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create one)
3. **Project Settings** → **Service Accounts** → **Generate New Private Key**
4. Save as `serviceAccountKey.json` in the project root

#### Enable Firebase Services
1. **Authentication** → Enable **Email/Password**
2. **Firestore Database** → **Create Database** (Production mode)

#### Update Frontend Config
Edit `index.html` around line 130-135 with your Firebase web app credentials:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 4. Start the Backend
```bash
python app.py
```
Or use the batch file:
```bash
run_flask.bat
```

### 5. Open the App
```
http://127.0.0.1:5000/
```

## 📋 Testing Workflow

### 1. Create a Family
- Enter family name
- Click "Create Family"
- **Copy the Family ID** (you'll need this!)

### 2. Create Admin Account
**Option A**: Via Firebase Console
- Go to Firebase Console → Authentication → Add User
- Create user with email/password

**Option B**: Auto-bootstrap (first user)
- Enter Family ID
- Enter your email and password (6+ characters)
- Click "Login Admin"
- First user auto-becomes admin

### 3. Login as Admin
- Enter Family ID
- Enter admin email/password
- Click "Login Admin"

### 4. Add a Kid Account
- Login as Admin
- In "Member Management":
  - Enter kid name (e.g., "Miles")
  - Enter 4-6 digit PIN (e.g., "1234")
  - Click "Add Member"

### 5. Login as Kid
- Enter Family ID
- Enter kid name (e.g., "Miles")
- Enter PIN (e.g., "1234")
- Click "Login Kid"

### 6. Test Features
- **Give Allotment** (Admin): Grant daily GB$ to kid
- **Reward Action** (Admin): Award GB$ for learning
- **Buy Screen Time** (Kid): Purchase minutes
- **Start Timer** (Kid): Begin screen time session
- **Buy Food** (Kid): Purchase food items
- **View Purchase History**: See all transactions

## 🏗️ Architecture

### Frontend
- **Single-page application** (`index.html`)
- **Vanilla JavaScript** - No frameworks
- **Firebase JS SDK** - Authentication and client-side logic
- **Responsive CSS** - Dark theme, card-based UI

### Backend
- **Python Flask** - RESTful API
- **Firebase Admin SDK** - Server-side Firebase operations
- **Firestore** - NoSQL database
- **Transaction support** - Atomic money/minute updates

### Database Structure
```
families/{familyId}/
  ├── members/{uid}        # User profiles (admin/kid)
  ├── wallets/{uid}        # GB$ balance, minutes, locked status
  ├── sessions/{uid}       # Active timer sessions
  ├── purchases/{docId}    # Purchase history
  └── ledger/{docId}       # Hash-chained audit log
```

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Python 3.12, Flask
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Hosting**: Firebase Hosting
- **Images**: Static files served via Flask

## 📦 Deployment

### Firebase Hosting (Frontend)
```bash
firebase deploy --only hosting
```

### Cloud Run (Backend) - Optional
```bash
# Build Docker image
docker build -t gcr.io/YOUR_PROJECT/gbucks-api .

# Push to Container Registry
docker push gcr.io/YOUR_PROJECT/gbucks-api

# Deploy to Cloud Run
gcloud run deploy gbucks-api \
  --image gcr.io/YOUR_PROJECT/gbucks-api \
  --region us-west1 \
  --platform managed
```

## 🔒 Security

### Protected Files (Not in Git)
- `serviceAccountKey.json` - Firebase admin credentials
- `goodbodybucks-firebase-adminsdk-*.json` - Service account keys
- `__pycache__/` - Python bytecode cache

### Security Best Practices
- ✅ Service account keys excluded via `.gitignore`
- ✅ Firebase Auth for user authentication
- ✅ ID token validation on all API requests
- ✅ Role-based access control (admin vs kid)
- ✅ Family-level data isolation
- ✅ Transaction-based atomic updates

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is private and proprietary.

## 👨‍💻 Author

**WeCr8**
- GitHub: [@WeCr8](https://github.com/WeCr8)
- Email: zach@wecr8.info

## 🐛 Known Issues

- Images require Flask backend to be running (local or Cloud Run)
- Backend not deployed to cloud by default (runs locally)
- Timer reconciliation happens on state refresh (not real-time push)

## 📚 Documentation

- [Member Management Guide](MEMBER_MANAGEMENT.md)
- [Purchase Modal Guide](PURCHASE_MODAL_GUIDE.md)
- [Image Setup Guide](LOGO_SETUP.md)
- [Deployment Guide](DEPLOYMENT_COMPLETE_2026.md)

## 🎯 Roadmap

- [ ] Cloud Run backend deployment automation
- [ ] Real-time timer updates (WebSockets/Firebase Realtime)
- [ ] Push notifications for rewards/consequences
- [ ] Parent mobile app
- [ ] Multi-language support
- [ ] Custom reward/consequence templates
- [ ] Data export/reporting

## 🙏 Acknowledgments

Built with ❤️ for the Goodbody family and other families who want to teach their kids valuable life skills through gamification.

---

**Live App**: https://goodbodybucks.web.app  
**Repository**: https://github.com/WeCr8/goodbodybucks  
**Firebase Console**: https://console.firebase.google.com/project/goodbodybucks
