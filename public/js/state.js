/**
 * state.js — Shared mutable application state.
 * Import and mutate `state` to share values across modules.
 */

export const state = {
  familyId:    "",
  idToken:     "",
  currentUser: null,  // { uid, email, role, name? }
  catalogData: null,  // catalog API response
  pendingPurchase: null, // active purchase modal context
};
