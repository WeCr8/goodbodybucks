/**
 * auth.js — Authentication flows: role picker, admin login, kid login, Google/Apple.
 * Depends on: state.js, config.js, api.js, logger.js
 */

import { state }                              from './state.js';
import { auth }                               from './config.js';
import { api, setStatus, API_BASE }           from './api.js';
import { logEvent, logClick, logError }       from './logger.js';
import { refreshCatalog }                     from './catalog.js';
import { refreshState }                       from './wallet.js';

/* ---- localStorage family ID -------------------------------- */
const LS_FAM_KEY = 'gbucks_fam';
function saveFamilyId(id) { try { localStorage.setItem(LS_FAM_KEY, id); } catch(_) {} }
function loadFamilyId()   { try { return localStorage.getItem(LS_FAM_KEY) || ''; } catch(_) { return ''; } }

/* ---- Auth wizard step switcher ----------------------------- */
const AUTH_STEPS = {
  'step0':           'authStep0',
  'new-family':      'authNewFamily',
  'role-picker':     'authRolePicker',
  'admin-form':      'adminBox',
  'kid-form':        'kidBox',
  'google-link':     'authGoogleLink',
};

export function showAuthStep(step) {
  Object.values(AUTH_STEPS).forEach(id => document.getElementById(id)?.classList.add('hidden'));
  const targetId = AUTH_STEPS[step];
  if (targetId) document.getElementById(targetId)?.classList.remove('hidden');

  if (step === 'role-picker') {
    const saved = loadFamilyId();
    const hidden  = document.getElementById('familyId');
    const visible = document.getElementById('familyIdVisible');
    if (saved) {
      if (hidden && !hidden.value)   hidden.value   = saved;
      if (visible && !visible.value) visible.value  = saved;
    }
  }
}

/* ---- Role picker ------------------------------------------- */

export function resetPicker() {
  showAuthStep('role-picker');
  document.querySelectorAll(".auth-picker-card").forEach(c => c.classList.remove("active"));
}

export function showAdmin() {
  logClick('showAdmin', 'login_mode_switch', { mode: 'admin' });
  // Copy visible familyId input into hidden field before switching step
  const vis = document.getElementById('familyIdVisible');
  const hid = document.getElementById('familyId');
  if (vis && hid) hid.value = vis.value.trim();
  document.getElementById("pickAdmin")?.classList.add("active");
  document.getElementById("pickKid")?.classList.remove("active");
  showAuthStep('admin-form');
}

export function showKid() {
  logClick('showKid', 'login_mode_switch', { mode: 'kid' });
  // Copy visible familyId input into hidden field before switching step
  const vis = document.getElementById('familyIdVisible');
  const hid = document.getElementById('familyId');
  if (vis && hid) hid.value = vis.value.trim();
  document.getElementById("pickKid")?.classList.add("active");
  document.getElementById("pickAdmin")?.classList.remove("active");
  showAuthStep('kid-form');
}

export function familyIdInput() {
  return document.getElementById("familyId")?.value.trim() || '';
}

/* ---- Family setup (from Parent Hub settings, not login) ---- */

export async function setupFamily() {
  logClick('setupFamily', 'create_family');
  try {
    const name = document.getElementById("familyName").value;
    if (!name) {
      logError('setupFamily', new Error('Family name required'));
      setStatus("Error: Family name required");
      return;
    }
    logEvent('family_setup_start', { familyName: name });

    const url = API_BASE + "/api/setup_family";
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ family_name: name }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      const error   = new Error(errData.error || `Server error: ${res.status}`);
      logError('setupFamily', error);
      throw error;
    }

    const data = await res.json();
    if (!data.ok) {
      const error = new Error(data.error);
      logError('setupFamily', error);
      throw error;
    }

    state.familyId = data.family_id;
    document.getElementById("familyId").value = state.familyId;
    saveFamilyId(state.familyId);
    logEvent('family_setup_success', { familyId: state.familyId, familyName: name });
    setStatus("Family created: " + state.familyId);
  } catch (e) {
    logError('setupFamily', e);
    setStatus("Error: " + e.message);
    console.error("Setup family error:", e);
  }
}

/* ---- Create family + login (new family, email flow) -------- */

