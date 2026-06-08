/**
 * auth.js — Simplified authentication: 2-tab login (Parent / Kid).
 * Parents never type Family ID — auto-managed via localStorage.
 * Kids auto-load Family ID from localStorage; field shown only if missing.
 * Google: popup with redirect fallback on popup-blocked.
 */

import { state }                              from './state.js';
import { auth }                               from './config.js';
import { api, setStatus, API_BASE }           from './api.js';
import { logEvent, logClick, logError }       from './logger.js';
import { refreshCatalog }                     from './catalog.js';
import { refreshState }                       from './wallet.js';

/* ── localStorage helpers ─────────────────────────────────── */
const LS_FAM_KEY = 'gbucks_fam';
function saveFamilyId(id) { try { localStorage.setItem(LS_FAM_KEY, id); } catch(_) {} }
function loadFamilyId()   { try { return localStorage.getItem(LS_FAM_KEY) || ''; } catch(_) { return ''; } }

// Pending Firebase user awaiting family setup
let _pendingUser = null;

/* ── Tab switching ────────────────────────────────────────── */

export function switchAuthTab(tab) {
  document.getElementById('tabParent')?.classList.toggle('active', tab === 'parent');
  document.getElementById('tabKid')?.classList.toggle('active', tab === 'kid');
  document.getElementById('authParentPanel')?.classList.toggle('hidden', tab !== 'parent');
  document.getElementById('authKidPanel')?.classList.toggle('hidden', tab !== 'kid');
  document.getElementById('authFamilySetup')?.classList.add('hidden');
  setStatus('');

  if (tab === 'kid') {
    document.getElementById('kidFamilyIdRow')?.classList.toggle('hidden', !!loadFamilyId());
  }
}

/* ── Google sign-in (popup → redirect fallback) ───────────── */

export async function loginWithGoogle() {
  logClick('loginWithGoogle', 'google_signin');
  setStatus('Signing in with Google...');
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await auth.signInWithPopup(provider);
    await _handleSocialResult(result.user);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-cancelled-by-user') {
      setStatus('Redirecting to Google...');
      try { await auth.signInWithRedirect(provider); } catch (re) { setStatus('Error: ' + re.message); }
    } else if (e.code !== 'auth/popup-closed-by-user') {
      logError('loginWithGoogle', e);
      setStatus('Google sign-in error: ' + e.message);
    } else {
      setStatus('');
    }
  }
}

/** Called on page load to complete a Google redirect sign-in. */
export async function handleRedirectResult() {
  try {
    const result = await auth.getRedirectResult();
    if (result?.user) await _handleSocialResult(result.user);
  } catch (e) {
    if (e.code) logError('handleRedirectResult', e);
  }
}

async function _handleSocialResult(user) {
  state.idToken     = await user.getIdToken();
  state.currentUser = { uid: user.uid, email: user.email, role: 'admin' };
  logEvent('social_signin_success', { uid: user.uid });

  const famId = loadFamilyId();
  if (famId) {
    state.familyId = famId;
    await _bootstrapAndEnter(user, 'parent');
  } else {
    _pendingUser = user;
    _showFamilySetup();
  }
}

/* ── Apple sign-in ────────────────────────────────────────── */

export async function loginWithApple() {
  logClick('loginWithApple', 'apple_signin');
  try {
    const provider = new firebase.auth.OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    setStatus('Opening Apple sign-in...');
    const result = await auth.signInWithPopup(provider);
    await _handleSocialResult(result.user);
  } catch (e) {
    if (e.code === 'auth/operation-not-allowed') {
      setStatus('Apple sign-in not yet configured. Use Google or email.');
    } else if (e.code && e.code !== 'auth/popup-closed-by-user') {
      logError('loginWithApple', e);
      setStatus('Apple sign-in error: ' + e.message);
    } else {
      setStatus('');
    }
  }
}

/* ── Parent email sign-in ─────────────────────────────────── */

export async function loginAdmin() {
  logClick('loginAdmin', 'admin_login_attempt');
  const email = document.getElementById('adminEmail')?.value.trim();
  const pass  = document.getElementById('adminPass')?.value;

  if (!email || !pass)  { setStatus('Email and password required'); return; }
  if (pass.length < 6)  { setStatus('Password must be at least 6 characters'); return; }

  setStatus('Signing in...');
  let cred;
  try {
    cred = await auth.signInWithEmailAndPassword(email, pass);
    logEvent('admin_signin_success', { email });
  } catch (e) {
    const code = e.code || '';
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      try {
        cred = await auth.createUserWithEmailAndPassword(email, pass);
        logEvent('admin_account_created', { email });
      } catch (ce) {
        const cc = ce.code || '';
        if (cc === 'auth/email-already-in-use') {
          setStatus('Wrong password. Try again or reset via Firebase Console.');
        } else {
          setStatus('Error: ' + (ce.message || cc));
        }
        return;
      }
    } else {
      setStatus('Error: ' + e.message);
      return;
    }
  }

  state.idToken     = await cred.user.getIdToken();
  state.currentUser = { uid: cred.user.uid, email: cred.user.email, role: 'admin' };

  const famId = loadFamilyId();
  if (famId) {
    state.familyId = famId;
    await _bootstrapAndEnter(cred.user, 'parent');
  } else {
    _pendingUser = cred.user;
    _showFamilySetup();
  }
}

/* ── Family setup (first-time parents) ───────────────────── */

