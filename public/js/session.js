/**
 * session.js — Screen-time session start/stop.
 * Depends on: api.js, logger.js, wallet.js
 */

import { api, setStatus }               from './api.js';
import { logEvent, logClick, logError } from './logger.js';
import { refreshState }                 from './wallet.js';

export async function startSession() {
  logClick('startSession', 'timer_start');
  try {
    const mode = document.getElementById("mode").value;
    logEvent('session_start_attempt', { mode });
    await api("/api/session/start", "POST", { mode });
    logEvent('session_start_success', { mode });
    await refreshState();
    setStatus("Session started");
  } catch (e) {
    logError('startSession', e);
    setStatus("Error: " + e.message);
  }
}

export async function stopSession() {
  logClick('stopSession', 'timer_stop');
  try {
    logEvent('session_stop_attempt');
    await api("/api/session/stop", "POST", {});
    logEvent('session_stop_success');
    await refreshState();
    setStatus("Session stopped");
  } catch (e) {
    logError('stopSession', e);
    setStatus("Error: " + e.message);
  }
}
