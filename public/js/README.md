# public/js — ES Module System

## Purpose
Client-side JavaScript for the GB$ Family Wallet SPA, organized as ES modules
(no build step). Loaded via `<script type="module" src="/js/app.js">` in
`index.html`.

## Ownership
Front-end: all modules are scoped to this directory. Back-end lives in `app.py`.

## Module Map

| File | Responsibility |
|------|---------------|
| `app.js` | Entry point. Imports all modules, binds functions to `window.*` for HTML `onclick=` handlers, runs DOMContentLoaded init (including `mountDevtools()`). |
| `state.js` | Shared mutable state object: `{familyId, idToken, currentUser, catalogData, pendingPurchase}`. |
| `config.js` | Firebase `initializeApp()` side-effect import. Exports `auth`. |
| `debug.js` | Debug/inspection module. Exports `dbg` (levelled logger), `mountDevtools()` (mounts `window.__gb`). SHA-stamped output, per-level gating, ring-buffer history, amount validator. |
| `logger.js` | Journey logging helpers: `logEvent`, `logClick`, `logTransaction`, `logError`. Routes through `dbg`. |
| `api.js` | Fetch wrapper (`api()`), `setStatus()` status helper, `API_BASE` constant. |
| `auth.js` | Auth flows: `resetPicker`, `showAdmin`, `showKid`, `loginAdmin`, `loginKid`, `setupFamily`. |
| `academy.js` | Academy materials manifest (19 items) + `renderAcademyHub()`, `applyAcademyAllotment()`, `focusAcademyReward()`. |
| `catalog.js` | Catalog fetch, food/screen/learning grid builders, menu toggle, item selection. |
| `wallet.js` | Dashboard refresh (`refreshState`) + purchase history (`viewHistory`). |
| `purchase.js` | Purchase modal display, buy flows (`buyScreen`, `buyFood`, `confirmPurchase`). |
| `session.js` | Screen-time sessions: `startSession`, `stopSession`. |
| `admin.js` | Admin actions: allotment, rewards, consequences. Admin visual menu toggles. |
| `members.js` | Member CRUD: `addMember`, `removeMember`, `resetKid`, `quickResetKid`. |

## Conventions
- All modules use ES `import`/`export` — no `require()` or globals.
- `state.js` is the single source of mutable runtime state; modules import it rather than using `localStorage` directly.
- `app.js` is the only module that may assign to `window.*`.
- Functions must be tested as window globals in `tests/e2e/test_index_ui.py`.

## Debug / DevTools

Open any page in Chrome DevTools console and type:

```js
__gb.help()              // show all available commands
__gb.dump()              // full state snapshot (familyId, currentUser, catalog, etc.)
__gb.verify(5.00)        // validate a GB$ amount — returns true/false
__gb.history(20)         // last 20 logged events as a table
__gb.enable('VERBOSE')   // turn on full debug in production (persists via localStorage)
__gb.disable()           // silence all debug output
__gb.level('WARN')       // change minimum level without toggling on/off
__gb.release             // git SHA this build was stamped with
```

Every log line is prefixed with `[GB$ <sha>]` for triage across environments.

**Release SHA** is injected into `<meta name="gb-release-sha">` by `scripts/stamp-release.ps1`
(or `.sh` on Mac/Linux) before each deploy. Defaults to `"dev"` on localhost.
