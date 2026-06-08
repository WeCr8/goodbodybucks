/**
 * app.js — Application entry point.
 *
 * Imports all feature modules and exposes functions on `window` so that
 * inline HTML onclick= attributes can reach them (ES modules are not
 * automatically global).
 *
 * Also handles: DOMContentLoaded init, PWA service-worker registration.
 */

import './config.js'; // side-effect: firebase.initializeApp
import { mountDevtools } from './debug.js';

import { renderAcademyHub, applyAcademyAllotment, focusAcademyReward } from './academy.js';
import {
  resetPicker, showAdmin, showKid, loginAdmin, loginKid, familyIdInput,
  setupFamily, showHub, signOut,
  loginWithGoogle, loginWithApple,
  createFamilyAndLogin, createFamilyWithGoogle, linkGoogleToFamily, showAuthStep,
  switchAuthTab, handleRedirectResult, finishFamilySetup,
  loginKidWithGoogle,
} from './auth.js';
import {
  refreshCatalog,
  toggleMenuView, showFoodMenu, showScreenMenu, showLearningMenu,
  selectFoodItem, selectScreenItem,
} from './catalog.js';
import { refreshState, viewHistory }       from './wallet.js';
import {
  buyScreen, buyFood,
  selectModalItem, closePurchaseModal, confirmPurchase,
} from './purchase.js';
import { startSession, stopSession }       from './session.js';
import { dailyAllotment, rewardKid, timePunish, moneyPunish,
         toggleAdminMenuView, showAdminFoodMenu, showAdminScreenMenu, showAdminLearningMenu } from './admin.js';
import { addMember, removeMember, resetKid, quickResetKid, addKid } from './members.js';

/* ---- Tab switcher (used by hub nav onclick) --------------- */
function switchTab(hubId, tabId) {
  const hub = document.getElementById(hubId);
  if (!hub) return;
  hub.querySelectorAll('.hub-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  hub.querySelectorAll('.hub-panel').forEach(p => p.classList.toggle('active', p.id === tabId));
}

/* ---- Expose to global scope for onclick= HTML attributes --- */
Object.assign(window, {
  // auth
  resetPicker,
  showAdmin,
  showKid,
  loginAdmin,
  loginKid,
  familyIdInput,
  setupFamily,
  showHub,
  signOut,
  loginWithGoogle,
  loginWithApple,
  createFamilyAndLogin,
  createFamilyWithGoogle,
  linkGoogleToFamily,
  showAuthStep,
  switchAuthTab,
  finishFamilySetup,
  loginKidWithGoogle,
  switchTab,
  // catalog / menus
  refreshCatalog,
  toggleMenuView,
  showFoodMenu,
  showScreenMenu,
  showLearningMenu,
  selectFoodItem,
  selectScreenItem,
  // wallet
  refreshState,
  viewHistory,
  // purchase
  buyScreen,
  buyFood,
  selectModalItem,
  closePurchaseModal,
  confirmPurchase,
  // session
  startSession,
  stopSession,
  // admin
  dailyAllotment,
  rewardKid,
  timePunish,
  moneyPunish,
  toggleAdminMenuView,
  showAdminFoodMenu,
  showAdminScreenMenu,
  showAdminLearningMenu,
  // members
  addMember,
  removeMember,
  resetKid,
  quickResetKid,
  addKid,
  // academy
  applyAcademyAllotment,
  focusAcademyReward,
});

/* ---- DOMContentLoaded init --------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  // Mount __gb DevTools namespace (always — gated internally by debug.js)
  mountDevtools();

  // Render academy hub materials
  renderAcademyHub();

  // Init auth tab and handle Google redirect result
  switchAuthTab('parent');
  handleRedirectResult();

  // Ensure purchase modal is hidden on page load
  const modal = document.getElementById("purchaseModal");
  if (modal) modal.classList.add("hidden");
});

// Safety: force close modal after full page load
window.addEventListener("load", () => {
  closePurchaseModal();
});

/* ---- PWA: service worker ----------------------------------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
