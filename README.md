# 🎂 Nitu Bakery — Order Management System

A complete bakery order management system with admin dashboard and customer order form.

## 📁 Project Structure

```
nitu-bakery-apps/
├── admin-app/          # Admin dashboard (管理者用)
│   ├── index.html      # Main admin app
│   ├── logo.png        # Bakery logo
│   ├── sw.js           # Service worker
│   └── icons/          # PWA icons
│
└── customer-app/       # Customer order form (顧客用)
    ├── index.html      # Customer order form
    └── logo.png        # Bakery logo
```

## 🚀 Features

### Admin App
- 📊 Order dashboard with real-time sync
- 🎂 Cake order management (weight, flavor, design, writing)
- 💳 Payment tracking with bKash/Nagad/Rocket charge calculation
- 🚚 Delivery scheduling and tracking
- ⏰ Delay tracking (customer vs bakery delays)
- 🔔 Always-on notifications with daily reminders
- 📱 PWA support (installable on mobile)
- 🌐 Bengali/English language support
- 📸 Reference photo upload
- 💬 WhatsApp integration
- 🔄 Real-time Firebase sync

### Customer App
- 📱 Mobile-first, lightweight design
- 🌐 Bengali/English language selection
- 🎂 Easy cake order form
- 💳 Auto-calculated payment with charges
- 📸 Reference photo upload
- ✅ Order confirmation with summary
- ⚡ Works on low-end devices

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript (no frameworks)
- **Backend**: Firebase Realtime Database
- **Auth**: Firebase Authentication
- **Hosting**: Static files (can deploy to Firebase Hosting, GitHub Pages, etc.)

## 📦 Deployment

### Option 1: Firebase Hosting (Recommended)
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login and init
firebase login
firebase init hosting

# Deploy
firebase deploy
```

### Option 2: GitHub Pages
1. Push to GitHub repository
2. Enable GitHub Pages in repository settings
3. Access via `https://username.github.io/nitu-bakery-apps/admin-app/`

### Option 3: Any Static Host
Simply upload the files to any web server or static hosting service.

## 🔧 Configuration

### Firebase Config
Update the Firebase configuration in both `admin-app/index.html` and `customer-app/index.html`:

```javascript
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
};
```

### Payment Rates
Update payment charge rates in the JavaScript:

```javascript
const BKASH_RATE = 0.0185;   // 1.85%
const NAGAD_RATE = 0.0149;   // 1.49%
const ROCKET_RATE = 0.0180;  // 1.80%
```

## 📱 Usage

### For Admin
1. Open admin app in browser
2. Login with Firebase credentials
3. Manage orders, track payments, schedule deliveries

### For Customers
1. Share the customer form link via Facebook/WhatsApp
2. Customers fill in their order details
3. Orders automatically appear in admin dashboard with "অনলাইন অর্ডার" badge

## 🔄 Data Flow

```
Customer Form → Firebase RTDB → Admin Dashboard
     ↓                              ↓
 source: 'customer'          Shows with badge
     ↓                              ↓
 Admin fills price/status    Updates in real-time
```

## 📝 License

This project is for Nitu's Bakery internal use.

## 🤝 Support

For issues or questions, contact the development team.
