/**
 * wallet.js — Balance display and purchase history.
 * Depends on: state.js, api.js, logger.js
 */

import { state }                        from './state.js';
import { api, setStatus }               from './api.js';
import { logEvent, logClick, logError } from './logger.js';

/* ---- Refresh wallet/kids state ----------------------------- */

export async function refreshState() {
  logClick('refreshState', 'state_refresh');
  try {
    logEvent('state_refresh_start');
    const data     = await api("/api/state");
    const kidsCount = data.kids?.length || 0;
    logEvent('state_refresh_success', {
      kidsCount,
      kids: data.kids?.map(k => ({ name: k.name, balance: k.balance_gb, minutes: k.minutes })),
    });

    const isKid     = state.currentUser?.role === 'kid';
    const currentKid = isKid
      ? data.kids.find(k => k.kid_user_id === state.currentUser.uid)
      : null;

    let html = '';

    // Large wallet card for the logged-in kid
    if (currentKid) {
      const sessionElapsed = currentKid.session.active && currentKid.session.start_ts
        ? Math.floor((Date.now() / 1000 - currentKid.session.start_ts) / 60)
        : 0;
      html += `
        <div class="wallet ${currentKid.locked ? 'wallet-locked' : currentKid.session.active ? 'wallet-active' : ''}">
          <img class="wallet-logo" src="/images/gbucks-coin.png" alt="GB$ Logo"
               onload="console.log('[IMAGE] ✅ Loaded wallet logo: gbucks-coin.png');"
               onerror="console.error('[IMAGE] ❌ Failed to load wallet logo: gbucks-coin.png from', this.src); this.style.display='none';"/>
          <div class="wallet-title">${currentKid.name}'s Wallet</div>
          <div class="wallet-balance">GB$ ${currentKid.balance_gb.toFixed(2)}</div>
          <div class="wallet-label">Goodbody Bucks</div>
          <div class="wallet-minutes">${currentKid.minutes} min</div>
          <div class="wallet-label">Screen Time Available</div>
          <div class="wallet-status">
            ${currentKid.locked ? '<span class="bad">🔒 SCREENS LOCKED</span>' : ''}
            ${currentKid.session.active
              ? `<span class="ok">▶️ ${currentKid.session.mode} session active (${sessionElapsed}m elapsed)</span>`
              : '<span style="color:#8aa0b6;">⏸️ No active session</span>'}
          </div>
        </div>`;
    }

    // Kid list (admins see all; kids see only themselves)
    if (!isKid || currentKid) {
      html += data.kids.map(k => {
        const elapsed = k.session.active && k.session.start_ts
          ? Math.floor((Date.now() / 1000 - k.session.start_ts) / 60)
          : 0;
        return `
          <div class="kid">
            <b>${k.name}</b>
            <span style="font-size:10px; color:#8aa0b6;">(${k.kid_user_id.substring(0, 8)}...)</span><br/>
            <div style="margin-top:8px;">
              <span style="color:#34d399; font-size:18px; font-weight:600;">GB$ ${k.balance_gb.toFixed(2)}</span>
              <span style="color:#60a5fa; font-size:16px; margin-left:12px;">${k.minutes} min</span>
            </div>
            ${k.locked ? "<span class='bad' style='display:inline-block; margin-top:4px;'>🔒 LOCKED</span>" : ""}
            ${k.session.active
              ? `<span class='ok' style='display:inline-block; margin-top:4px;'>▶️ ${k.session.mode} (${elapsed}m)</span>`
              : ""}
            <div style="margin-top:8px;">
              <button onclick="viewHistory('${k.kid_user_id}')" style="padding:6px 12px; font-size:11px; margin-right:4px;">History</button>
              ${!isKid
                ? `<button onclick="quickResetKid('${k.kid_user_id}', '${k.name}')" style="padding:6px 12px; font-size:11px; background:#fb7185; border-color:#fb7185; color:white;">Reset</button>`
                : ''}
            </div>
          </div>`;
      }).join("");
    }

    document.getElementById("kids").innerHTML = html;
  } catch (e) {
    logError('refreshState', e);
    setStatus("Error loading state: " + e.message);
  }
}

/* ---- Purchase history -------------------------------------- */

export async function viewHistory(kidUid) {
  logClick('viewHistory', 'purchase_history_view', { kidUid });
  try {
    logEvent('history_load_start', { kidUid });
    const data    = await api(`/api/purchase_history?kid_user_id=${kidUid}`);
    const history = data.history || [];
    logEvent('history_load_success', { kidUid, historyCount: history.length });

    const histHtml = history.map(h => {
      const date = new Date(h.ts * 1000).toLocaleString();
      return `<div style="font-size:11px; padding:4px; border-bottom:1px solid #223146;">
        ${date}: ${h.label} - ${h.cost_gb} GB$ (${h.type})
      </div>`;
    }).join("");

    const view = document.getElementById("historyView");
    view.innerHTML = `<h3>Purchase History</h3>${histHtml || "No purchases yet"}`;
    view.classList.remove("hidden");
  } catch (e) {
    logError('viewHistory', e);
    setStatus("Error loading history: " + e.message);
  }
}
