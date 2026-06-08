/**
 * purchase.js — Purchase confirmation modal + buy flows.
 * Depends on: state.js, api.js, logger.js, wallet.js
 */

import { state }                              from './state.js';
import { api, setStatus, API_BASE }           from './api.js';
import { logEvent, logClick, logError, logTransaction } from './logger.js';
import { refreshState }                       from './wallet.js';

/* ---- Buy: screen time -------------------------------------- */

export async function buyScreen() {
  logClick('buyScreen', 'purchase_screen_time');
  try {
    const packageId = document.getElementById("screenPkg").value;
    if (!packageId) { setStatus("Error: Select a screen package"); return; }

    const appData    = await api("/api/state");
    const currentKid = _resolveKid(appData);
    if (!currentKid) return;

    if (!state.catalogData?.screen) await _ensureCatalog();
    const pkg = state.catalogData.screen.find(p => p.id === packageId);
    if (!pkg) { setStatus("Error: Package not found"); return; }

    const newBalance = currentKid.balance_gb - pkg.cost_gb;
    if (newBalance < 0) {
      setStatus(`Error: Insufficient funds. Need ${pkg.cost_gb} GB$, have ${currentKid.balance_gb.toFixed(2)} GB$`);
      return;
    }

    showPurchaseModal({
      type:           'screen',
      title:          'Buy Screen Time',
      itemName:       pkg.label,
      cost:           pkg.cost_gb,
      currentBalance: currentKid.balance_gb,
      newBalance,
      extraInfo:      `You'll receive ${pkg.minutes} minutes of screen time`,
      packageId,
      kidUid:         currentKid.kid_user_id,
    });
  } catch (e) {
    logError('buyScreen', e);
    setStatus("Error: " + e.message);
  }
}

/* ---- Buy: food --------------------------------------------- */

export async function buyFood() {
  logClick('buyFood', 'purchase_food');
  try {
    const itemId = document.getElementById("foodItem").value;
    if (!itemId) { setStatus("Error: Select a food item"); return; }

    const appData    = await api("/api/state");
    const currentKid = _resolveKid(appData);
    if (!currentKid) return;

    if (!state.catalogData?.food) await _ensureCatalog();
    const item = state.catalogData.food.find(f => f.id === itemId);
    if (!item) { setStatus("Error: Food item not found"); return; }

    const newBalance = currentKid.balance_gb - item.cost_gb;
    if (newBalance < 0) {
      setStatus(`Error: Insufficient funds. Need ${item.cost_gb} GB$, have ${currentKid.balance_gb.toFixed(2)} GB$`);
      return;
    }

    showPurchaseModal({
      type:           'food',
      title:          'Buy Food',
      itemName:       item.label,
      cost:           item.cost_gb,
      currentBalance: currentKid.balance_gb,
      newBalance,
      extraInfo:      `Category: ${item.category || 'Food'}`,
      itemId,
      kidUid:         currentKid.kid_user_id,
    });
  } catch (e) {
    logError('buyFood', e);
    setStatus("Error: " + e.message);
  }
}

/* ---- Modal ------------------------------------------------- */

export function showPurchaseModal(purchase) {
  state.pendingPurchase = purchase;

  document.getElementById("modalTitle").textContent        = purchase.title;
  document.getElementById("modalItemName").textContent     = purchase.itemName;
  document.getElementById("modalCost").textContent         = `-${purchase.cost.toFixed(2)} GB$`;
  document.getElementById("modalCurrentBalance").textContent = `${purchase.currentBalance.toFixed(2)} GB$`;

  const newBal   = document.getElementById("modalNewBalance");
  newBal.textContent = `${purchase.newBalance.toFixed(2)} GB$`;
  newBal.className   = purchase.newBalance < 0 ? "modal-value negative" : "modal-value";

  const extra = document.getElementById("modalExtraInfo");
  if (purchase.extraInfo) {
    extra.textContent    = purchase.extraInfo;
    extra.style.display  = "block";
  } else {
    extra.style.display  = "none";
  }

  const selectedId = purchase.type === 'screen' ? purchase.packageId : purchase.itemId;
  buildModalMenuGrid(purchase.type, selectedId);

  const modal = document.getElementById("purchaseModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.display = "flex";
    document.addEventListener("keydown", handleModalEscape);
    logEvent('purchase_modal_shown', { type: purchase.type, itemName: purchase.itemName, cost: purchase.cost });
  }
}

export function buildModalMenuGrid(type, selectedId) {
  const grid = document.getElementById("modalMenuGrid");
  if (!grid || !state.catalogData) return;

  const items = type === 'screen'
    ? (state.catalogData.screen || [])
    : (state.catalogData.food   || []);

  grid.innerHTML = items.map(item => {
    const isSelected = item.id === selectedId;
    const imgUrl     = item.image_url || (type === 'food' ? '/images/food/placeholder.jpg' : '/images/tablet_time/placeholder.jpg');
    const extraText  = type === 'screen' ? `→ ${item.minutes} min` : (item.category ? `(${item.category})` : '');
    return `
      <div class="modal-menu-item ${isSelected ? 'selected' : ''}" onclick="selectModalItem('${item.id}', '${type}')">
        <img src="${API_BASE}${imgUrl}" alt="${item.label}" onerror="this.style.display='none';"/>
        <div class="modal-menu-item-title">${item.label}</div>
        <div class="modal-menu-item-price">${item.cost_gb} GB$ ${extraText}</div>
      </div>`;
  }).join("");
}

