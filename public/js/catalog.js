/**
 * catalog.js — Catalog data, visual menu grids, and item selection.
 * Depends on: state.js, api.js, logger.js, purchase.js
 */

import { state }                          from './state.js';
import { api, setStatus, API_BASE }       from './api.js';
import { logEvent, logClick, logError }   from './logger.js';
import { buyFood, buyScreen }             from './purchase.js';

/* ---- Catalog fetch ----------------------------------------- */

export async function refreshCatalog() {
  logEvent('catalog_refresh_start');
  try {
    const cfg = (await api("/api/catalog")).config;
    state.catalogData = cfg;
    logEvent('catalog_refresh_success', {
      screenPackages: cfg.screen?.length  || 0,
      foodItems:      cfg.food?.length    || 0,
      rewards:        cfg.rewards?.length || 0,
    });

    // Populate dropdowns (fallback when visual menus are hidden)
    document.getElementById("screenPkg").innerHTML = cfg.screen.map(
      x => `<option value="${x.id}">${x.label} (${x.cost_gb} GB$)</option>`).join("");
    document.getElementById("foodItem").innerHTML = cfg.food.map(x => {
      const imgUrl = x.image_url || '/images/food/placeholder.jpg';
      return `<option value="${x.id}" data-image="${imgUrl}">${x.label} (${x.cost_gb} GB$)</option>`;
    }).join("");
    document.getElementById("rewardAction").innerHTML = cfg.rewards.map(
      x => `<option value="${x.id}">${x.label}</option>`).join("");
    document.getElementById("timeConsequence").innerHTML = cfg.time_consequences.map(
      x => `<option value="${x.id}">${x.label}</option>`).join("");
    document.getElementById("moneyConsequence").innerHTML = cfg.money_consequences.map(
      x => `<option value="${x.id}">${x.label}</option>`).join("");

    // Build visual menu grids
    buildFoodMenuGrid(cfg.food);
    buildScreenMenuGrid(cfg.screen);
    buildLearningMenuGrid(cfg.rewards);

    // Reveal grids after building
    setTimeout(() => {
      ["foodMenuGrid", "screenMenuGrid", "learningMenuGrid"].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.innerHTML) el.classList.remove("hidden");
      });
    }, 100);

    // Live image preview when food dropdown changes
    document.getElementById("foodItem").addEventListener("change", function () {
      const selected = this.options[this.selectedIndex];
      const imgUrl   = selected.getAttribute("data-image");
      const preview  = document.getElementById("foodPreview");
      if (preview && imgUrl) {
        logClick('foodItem', 'food_selection_change', { itemId: selected.value, imageUrl: imgUrl });
        preview.src           = API_BASE + imgUrl;
        preview.style.display = "block";
      }
    });
  } catch (e) {
    logError('refreshCatalog', e);
    setStatus("Error loading catalog: " + e.message);
  }
}

/* ---- Grid builders ----------------------------------------- */

export function buildFoodMenuGrid(foodItems) {
  const grid = document.getElementById("foodMenuGrid");
  if (!grid || !foodItems) return;
  grid.innerHTML = foodItems.map(item => `
    <div class="menu-card" onclick="selectFoodItem('${item.id}')">
      <img src="${API_BASE}${item.image_url || '/images/food/placeholder.jpg'}" alt="${item.label}"
           onerror="this.src='${API_BASE}/images/food/placeholder.jpg'"/>
      <div class="menu-card-title">${item.label}</div>
      <div class="menu-card-price">${item.cost_gb} GB$</div>
    </div>`).join("");
  grid.classList.remove("hidden");
}

export function buildScreenMenuGrid(screenItems) {
  const grid = document.getElementById("screenMenuGrid");
  if (!grid || !screenItems) return;
  grid.innerHTML = screenItems.map(item => `
    <div class="menu-card" onclick="selectScreenItem('${item.id}')">
      <img src="${API_BASE}${item.image_url || '/images/tablet_time/placeholder.jpg'}" alt="${item.label}"
           onerror="this.src='${API_BASE}/images/tablet_time/placeholder.jpg'"/>
      <div class="menu-card-title">${item.label}</div>
      <div class="menu-card-price">${item.cost_gb} GB$ → ${item.minutes} min</div>
    </div>`).join("");
  grid.classList.remove("hidden");
}

export function buildLearningMenuGrid(rewardItems) {
  const grid = document.getElementById("learningMenuGrid");
  if (!grid || !rewardItems) return;
  grid.innerHTML = rewardItems.map(item => `
    <div class="menu-card">
      <div class="menu-card-title">${item.label}</div>
      <div class="menu-card-price">+${item.delta_gb} GB$</div>
    </div>`).join("");
  grid.classList.remove("hidden");
}

/* ---- Toggle between visual and dropdown menus -------------- */

export function toggleMenuView() {
  const visual   = document.getElementById("visualMenus");
  const dropdown = document.getElementById("dropdownMenus");
  const toggle   = document.getElementById("menuViewToggle");
  if (visual.classList.contains("hidden")) {
    visual.classList.remove("hidden");
    dropdown.classList.add("hidden");
    toggle.textContent = "📋 Hide Visual Menus";
    logClick('toggleMenuView', 'show_visual_menus');
  } else {
    visual.classList.add("hidden");
    dropdown.classList.remove("hidden");
    toggle.textContent = "📋 Show Visual Menus";
    logClick('toggleMenuView', 'show_dropdown_menus');
  }
}

export function showFoodMenu() {
  document.getElementById("foodMenuGrid").classList.toggle("hidden");
  logClick('showFoodMenu', 'food_menu_toggle');
}

export function showScreenMenu() {
  document.getElementById("screenMenuGrid").classList.toggle("hidden");
  logClick('showScreenMenu', 'screen_menu_toggle');
}

export function showLearningMenu() {
  document.getElementById("learningMenuGrid").classList.toggle("hidden");
  logClick('showLearningMenu', 'learning_menu_toggle');
}

/* ---- Item selection (triggers purchase flow) --------------- */

export function selectFoodItem(itemId) {
  logClick('selectFoodItem', 'food_item_selected', { itemId });
  document.getElementById("foodItem").value = itemId;
  buyFood();
}

export function selectScreenItem(itemId) {
  logClick('selectScreenItem', 'screen_item_selected', { itemId });
  document.getElementById("screenPkg").value = itemId;
  buyScreen();
}