export async function createFamilyAndLogin() {
  logClick('createFamilyAndLogin', 'new_family_signup');
  try {
    const familyName = document.getElementById("newFamilyName").value.trim();
    const email      = document.getElementById("newAdminEmail").value.trim();
    const pass       = document.getElementById("newAdminPass").value;

    if (!familyName) { setStatus("Enter a family name"); return; }
    if (!email || !pass) { setStatus("Email and password required"); return; }
    if (pass.length < 6) { setStatus("Password must be at least 6 characters"); return; }

    setStatus("Creating your family...");
    logEvent('new_family_start', { familyName, email });

    // 1. Create Firebase auth account
    let cred;
    try {
      cred = await auth.createUserWithEmailAndPassword(email, pass);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        cred = await auth.signInWithEmailAndPassword(email, pass);
      } else {
        throw e;
      }
    }

    state.idToken     = await cred.user.getIdToken();
    state.currentUser = { uid: cred.user.uid, email: cred.user.email, role: 'admin' };

    // 2. Create the family in Firestore (no auth required)
    const setupRes = await fetch(API_BASE + "/api/setup_family", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ family_name: familyName }),
    });
    const setupData = await setupRes.json();
    if (!setupData.ok) throw new Error(setupData.error || "Failed to create family");

    state.familyId = setupData.family_id;
    saveFamilyId(state.familyId);
    logEvent('new_family_created', { familyId: state.familyId, familyName });

    // 3. Bootstrap admin membership
    try {
      await api("/api/bootstrap", "POST", { name: familyName + " Admin", role: "admin" });
    } catch (_) { /* may already exist */ }

    setStatus("Family created! Family ID: " + state.familyId);
    _showFamilyIdBanner(state.familyId);
    logEvent('new_family_login_success', { uid: cred.user.uid, familyId: state.familyId });

    await refreshCatalog();
    await refreshState();
    showHub('parent');
  } catch (e) {
    logError('createFamilyAndLogin', e);
    setStatus("Error: " + e.message);
    console.error("Create family error:", e);
  }
}

/* ---- Google sign-in --------------------------------------- */

export async function loginWithGoogle() {
  logClick('loginWithGoogle', 'google_signin');
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    setStatus("Opening Google sign-in...");

    const result  = await auth.signInWithPopup(provider);
    state.idToken     = await result.user.getIdToken();
    state.currentUser = { uid: result.user.uid, email: result.user.email, role: 'admin' };

    logEvent('google_signin_success', { uid: result.user.uid });

    // Check if familyId is already known (from role-picker input or localStorage)
    const famIdEl  = document.getElementById('familyId');
    const famIdVis = document.getElementById('familyIdVisible');
    const famId    = (famIdEl?.value.trim()) || (famIdVis?.value.trim()) || loadFamilyId();

    if (famId) {
      state.familyId = famId;
      await _bootstrapAndEnter(result.user, 'parent');
    } else {
      // Need family — show link step
      setStatus("Signed in with Google! Now link your family.");
      showAuthStep('google-link');
      document.getElementById('loginCard')?.classList.remove('hidden');
    }
  } catch (e) {
    if (e.code && e.code !== 'auth/popup-closed-by-user') {
      logError('loginWithGoogle', e);
      setStatus("Google sign-in error: " + e.message);
    } else {
      setStatus("");
    }
  }
}

/* ---- Apple sign-in ---------------------------------------- */

export async function loginWithApple() {
  logClick('loginWithApple', 'apple_signin');
  try {
    const provider = new firebase.auth.OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    setStatus("Opening Apple sign-in...");

    const result  = await auth.signInWithPopup(provider);
    state.idToken     = await result.user.getIdToken();
    state.currentUser = { uid: result.user.uid, email: result.user.email, role: 'admin' };

    logEvent('apple_signin_success', { uid: result.user.uid });

    const famIdEl = document.getElementById('familyId');
    const famId   = (famIdEl?.value.trim()) || loadFamilyId();

    if (famId) {
      state.familyId = famId;
      await _bootstrapAndEnter(result.user, 'parent');
    } else {
      setStatus("Signed in with Apple! Now link your family.");
      showAuthStep('google-link'); // reuses same link step
      document.getElementById('loginCard')?.classList.remove('hidden');
    }
  } catch (e) {
    if (e.code === 'auth/operation-not-allowed') {
      setStatus("Apple sign-in is not yet configured. Please use Google or email.");
    } else if (e.code && e.code !== 'auth/popup-closed-by-user') {
      logError('loginWithApple', e);
      setStatus("Apple sign-in error: " + e.message);
    } else {
      setStatus("");
    }
  }
}

/* ---- Post-Google/Apple: create new family or link existing - */