export async function selectModalItem(itemId, type) {
  logClick('selectModalItem', 'modal_item_selected', { itemId, type });

  document.querySelectorAll('.modal-menu-item').forEach(el => el.classList.remove('selected'));
  event.currentTarget.classList.add('selected');

  const appData    = await api("/api/state");
  const currentKid = _resolveKid(appData);
  if (!currentKid) return;

  const item = type === 'screen'
    ? state.catalogData.screen.find(p => p.id === itemId)
    : state.catalogData.food.find(f => f.id === itemId);
  if (!item) { setStatus("Error: Item not found"); return; }

  const newBalance = currentKid.balance_gb - item.cost_gb;

  document.getElementById("modalItemName").textContent = item.label;
  document.getElementById("modalCost").textContent     = `-${item.cost_gb.toFixed(2)} GB$`;
  const newBal = document.getElementById("modalNewBalance");
  newBal.textContent = `${newBalance.toFixed(2)} GB$`;
  newBal.className   = newBalance < 0 ? "modal-value negative" : "modal-value";

  const extraInfo = document.getElementById("modalExtraInfo");
  extraInfo.textContent   = type === 'screen'
    ? `You'll receive ${item.minutes} minutes of screen time`
    : `Category: ${item.category || 'Food'}`;
  extraInfo.style.display = "block";

  state.pendingPurchase = {
    ...state.pendingPurchase,
    itemName:   item.label,
    cost:       item.cost_gb,
    newBalance,
    extraInfo:  extraInfo.textContent,
    [type === 'screen' ? 'packageId' : 'itemId']: itemId,
  };

  if (newBalance < 0) {
    setStatus(`Warning: Insufficient funds. Need ${item.cost_gb} GB$, have ${currentKid.balance_gb.toFixed(2)} GB$`);
  }
}

export function handleModalEscape(event) {
  if (event.key === "Escape" && !document.getElementById("purchaseModal").classList.contains("hidden")) {
    closePurchaseModal();
  }
}

export function closePurchaseModal() {
  const modal = document.getElementById("purchaseModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
    document.removeEventListener("keydown", handleModalEscape);
    state.pendingPurchase = null;
    logEvent('purchase_modal_cancelled');
  }
}

export async function confirmPurchase() {
  if (!state.pendingPurchase) return;
  logClick('confirmPurchase', 'purchase_confirmed', { type: state.pendingPurchase.type });

  const confirmBtn = document.querySelector('.modal-confirm');
  const origText   = confirmBtn.textContent;
  confirmBtn.textContent = "Processing...";
  confirmBtn.disabled    = true;

  try {
    if (state.pendingPurchase.type === 'screen') {
      logTransaction('purchase_screen', { packageId: state.pendingPurchase.packageId });
      await api("/api/purchase_screen", "POST", { package_id: state.pendingPurchase.packageId });
      logTransaction('purchase_screen_success', { packageId: state.pendingPurchase.packageId });
      setStatus("Screen time purchased!");
    } else if (state.pendingPurchase.type === 'food') {
      logTransaction('purchase_food', { itemId: state.pendingPurchase.itemId });
      await api("/api/purchase_food", "POST", { item_id: state.pendingPurchase.itemId });
      logTransaction('purchase_food_success', { itemId: state.pendingPurchase.itemId });
      setStatus("Food purchased!");
    }

    await refreshState();

    const appData    = await api("/api/state");
    const currentKid = _resolveKid(appData);
    if (currentKid) {
      document.getElementById("modalCurrentBalance").textContent = `${currentKid.balance_gb.toFixed(2)} GB$`;
      document.getElementById("modalNewBalance").textContent     = `${currentKid.balance_gb.toFixed(2)} GB$`;
      document.getElementById("modalNewBalance").className       = "modal-value positive";
      const extra = document.getElementById("modalExtraInfo");
      extra.textContent   = "✅ Purchase successful! Balance updated.";
      extra.style.display = "block";
      extra.style.color   = "#34d399";

      setTimeout(() => {
        closePurchaseModal();
        logEvent('purchase_completed', { type: state.pendingPurchase?.type, newBalance: currentKid.balance_gb });
      }, 1500);
    } else {
      closePurchaseModal();
      logEvent('purchase_completed', { type: state.pendingPurchase?.type });
    }
  } catch (e) {
    logError('confirmPurchase', e);
    setStatus("Error: " + e.message);
    confirmBtn.textContent = origText;
    confirmBtn.disabled    = false;
  }
}

/* ---- Private helpers --------------------------------------- */

function _resolveKid(appData) {
  if (state.currentUser?.role === 'kid') {
    const kid = appData.kids.find(k => k.kid_user_id === state.currentUser.uid);
    if (!kid) { setStatus("Error: Kid not found"); return null; }
    return kid;
  }
  if (appData.kids?.length > 0) {
    setStatus("Note: Using first kid's balance for preview");
    return appData.kids[0];
  }
  setStatus("Error: No kids found");
  return null;
}

async function _ensureCatalog() {
  // Lazy-load catalog if it somehow hasn't been fetched yet
  const { refreshCatalog } = await import('./catalog.js');
  await refreshCatalog();
}
