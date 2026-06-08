/**
 * members.js — Add, remove, and reset family members.
 * Depends on: state.js, api.js, logger.js, wallet.js
 */

import { api, setStatus }               from './api.js';
import { logEvent, logClick, logError } from './logger.js';
import { refreshState }                 from './wallet.js';

export async function addMember() {
  logClick('addMember', 'admin_add_member');
  try {
    const name = document.getElementById("addMemberName").value.trim();
    const role = document.getElementById("addMemberRole").value;
    const uid  = document.getElementById("addMemberUid").value.trim();

    if (!name) { setStatus("Error: Name required"); return; }
    if (!uid)  { setStatus("Error: Firebase UID required. Create account in Firebase Auth first, then add here."); return; }

    logEvent('member_add_attempt', { name, role, uid });
    await api("/api/admin/add_member", "POST", { uid, name, role });
    logEvent('member_add_success', { name, role, uid });
    await refreshState();
    setStatus(`Member ${name} added as ${role}`);

    document.getElementById("addMemberName").value = "";
    document.getElementById("addMemberUid").value  = "";
  } catch (e) {
    logError('addMember', e);
    setStatus("Error: " + e.message);
  }
}

export async function removeMember() {
  logClick('removeMember', 'admin_remove_member');
  try {
    const input = document.getElementById("removeMemberUid").value.trim();
    if (!input) { setStatus("Error: UID or name required"); return; }

    if (!confirm(`Remove member "${input}"? This will delete their membership, wallet, and session data.`)) return;

    let uid = input;
    try {
      const appData = await api("/api/state");
      const kid     = appData.kids.find(k => k.name.toLowerCase() === input.toLowerCase());
      if (kid) uid  = kid.kid_user_id;
    } catch (_) { /* use input as uid */ }

    logEvent('member_remove_attempt', { uid, input });
    await api("/api/admin/remove_member", "POST", { uid });
    logEvent('member_remove_success', { uid });
    await refreshState();
    setStatus("Member removed");
    document.getElementById("removeMemberUid").value = "";
  } catch (e) {
    logError('removeMember', e);
    setStatus("Error: " + e.message);
  }
}

export async function resetKid() {
  logClick('resetKid', 'admin_reset_kid');
  try {
    const input = document.getElementById("resetKidUid").value.trim();
    if (!input) { setStatus("Error: UID or name required"); return; }

    let uid = input;
    try {
      const appData = await api("/api/state");
      const kid     = appData.kids.find(k => k.name.toLowerCase() === input.toLowerCase());
      if (kid) uid  = kid.kid_user_id;
    } catch (_) { /* use input as uid */ }

    const balance = parseFloat(document.getElementById("resetBalance").value) || 0.0;
    const minutes = parseInt(document.getElementById("resetMinutes").value)    || 0;
    const locked  = document.getElementById("resetLocked").checked;

    if (!confirm(`Reset kid to GB$${balance}, ${minutes} min, ${locked ? 'locked' : 'unlocked'}?`)) return;

    logEvent('kid_reset_attempt', { uid, balance, minutes, locked });
    await api("/api/admin/reset_kid", "POST", { uid, balance_gb: balance, minutes, locked });
    logEvent('kid_reset_success', { uid, balance, minutes, locked });
    await refreshState();
    setStatus(`Kid reset: GB$${balance}, ${minutes} min, ${locked ? 'locked' : 'unlocked'}`);

    document.getElementById("resetKidUid").value   = "";
    document.getElementById("resetBalance").value  = "";
    document.getElementById("resetMinutes").value  = "";
    document.getElementById("resetLocked").checked = false;
  } catch (e) {
    logError('resetKid', e);
    setStatus("Error: " + e.message);
  }
}

export async function quickResetKid(uid, name) {
  logClick('quickResetKid', 'admin_quick_reset', { uid, name });
  if (!confirm(`Reset ${name} to GB$0, 0 minutes, unlocked?`)) return;
  try {
    logEvent('kid_reset_attempt', { uid, balance: 0, minutes: 0, locked: false });
    await api("/api/admin/reset_kid", "POST", { uid, balance_gb: 0.0, minutes: 0, locked: false });
    logEvent('kid_reset_success', { uid, balance: 0, minutes: 0, locked: false });
    await refreshState();
    setStatus(`${name} reset to zero`);
  } catch (e) {
    logError('quickResetKid', e);
    setStatus("Error: " + e.message);
  }
}
