/**
 * admin.js — Admin actions: daily allotment, rewards, consequences.
 * Depends on: api.js, logger.js, wallet.js
 */

import { api, setStatus }                     from './api.js';
import { logClick, logError, logTransaction } from './logger.js';
import { refreshState }                       from './wallet.js';

export async function dailyAllotment() {
  logClick('dailyAllotment', 'admin_allotment');
  try {
    const amounts = JSON.parse(document.getElementById("allotment").value);
    logTransaction('daily_allotment', { amounts });
    await api("/api/daily_allotment", "POST", { amounts });
    logTransaction('daily_allotment_success', { amounts });
    await refreshState();
    setStatus("Allotment applied");
  } catch (e) {
    logError('dailyAllotment', e);
    setStatus("Error: " + e.message);
  }
}

export async function rewardKid() {
  logClick('rewardKid', 'admin_reward');
  try {
    const kidName  = document.getElementById("rewardKid").value;
    const actionId = document.getElementById("rewardAction").value;
    logTransaction('reward', { kidName, actionId });
    await api("/api/reward", "POST", { kid_name: kidName, action_id: actionId });
    logTransaction('reward_success', { kidName, actionId });
    await refreshState();
    setStatus("Reward applied");
  } catch (e) {
    logError('rewardKid', e);
    setStatus("Error: " + e.message);
  }
}

export async function timePunish() {
  logClick('timePunish', 'admin_consequence_time');
  try {
    const kidName       = document.getElementById("timeKid").value;
    const consequenceId = document.getElementById("timeConsequence").value;
    logTransaction('consequence_time', { kidName, consequenceId });
    await api("/api/consequence_time", "POST", { kid_name: kidName, consequence_id: consequenceId });
    logTransaction('consequence_time_success', { kidName, consequenceId });
    await refreshState();
    setStatus("Time consequence applied");
  } catch (e) {
    logError('timePunish', e);
    setStatus("Error: " + e.message);
  }
}

export async function moneyPunish() {
  logClick('moneyPunish', 'admin_consequence_money');
  try {
    const kidName       = document.getElementById("moneyKid").value;
    const consequenceId = document.getElementById("moneyConsequence").value;
    logTransaction('consequence_money', { kidName, consequenceId });
    await api("/api/consequence_money", "POST", { kid_name: kidName, consequence_id: consequenceId });
    logTransaction('consequence_money_success', { kidName, consequenceId });
    await refreshState();
    setStatus("Money consequence applied");
  } catch (e) {
    logError('moneyPunish', e);
    setStatus("Error: " + e.message);
  }
}

// ---------------------------------------------------------------------------
// Admin visual menu view (mirrors toggleMenuView / showFoodMenu etc for the
// admin-side menu reference cards in index.html)
// ---------------------------------------------------------------------------

export function toggleAdminMenuView() {
  const visual   = document.getElementById('adminVisualMenus');
  const dropdown = document.getElementById('adminDropdownMenus');
  const btn      = document.getElementById('adminMenuViewToggle');
  if (!visual || !dropdown) return;
  const isVisual = !visual.classList.contains('hidden');
  visual.classList.toggle('hidden', isVisual);
  dropdown.classList.toggle('hidden', !isVisual);
  if (btn) btn.textContent = isVisual ? '🖼️ Visual View' : '📋 List View';
}

export function showAdminFoodMenu() {
  _showAdminMenu('adminFoodMenuGrid', 'food');
}

export function showAdminScreenMenu() {
  _showAdminMenu('adminScreenMenuGrid', 'screen');
}

export function showAdminLearningMenu() {
  _showAdminMenu('adminLearningMenuGrid', 'learning');
}

function _showAdminMenu(activeId, type) {
  const grids = ['adminFoodMenuGrid', 'adminScreenMenuGrid', 'adminLearningMenuGrid'];
  grids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== activeId);
  });
  logClick('showAdminMenu', type);
}
