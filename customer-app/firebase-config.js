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
// IMPORTANT: some in-app browsers (Facebook/Messenger webview) can be slow
// or block storage, so app.js awaits ensureAuthReady() before any DB read or
// write and shows a clear message instead of a silent permission-denied.
let _authUser = null;
let _authWaiters = [];
firebase.auth().onAuthStateChanged(function (user) {
  if (user) {
    _authUser = user;
    _authWaiters.splice(0).forEach(function (fn) { fn(true); });
  } else {
    firebase.auth().signInAnonymously().catch(function (err) {
      console.warn('anon auth failed', err && err.code);
      _authWaiters.splice(0).forEach(function (fn) { fn(false); });
    });
  }
});
window.ensureAuthReady = function (timeoutMs) {
  if (_authUser) return Promise.resolve(true);
  return new Promise(function (resolve) {
    let done = false;
    const finish = function (ok) { if (!done) { done = true; resolve(ok); } };
    _authWaiters.push(finish);
    setTimeout(function () { finish(!!_authUser); }, timeoutMs || 12000);
    // Nudge a retry in case the first attempt happened before storage was ready
    try { if (!firebase.auth().currentUser) firebase.auth().signInAnonymously().catch(function () {}); } catch (e) {}
  });
};