function _showFamilySetup() {
  document.getElementById('authParentPanel')?.classList.add('hidden');
  document.getElementById('authKidPanel')?.classList.add('hidden');
  document.getElementById('authFamilySetup')?.classList.remove('hidden');
  setStatus('');
}

export async function finishFamilySetup() {
  const name = document.getElementById('setupFamilyName')?.value.trim();
  if (!name) { setStatus('Enter a family name'); return; }

  const user = _pendingUser || auth.currentUser;
  if (!user) { setStatus('Please sign in first'); return; }

  setStatus('Creating your family...');
  try {
    state.idToken = await user.getIdToken();

    const res = await fetch(API_BASE + '/api/setup_family', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ family_name: name }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to create family');

    state.familyId = data.family_id;
    saveFamilyId(state.familyId);
    _showFamilyIdBanner(state.familyId);
    logEvent('family_created', { familyId: state.familyId, familyName: name });
    _pendingUser = null;

    await _bootstrapAndEnter(user, 'parent');
  } catch (e) {
    logError('finishFamilySetup', e);
    setStatus('Error: ' + e.message);
  }
}

/* ── Kid sign-in ──────────────────────────────────────────── */

export async function loginKid() {
  const name = document.getElementById('kidName')?.value.trim();
  const pin  = document.getElementById('kidPin')?.value;

  if (!name)                  { setStatus('Enter your name'); return; }
  if (!pin || pin.length < 6) { setStatus('PIN must be at least 6 characters'); return; }

  let famId = loadFamilyId();
  if (!famId) {
    famId = document.getElementById('kidFamilyId')?.value.trim();
    if (!famId) {
      document.getElementById('kidFamilyIdRow')?.classList.remove('hidden');
      setStatus('Enter your Family ID (ask your parent)');
      return;
    }
  }
  state.familyId = famId;

  const nameKey = name.toLowerCase().replace(/\s+/g, '');
  const email   = `${nameKey}.${famId}@gbucks.local`;

  setStatus('Signing in...');
  let cred;
  try {
    cred = await auth.signInWithEmailAndPassword(email, pin);
  } catch (e) {
    const code = e.code || '';
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      try {
        cred = await auth.createUserWithEmailAndPassword(email, pin);
        logEvent('kid_account_created', { nameKey });
      } catch (ce) {
        setStatus('Error: ' + (ce.message || ce.code));
        return;
      }
    } else {
      setStatus('Error: ' + e.message);
      return;
    }
  }

  state.idToken     = await cred.user.getIdToken();
  state.currentUser = { uid: cred.user.uid, email: cred.user.email, role: 'kid', name };
  saveFamilyId(famId);

  try {
    await api('/api/bootstrap', 'POST', { name, role: 'kid' });
  } catch (_) {}

  logEvent('kid_login_success', { uid: cred.user.uid, familyId: famId });
  setStatus('Signed in!');
  await refreshCatalog();
  await refreshState();
  showHub('kid');
}

/* ── Internal helpers ─────────────────────────────────────── */

async function _bootstrapAndEnter(user, role) {
  try {
    state.idToken = await user.getIdToken();
    await api('/api/bootstrap', 'POST', {
      name: user.displayName || user.email?.split('@')[0] || 'Admin',
      role: 'admin',
    });
  } catch (_) {}
  saveFamilyId(state.familyId);
  logEvent('login_success', { uid: user.uid, familyId: state.familyId });
  setStatus('Signed in');
  await refreshCatalog();
  await refreshState();
  showHub(role);
}

function _showFamilyIdBanner(familyId) {
  const banner = document.getElementById('familyIdBanner');
  if (!banner) return;
  const codeEl = document.getElementById('bannerFamilyId');
  if (codeEl) codeEl.textContent = familyId;
  banner.classList.remove('hidden');
}

/* ── Hub switching + sign-out ─────────────────────────────── */

export function showHub(role) {
  document.getElementById('loginCard')?.classList.add('hidden');
  document.getElementById('kidHub')?.classList.toggle('hidden', role !== 'kid');
  document.getElementById('parentHub')?.classList.toggle('hidden', role !== 'parent');
  const userBar = document.getElementById('userBar');
  if (userBar) {
    userBar.classList.remove('hidden');
    const emailEl = document.getElementById('userBarEmail');
    if (emailEl && state.currentUser) {
      emailEl.textContent = state.currentUser.email || state.currentUser.name || 'Signed in';
    }
  }
  const famDisplay = document.getElementById('userBarFamilyId');
  if (famDisplay && state.familyId) famDisplay.textContent = state.familyId;
}

export async function signOut() {
  logEvent('sign_out', {});
  try { await auth.signOut(); } catch (e) { logError('signOut', e); }
  state.currentUser = null;
  state.idToken     = null;
  state.familyId    = null;
  _pendingUser      = null;
  ['kidHub', 'parentHub', 'userBar'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
  const loginCard = document.getElementById('loginCard');
  if (loginCard) {
    loginCard.classList.remove('hidden');
    switchAuthTab('parent');
  }
  document.getElementById('landingSection')?.classList.remove('hidden');
  document.getElementById('appSection')?.classList.add('hidden');
}

/* ── Backward-compat stubs ────────────────────────────────── */
export const showAuthStep           = () => {};
export const resetPicker            = () => switchAuthTab('parent');
export const showAdmin              = () => {};
export const showKid                = () => switchAuthTab('kid');
export const familyIdInput          = () => document.getElementById('familyId')?.value.trim() || '';
export const setupFamily            = () => {};
export const createFamilyAndLogin   = () => {};
export const createFamilyWithGoogle = () => {};
export const linkGoogleToFamily     = () => {};
