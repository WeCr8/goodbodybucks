/**
 * logger.js — User-journey event logging.
 * Depends on: state.js, debug.js
 *
 * All output routes through debug.js so log level, production gating,
 * and the release SHA flag are handled consistently.
 */

import { state } from './state.js';
import { dbg }   from './debug.js';

export function logEvent(eventType, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event:     eventType,
    familyId:  state.familyId || 'none',
    userId:    state.currentUser?.uid  || 'anonymous',
    userRole:  state.currentUser?.role || 'none',
    ...details,
  };
  dbg.verbose('journey', eventType, entry);
  return entry;
}

export function logClick(elementId, action, details = {}) {
  logEvent('click', { element: elementId, action, ...details });
}

export function logTransaction(type, details) {
  // Route through dbg.action so amounts are inspected automatically
  const hasAmount = details && typeof details.amount === 'number';
  if (hasAmount) {
    dbg.action(type, details);
  } else {
    dbg.info('transaction', type, details);
  }
  logEvent('transaction', { transactionType: type, ...details });
}

export function logError(context, error) {
  dbg.error(context, error?.message ?? String(error), {
    code: error?.code,
    stack: error?.stack,
  });
  logEvent('error', { context, error: error?.message, errorCode: error?.code });
}
