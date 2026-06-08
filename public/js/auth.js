/**
 * auth.js — Authentication flows: role picker, admin login, kid login.
 * Depends on: state.js, config.js, api.js, logger.js
 */

import { state }                              from './state.js';
import { auth }                               from './config.js';
import { api, setStatus, API_BASE }           from './api.js';
import { logEvent, logClick, logError }       from './logger.js';
import { refreshCatalog }                     from './catalog.js';
import { refreshState }                       from './wallet.js';

/* ---- Role picker ------------------------------------------- */

export function resetPicker() {
  document.getElementById("adminBox").classList.add("hidden");
  document.getElementById("kidBox").classList.add("hidden");
  document.getElementById("rolePicker").classList.remove("hidden");
  document.querySelectorAll(".auth-picker-card").forEach(c => c.classList.remove("active"));
}

export function showAdmin() {
  logClick('showAdmin', 'login_mode_switch', { mode: 'admin' });
  document.getElementById("rolePicker").classList.add("hidden");
  document.getElementById("adminBox").classList.remove("hidden");
  document.getElementById("kidBox").classList.add("hidden");
  document.getElementById("pickAdmin").classList.add("active");
  document.getElementById("pickKid").classList.remove("active");
}

export function showKid() {
  logClick('showKid', 'login_mode_switch', { mode: 'kid' });
  document.getElementById("rolePicker").classList.add("hidden");
  document.getElementById("kidBox").classList.remove("hidden");
  document.getElementById("adminBox").classList.add("hidden");
  document.getElementById("pickKid").classList.add("active");
  document.getElementById("pickAdmin").classList.remove("active");
}

export function familyIdInput() {
  return document.getElementById("familyId").value.trim();
}

/* ---- Family setup ------------------------------------------ */

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
    logEvent('family_setup_success', { familyId: state.familyId, familyName: name });
    setStatus("Family created: " + state.familyId);
  } catch (e) {
    logError('setupFamily', e);
    setStatus("Error: " + e.message);
    console.error("Setup family error:", e);
  }
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
  } catch (e) {
    logError('loginKid', e);
    setStatus("Error: " + e.message);
    console.error("Kid login error:", e);
  }
}
