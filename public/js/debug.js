/**
 * debug.js — GB$ runtime debug utility.
 *
 * Usage (DevTools console):
 *   __gb.enable()          — turn on verbose debug in production
 *   __gb.disable()         — silence all output
 *   __gb.dump()            — full state + catalog snapshot
 *   __gb.verify(amt)       — validate a GB$ amount
 *   __gb.history(n?)       — last N debug events (default 50)
 *   __gb.level('INFO')     — set minimum log level: VERBOSE INFO WARN ERROR SILENT
 *   __gb.release           — release SHA this build was stamped with
 *
 * In code:
 *   import { dbg } from './debug.js';
 *   dbg.info('catalog', 'loaded', { count: items.length });
 *   dbg.warn('purchase', 'low balance', { balance });
 *   dbg.error('auth', 'token expired', err);
 *   dbg.action('buyScreen', { kidName, item, amount, balanceBefore, balanceAfter });
 *   dbg.amount('purchase_food', amount, { min: 0.25, max: 500 });
 *
 * Release SHA:
 *   Set <meta name="gb-release-sha" content="{{SHA}}"> in index.html.
 *   The deploy script (scripts/stamp-release.ps1) replaces {{SHA}} automatically.
 *   Falls back to "dev" if tag is absent or content is the literal placeholder.
 */

import { state } from './state.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DBG_LEVELS = Object.freeze({ VERBOSE: 0, INFO: 1, WARN: 2, ERROR: 3, SILENT: 4 });

const STORAGE_ENABLED = 'gb:debug';
const STORAGE_LEVEL   = 'gb:debug:level';

const IS_LOCAL = (
  typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
);

// Read release SHA from <meta name="gb-release-sha">
function _readSha() {
  try {
    const content = document.querySelector('meta[name="gb-release-sha"]')?.content || 'dev';
    return content === '{{SHA}}' ? 'dev' : content.slice(0, 8);
  } catch { return 'dev'; }
}

const RELEASE_SHA = _readSha();
const PREFIX = `[GB$ ${RELEASE_SHA}]`;

// ---------------------------------------------------------------------------
// Ring buffer for in-memory event history (max 200 entries)
// ---------------------------------------------------------------------------

const _history = [];
const MAX_HISTORY = 200;

function _record(level, ns, msg, data) {
  if (_history.length >= MAX_HISTORY) _history.shift();
  _history.push({ ts: new Date().toISOString(), sha: RELEASE_SHA, level, ns, msg, data });
}

// ---------------------------------------------------------------------------
// Active level / enable resolution
// ---------------------------------------------------------------------------

function _isEnabled() {
  if (IS_LOCAL) return true;
  return localStorage.getItem(STORAGE_ENABLED) === '1';
}

function _currentLevel() {
  const stored = localStorage.getItem(STORAGE_LEVEL)?.toUpperCase();
  if (stored && DBG_LEVELS[stored] !== undefined) return DBG_LEVELS[stored];
  return IS_LOCAL ? DBG_LEVELS.VERBOSE : DBG_LEVELS.WARN;
}

function _should(level) {
  return _isEnabled() && level >= _currentLevel();
}

// ---------------------------------------------------------------------------
// Styled console helpers
// ---------------------------------------------------------------------------

const STYLE = {
  prefix:  'color:#f59e0b;font-weight:bold',
  ns:      'color:#38bdf8;font-weight:600',
  msg:     'color:#e2e8f0',
  verbose: 'color:#94a3b8',
  info:    'color:#34d399',
  warn:    'color:#fbbf24',
  error:   'color:#f87171;font-weight:bold',
  action:  'color:#a78bfa;font-weight:bold',
  amount:  'color:#fb923c;font-weight:600',
};

function _fmt(levelName, ns, msg) {
  return [`%c${PREFIX}%c [${levelName}] %c${ns}%c  ${msg}`,
    STYLE.prefix, STYLE[levelName.toLowerCase()] || STYLE.msg, STYLE.ns, STYLE.msg];
}

// ---------------------------------------------------------------------------
// Core output functions
// ---------------------------------------------------------------------------

