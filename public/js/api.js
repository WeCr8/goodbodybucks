/**
 * api.js — Fetch wrapper and UI status helper.
 * Depends on: state.js
 */

import { state } from './state.js';

export const API_BASE = window.location.origin;

/**
 * Authenticated JSON fetch.
 * @param {string} path
 * @param {string} [method]
 * @param {object|null} [body]
 */
export async function api(path, method = "GET", body = null) {
  const url = path.startsWith('http') ? path : API_BASE + path;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type":  "application/json",
      "Authorization": "Bearer " + state.idToken,
      "X-Family-Id":   state.familyId,
    },
    body: body ? JSON.stringify(body) : null,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error);
  return data;
}

/** Write a short message to the #status element. */
export function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}
