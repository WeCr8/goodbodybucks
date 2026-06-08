/**
 * config.js — Firebase configuration and auth instance.
 * Depends on: firebase compat SDK loaded via CDN in index.html.
 */

const firebaseConfig = {
  apiKey:     "AIzaSyB2I-KBIn2Y1tN9_NmfPdidvRRLyLKmAIg",
  authDomain: "goodbodybucks.firebaseapp.com",
  projectId:  "goodbodybucks",
};

firebase.initializeApp(firebaseConfig);

/** @type {firebase.auth.Auth} */
export const auth = firebase.auth();

// Show app section immediately if user is already signed in; keep landing otherwise.
auth.onAuthStateChanged((user) => {
  const landing = document.getElementById('landingSection');
  const app     = document.getElementById('appSection');
  if (!landing || !app) return;
  if (user) {
    landing.classList.add('hidden');
    app.classList.remove('hidden');
  } else {
    // Only show landing if app section was never manually shown
    if (app.classList.contains('hidden')) {
      landing.classList.remove('hidden');
    }
  }
});