function _log(level, levelName, ns, msg, data) {
  _record(levelName, ns, msg, data);
  if (!_should(level)) return;

  const args = _fmt(levelName, ns, msg);
  if (data !== undefined) args.push(data);

  switch (level) {
    case DBG_LEVELS.VERBOSE: console.debug(...args); break;
    case DBG_LEVELS.WARN:    console.warn(...args);  break;
    case DBG_LEVELS.ERROR:   console.error(...args); break;
    default:                 console.log(...args);
  }
}

// ---------------------------------------------------------------------------
// Amount validator
// ---------------------------------------------------------------------------

/**
 * Validate a GB$ monetary amount.
 * Logs a warning if the value looks wrong; returns true/false.
 *
 * @param {string} context   - Caller label for the log
 * @param {*}      amount    - Value to validate
 * @param {{ min?: number, max?: number, allowZero?: boolean }} [opts]
 */
function _amount(context, amount, opts = {}) {
  const { min = 0.01, max = 10000, allowZero = false } = opts;
  const issues = [];

  if (typeof amount !== 'number' || isNaN(amount)) {
    issues.push(`not a number (got ${JSON.stringify(amount)})`);
  } else {
    if (!allowZero && amount === 0) issues.push('zero amount');
    if (amount < 0)                  issues.push(`negative (${amount})`);
    if (amount < min)                issues.push(`below min ${min} (${amount})`);
    if (amount > max)                issues.push(`above max ${max} (${amount})`);
    const rounded = Math.round(amount * 100) / 100;
    if (Math.abs(rounded - amount) > 0.001) {
      issues.push(`precision risk: ${amount} → rounds to ${rounded}`);
    }
  }

  if (issues.length) {
    _log(DBG_LEVELS.WARN, 'WARN', 'amount', `${context}: ${issues.join('; ')}`, { amount, opts });
    return false;
  }

  _log(DBG_LEVELS.VERBOSE, 'VERBOSE', 'amount', `${context}: ✓ ${amount} GB$`, { amount });
  return true;
}

// ---------------------------------------------------------------------------
// Action inspector
// ---------------------------------------------------------------------------

/**
 * Log a user action with before/after balance verification.
 *
 * @param {string} actionName
 * @param {{ kidName?, item?, amount?, balanceBefore?, balanceAfter?, [key]: any }} details
 */
function _action(actionName, details = {}) {
  _record('ACTION', actionName, actionName, details);
  if (!_should(DBG_LEVELS.INFO)) return;

  console.groupCollapsed(
    `%c${PREFIX}%c [ACTION] %c${actionName}`,
    STYLE.prefix, STYLE.action, STYLE.ns,
  );

  if (details.kidName)      console.log('%ckid%c       ', STYLE.ns, '', details.kidName);
  if (details.item)         console.log('%citem%c      ', STYLE.ns, '', details.item);

  if (details.amount !== undefined) {
    const valid = _amount(`${actionName}.amount`, details.amount);
    console.log(`%camount%c    `, STYLE.ns, '', `${details.amount} GB$ ${valid ? '✓' : '⚠ INVALID'}`);
  }

  if (details.balanceBefore !== undefined && details.balanceAfter !== undefined) {
    const delta = details.balanceAfter - details.balanceBefore;
    const sign  = delta >= 0 ? '+' : '';
    console.log(`%cbalance%c   `, STYLE.ns, '',
      `${details.balanceBefore} → ${details.balanceAfter}  (${sign}${delta.toFixed(2)})`);
  }

  const rest = Object.fromEntries(
    Object.entries(details).filter(
      ([k]) => !['kidName','item','amount','balanceBefore','balanceAfter'].includes(k)
    )
  );
  if (Object.keys(rest).length) console.log('%cdetails%c   ', STYLE.ns, '', rest);

  console.log('%csha%c       ', STYLE.ns, '', RELEASE_SHA);
  console.groupEnd();
}

// ---------------------------------------------------------------------------
// Public dbg object (for import in other modules)
// ---------------------------------------------------------------------------