export async function createFamilyWithGoogle() {
  logClick('createFamilyWithGoogle', 'google_new_family');
  try {
    const nameEl = document.getElementById("googleFamilyName");
    const familyName = nameEl?.value.trim();
    if (!familyName) { setStatus("Enter a family name"); return; }
    if (!auth.currentUser) { setStatus("Please sign in first"); return; }

    setStatus("Creating your family...");
    state.idToken = await auth.currentUser.getIdToken();

    const setupRes = await fetch(API_BASE + "/api/setup_family", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ family_name: familyName }),
    });
    const setupData = await setupRes.json();
    if (!setupData.ok) throw new Error(setupData.error || "Failed to create family");

    state.familyId = setupData.family_id;
    saveFamilyId(state.familyId);
    logEvent('google_new_family_created', { familyId: state.familyId, familyName });

    try {
      await api("/api/bootstrap", "POST", { name: familyName + " Admin", role: "admin" });
    } catch (_) {}

    setStatus("Family created! ID: " + state.familyId);
    _showFamilyIdBanner(state.familyId);
    await refreshCatalog();
    await refreshState();
    showHub('parent');
  } catch (e) {
    logError('createFamilyWithGoogle', e);
    setStatus("Error: " + e.message);
  }
}

export async function linkGoogleToFamily() {
  logClick('linkGoogleToFamily', 'google_link_family');
  try {
    const famId = document.getElementById("googleLinkFamilyId")?.value.trim();
    if (!famId) { setStatus("Enter your Family ID"); return; }
    if (!auth.currentUser) { setStatus("Please sign in first"); return; }

    state.idToken  = await auth.currentUser.getIdToken();
    state.familyId = famId;
    saveFamilyId(famId);

    await _bootstrapAndEnter(auth.currentUser, 'parent');
  } catch (e) {
    logError('linkGoogleToFamily', e);
    setStatus("Error: " + e.message);
  }
}

/* ---- Internal: bootstrap + enter hub ----------------------- */

async function _bootstrapAndEnter(user, role) {
  try {
    state.idToken = await user.getIdToken();
    await api("/api/bootstrap", "POST", {
      name: user.displayName || user.email?.split('@')[0] || 'Admin',
      role: "admin"
    });
  } catch (_) {}
  saveFamilyId(state.familyId);
  logEvent('login_success_social', { uid: user.uid, familyId: state.familyId });
  setStatus("Signed in");
  await refreshCatalog();
  await refreshState();
  showHub(role);
}

/* ---- Show Family ID banner after account creation ---------- */

function _showFamilyIdBanner(familyId) {
  const banner = document.getElementById('familyIdBanner');
  if (!banner) return;
  const codeEl = banner.querySelector('#bannerFamilyId');
  if (codeEl) codeEl.textContent = familyId;
  banner.classList.remove('hidden');
}

/* ---- Admin login ------------------------------------------- */

export async function loginAdmin() {
  logClick('loginAdmin', 'admin_login_attempt');
  try {
    state.familyId = familyIdInput();
    if (!state.familyId) { setStatus("Enter Family ID"); return; }

    const email = document.getElementById("adminEmail").value.trim();
    const pass  = document.getElementById("adminPass").value;
    logEvent('admin_login_start', { email, familyId: state.familyId, hasPassword: !!pass });

    if (!email || !pass) {
      logError('loginAdmin', new Error('Email and password required'));
      setStatus("Error: Email and password required");
      return;
    }
    if (pass.length < 6) {
      logError('loginAdmin', new Error('Password too short'));
      setStatus("Error: Password must be at least 6 characters");
      return;
    }

    let cred;
    let accountCreated = false;
    try {
      logEvent('admin_auth_attempt', { method: 'signin' });
      cred = await auth.signInWithEmailAndPassword(email, pass);
      logEvent('admin_auth_success', { method: 'signin' });
    } catch (signInError) {
      const code = signInError.code || '';
      logError('admin_auth_signin', signInError);
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setStatus("Account not found or wrong password. Creating account...");
        logEvent('admin_account_creation_attempt', { email });
        try {
          cred           = await auth.createUserWithEmailAndPassword(email, pass);
          accountCreated = true;
          logEvent('admin_account_created', { email });
          setStatus("Account created! Logging in...");
        } catch (createError) {
          const cc = createError.code || '';
          logError('admin_account_creation', createError);
          if (cc === 'auth/email-already-in-use') {
            setStatus("Error: Email exists. Password may be wrong. Use Firebase Console to reset.");
          } else if (cc === 'auth/weak-password') {
            setStatus("Error: Password must be at least 6 characters");
          } else {
            setStatus("Error: " + (createError.message || cc));
          }
          return;
        }
      } else {
        setStatus("Error: " + signInError.message + " (Code: " + code + ")");
        return;
      }
    }

    state.idToken     = await cred.user.getIdToken();
    state.currentUser = { uid: cred.user.uid, email: cred.user.email, role: 'admin' };
    saveFamilyId(state.familyId);

    try {
      logEvent('admin_bootstrap_attempt', { uid: cred.user.uid });
      await api("/api/bootstrap", "POST", { name: email.split("@")[0], role: "admin" });
      logEvent('admin_bootstrap_success', { uid: cred.user.uid });
    } catch (e) {
      logEvent('admin_bootstrap_skipped', { reason: e.message });
    }

    logEvent('admin_login_success', { uid: cred.user.uid, email, accountCreated, familyId: state.familyId });
    setStatus("Admin logged in");
    await refreshCatalog();
    await refreshState();
    showHub('parent');
  } catch (e) {
    logError('loginAdmin', e);
    setStatus("Error: " + e.message);
    console.error("Login error:", e);
  }
}

