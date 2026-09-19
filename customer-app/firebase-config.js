const firebaseConfig = {
  apiKey: "AIzaSyD9mGV0hogQ6AyPMznmEcZuAhFmIV3rh3M",
  authDomain: "nitusbakingplanv2.firebaseapp.com",
  databaseURL: "https://nitusbakingplanv2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nitusbakingplanv2",
  storageBucket: "nitusbakingplanv2.firebasestorage.app",
  messagingSenderId: "413436889702",
  appId: "1:413436889702:web:f0290fdc4b8d4e80d1bba7"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();

// Silent anonymous sign-in — every visitor gets an auth.uid so the
// database security rules ("auth != null") pass for real customers,
// while outsiders with just the URL are locked out.
// NOTE: enable "Anonymous" in Firebase Console → Authentication →
// Sign-in method, then deploy the rules (database.rules.json).
(function ensureCustomerAuth() {
  try {
    firebase.auth().onAuthStateChanged(user => {
      if (!user) firebase.auth().signInAnonymously().catch(err => console.warn('anon auth failed', err && err.code));
    });
  } catch (e) { console.warn(e); }
})();
