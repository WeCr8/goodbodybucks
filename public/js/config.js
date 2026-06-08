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