export const dbg = Object.freeze({
  verbose: (ns, msg, data) => _log(DBG_LEVELS.VERBOSE, 'VERBOSE', ns, msg, data),
  info:    (ns, msg, data) => _log(DBG_LEVELS.INFO,    'INFO',    ns, msg, data),
  warn:    (ns, msg, data) => _log(DBG_LEVELS.WARN,    'WARN',    ns, msg, data),
  error:   (ns, msg, data) => _log(DBG_LEVELS.ERROR,   'ERROR',   ns, msg, data),
  action:  _action,
  amount:  _amount,
});

// ---------------------------------------------------------------------------
// window.__gb — DevTools interactive namespace
// ---------------------------------------------------------------------------

export function mountDevtools() {
  if (typeof window === 'undefined') return;

  const __gb = {
    release: RELEASE_SHA,
    isLocal: IS_LOCAL,

    /** Enable debug output (persists in localStorage). */
    enable(levelName = 'VERBOSE') {
      localStorage.setItem(STORAGE_ENABLED, '1');
      localStorage.setItem(STORAGE_LEVEL, levelName.toUpperCase());
      console.log(`${PREFIX} debug enabled at level ${levelName.toUpperCase()}`);
    },

    /** Silence all debug output. */
    disable() {
      localStorage.removeItem(STORAGE_ENABLED);
      localStorage.removeItem(STORAGE_LEVEL);
      console.log(`${PREFIX} debug disabled`);
    },

    /** Set minimum log level without toggling enable/disable. */
    level(levelName) {
      if (DBG_LEVELS[levelName.toUpperCase()] === undefined) {
        console.warn(`${PREFIX} unknown level "${levelName}". Options: ${Object.keys(DBG_LEVELS).join(', ')}`);
        return;
      }
      localStorage.setItem(STORAGE_LEVEL, levelName.toUpperCase());
      console.log(`${PREFIX} level set to ${levelName.toUpperCase()}`);
    },

    /** Full state snapshot. */
    dump() {
      console.group(`${PREFIX} STATE DUMP`);
      console.log('release sha:  ', RELEASE_SHA);
      console.log('local:        ', IS_LOCAL);
      console.log('debug enabled:', _isEnabled());
      console.log('log level:    ', Object.keys(DBG_LEVELS).find(k => DBG_LEVELS[k] === _currentLevel()));
      console.log('familyId:     ', state.familyId || '(none)');
      console.log('currentUser:  ', state.currentUser ?? '(none)');
      console.log('idToken:      ', state.idToken ? `${state.idToken.slice(0, 16)}…` : '(none)');
      console.log('catalogData:  ', state.catalogData ?? '(none)');
      console.log('pendingPurch: ', state.pendingPurchase ?? '(none)');
      console.groupEnd();
      return {
        sha: RELEASE_SHA,
        isLocal: IS_LOCAL,
        ...state,
        idToken: state.idToken ? `${state.idToken.slice(0, 16)}…` : null,
      };
    },

    /**
     * Validate a GB$ amount on demand.
     * @param {number} amount
     * @param {object} [opts] - { min, max, allowZero }
     */
    verify(amount, opts) {
      return _amount('manual verify', amount, opts);
    },

    /**
     * Retrieve buffered debug events.
     * @param {number} [n=50]
     */
    history(n = 50) {
      const slice = _history.slice(-n);
      console.table(slice.map(e => ({
        ts:    e.ts.slice(11, 23),
        level: e.level,
        ns:    e.ns,
        msg:   e.msg,
      })));
      return slice;
    },

    /** Show a help summary. */
    help() {
      console.log(`
${PREFIX} GB$ Debug Console
─────────────────────────────────────────
  __gb.enable('VERBOSE')   turn on full debug (prod)
  __gb.disable()           silence all output
  __gb.level('INFO')       set min level (VERBOSE INFO WARN ERROR SILENT)
  __gb.dump()              full state + config snapshot
  __gb.verify(amount)      validate a GB$ amount
  __gb.history(n)          last N buffered events
  __gb.release             current release SHA
      `.trim());
    },
  };

  window.__gb = __gb;

  // Print a compact boot banner so developers know debug is ready
  if (_isEnabled()) {
    console.log(
      `%c${PREFIX}%c GB$ debug ready — type __gb.help() to see commands`,
      STYLE.prefix, STYLE.msg,
    );
  }
}
