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
import { resetPicker, showAdmin, showKid, loginAdmin, loginKid, familyIdInput, setupFamily } from './auth.js';
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
import { addMember, removeMember, resetKid, quickResetKid }   from './members.js';

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
