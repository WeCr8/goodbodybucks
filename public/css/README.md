# public/css/

## Purpose
Shared design-system stylesheet for the GB$ Family Wallet application.

## Scope
All files here are served as static assets by Flask and consumed by every HTML page in the app.

## Contents
| File | Description |
|---|---|
| `gbucks.css` | Single source of truth for brand design tokens (`:root` CSS custom properties), layout utilities, component styles (wallet card, menu grid, purchase modal, academy hub, auth picker). Referenced by `index.html`, `public/academy/index.html`. |

## Design Tokens
All brand colours and surface values are defined as CSS custom properties on `:root`:

| Token | Value | Role |
|---|---|---|
| `--gb-bg` | `#0b0f14` | Page background |
| `--gb-surface` | `#121823` | Card/panel surface |
| `--gb-green` | `#34d399` | Primary accent, GB$ currency |
| `--gb-amber` | `#f59e0b` | Academy / warning accent |
| `--gb-blue` | `#60a5fa` | Screen-time / info accent |
| `--gb-danger` | `#fb7185` | Locked / error state |

## Usage
```html
<link rel="stylesheet" href="/css/gbucks.css"/>
```

## Ownership
Maintained by the GB$ Family Wallet project. Changes here affect all pages.