/* ---- Kid login --------------------------------------------- */

export async function loginKid() {
  try {
    state.familyId = familyIdInput();
    if (!state.familyId) { setStatus("Enter Family ID"); return; }

    const name  = document.getElementById("kidName").value.toLowerCase().replace(/\s+/g, "");
    const email = `${name}.${state.familyId}@gbucks.local`;
    const pin   = document.getElementById("kidPin").value;

    if (pin.length < 6) {
      setStatus("Error: PIN must be at least 6 characters (Firebase requirement)");
      return;
    }

    let cred;
    let accountCreated = false;
    try {
      logEvent('kid_auth_attempt', { method: 'signin', email });
      cred = await auth.signInWithEmailAndPassword(email, pin);
      logEvent('kid_auth_success', { method: 'signin' });
    } catch (signInError) {
      const code = signInError.code || '';
      logError('kid_auth_signin', signInError);
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        try {
          logEvent('kid_account_creation_attempt', { email, kidName: name });
          cred           = await auth.createUserWithEmailAndPassword(email, pin);
          accountCreated = true;
          logEvent('kid_account_created', { email, kidName: name });
          setStatus("Kid account created!");
        } catch (createError) {
          const cc = createError.code || '';
          logError('kid_account_creation', createError);
          setStatus("Error: " + (createError.message || cc));
          return;
        }
      } else {
        setStatus("Error: " + (signInError.message || code));
        return;
      }
    }

    state.idToken     = await cred.user.getIdToken();
    state.currentUser = { uid: cred.user.uid, email: cred.user.email, role: 'kid', name };
    saveFamilyId(state.familyId);

    try {
      logEvent('kid_bootstrap_attempt', { uid: cred.user.uid, kidName: name });
      await api("/api/bootstrap", "POST", { name: name.charAt(0).toUpperCase() + name.slice(1), role: "kid" });
      logEvent('kid_bootstrap_success', { uid: cred.user.uid });
    } catch (e) {
      logEvent('kid_bootstrap_skipped', { reason: e.message });
    }

    logEvent('kid_login_success', { uid: cred.user.uid, email, kidName: name, accountCreated, familyId: state.familyId });
    setStatus("Kid logged in");
    await refreshCatalog();
    await refreshState();
    showHub('kid');
  } catch (e) {
    logError('loginKid', e);
    setStatus("Error: " + e.message);
    console.error("Kid login error:", e);
  }
}

/* ---- Hub switching + sign-out ----------------------------- */

export function showHub(role) {
  document.getElementById('loginCard').classList.add('hidden');
  const kidHub    = document.getElementById('kidHub');
  const parentHub = document.getElementById('parentHub');
  if (kidHub)    kidHub.classList.toggle('hidden', role !== 'kid');
  if (parentHub) parentHub.classList.toggle('hidden', role !== 'parent');
  const userBar = document.getElementById('userBar');
  if (userBar) {
    userBar.classList.remove('hidden');
    const emailEl = document.getElementById('userBarEmail');
    if (emailEl && state.currentUser) {
      emailEl.textContent = state.currentUser.email || state.currentUser.name || 'Signed in';
    }
  }
  // Show family ID in dashboard after login
  const famDisplay = document.getElementById('userBarFamilyId');
  if (famDisplay && state.familyId) famDisplay.textContent = state.familyId;
}

export async function signOut() {
  logEvent('sign_out', {});
  try { await auth.signOut(); } catch (e) { logError('signOut', e); }
  state.currentUser = null;
  state.idToken     = null;
  state.familyId    = null;
  const ids = ['kidHub', 'parentHub', 'userBar'];
  ids.forEach(id => document.getElementById(id)?.classList.add('hidden'));
  const loginCard = document.getElementById('loginCard');
  if (loginCard) {
    loginCard.classList.remove('hidden');
    showAuthStep('step0');
  }
  // Return to landing
  document.getElementById('landingSection')?.classList.remove('hidden');
  document.getElementById('appSection')?.classList.add('hidden');
}

