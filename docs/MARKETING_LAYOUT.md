# GB$ Marketing Page — Layout Spec

**File:** `public/index.html` → `<section id="landingSection">`  
**URL:** https://goodbodybucks.web.app/  
**Audience:** Unauthenticated visitors (prospective parents)  
**Goal:** Communicate what GB$ is, why it exists, and convert to sign-up.

---

## Page-Level Structure

```
<body>
  .wrap (max-width: 1100px, centered)
    .logo-header          ← always visible
    <section #landingSection>
      [1] .card.landing-hero
      [2] .card.landing-preview
      [3] .card.landing-legacy    ← hidden until image added
      [4] .card.landing-origin-story
      [5] .card                   ← features + CTA
    </section>
    <section #appSection hidden>  ← shown after Get Started / Sign In click
```

Transition: clicking CTA or "Sign in" runs:
```js
landingSection.classList.add('hidden');
appSection.classList.remove('hidden');
```

---

## Section 1 — Hero Card

**Class:** `.card.landing-hero`  
**Purpose:** Immediate impact. Brand establishment. Emotional hook.

### Components

| Element | Class | Content |
|---------|-------|---------|
| Coin logo | `.landing-coin` | `/images/gbucks-coin.png` at 120px circle |
| Headline | `.landing-headline` | "The board that raised 9 kids. Now it's an app." |
| Sub-copy | `.landing-sub` | Origin summary — chore board → digital |

### Visual Treatment
- Centered layout, `padding: 36px 24px 28px`
- Coin: 120px diameter, green border (`var(--gb-green)`), green glow shadow
- Headline: `1.75rem`, weight 800, line-height 1.25
- Sub: muted text, `max-width: 480px`

### Image Notes
- `gbucks-coin.png` is 2048×2048 at 6MB — **needs optimization**
- Export a web-ready version: `gbucks-coin-256.png` at 256×256 / ~40KB
- Current CSS constrains size: `width:120px; height:120px; object-fit:cover`

---

## Section 2 — App Preview Grid

**Class:** `.card.landing-preview`  
**Purpose:** Show what the app actually looks like. Convey the 5 category structure at a glance. Answers "what does my family actually do in this app?"

### Components

| Element | Class | Content |
|---------|-------|---------|
| Eyebrow | `.landing-kicker` | "What your family uses every day" |
| Sub-headline | `.landing-story-title` | "Five categories. One system." |
| Image grid | `.landing-preview-grid` | 5 columns → 3 on mobile |

### Grid Items (5 total)

| # | Label | Image | Path |
|---|-------|-------|------|
| 1 | 💰 Earn GB$ | wallet_menu.png | `/images/wallet/wallet_menu.png` |
| 2 | 🍕 Food rewards | food_menu.png | `/images/food/food_menu.png` |
| 3 | 🎮 Screen time | gaming_menu.png | `/images/tablet_time/gaming_menu.png` |
| 4 | 📚 Learning | learning_menu.png | `/images/learning/learning_menu.png` |
| 5 | ⚠️ Accountability | consequences_menu_money.png | `/images/consequences/consequences_menu_money.png` |

Each item: `.landing-preview-item` wraps `img.landing-preview-img` + `span.landing-preview-label`.  
Images use `loading="lazy"` and gracefully hide on error.

### CSS
```css
.landing-preview-grid { grid-template-columns: repeat(5, 1fr); gap: 10px; }
.landing-preview-img  { aspect-ratio: 1; object-fit: cover; border-radius: 10px; }
/* mobile */
@media (max-width: 640px) { .landing-preview-grid { grid-template-columns: repeat(3,1fr); } }
```

---

## Section 3 — Legacy Photo Card *(hidden until image added)*

**Class:** `.card.landing-legacy`  
**Purpose:** Emotional authenticity. Show the original hand-drawn chore board that inspired the app.

**Status:** ⚠️ Hidden — image file missing.  
**Action required:** Place the original Goodbody family chore board photo at:
```
public/images/legacy/goodbody_legacy_schedule.JPG
```

### When Active
| Element | Class | Content |
|---------|-------|---------|
| Photo | `.landing-legacy-img` | Family chore board, `max-width: 480px` |
| Caption | `.landing-legacy-caption` | *"The tools have changed. The lesson hasn't."* |

---

## Section 4 — Origin Story Card

**Class:** `.card.landing-origin-story`  
**Purpose:** Emotional connection. Explain *why* this exists. Convert skeptical parents.

### Components

| Element | Class | Content |
|---------|-------|---------|
| Eyebrow | `.landing-kicker` | "Why we started GB$" |
| Headline | `.landing-story-title` | "We needed a fair way to make family work visible." |
| Body copy ×2 | `.landing-story-copy` | Origin narrative |
| Principles grid | `.landing-principles` | 3 columns: Visibility / Rotation / Clarity |
| Closing copy | `.landing-story-copy` | "contribution comes before consumption" |

### Principles Grid
```
┌─────────────┬─────────────┬─────────────┐
│  Visibility │  Rotation   │  Clarity    │
│Everyone can │ Work gets   │ No guessing │
│see the rules│shared fairly│who owes what│
└─────────────┴─────────────┴─────────────┘
```
Desktop: 3 columns. Mobile: 1 column.

### Visual Treatment
- Gradient background: `#111c2a → #142837 → #1e332f`
- Border: `#285a4d` (dark green)
- Differentiates from plain surface cards

---

## Section 5 — Features + CTA Card

**Class:** `.card`  
**Purpose:** Concrete benefits list, family quote, and conversion CTA.

### Components

| Element | Class | Content |
|---------|-------|---------|
| Section title | `.landing-section-title` | "How it works today" |
| Feature grid | `.landing-features` | 2 columns, 6 bullet items |
| Quote | `.landing-quote` | *"Chores aren't optional — they're your contribution."* |
| CTA button | `.btn-primary.landing-cta` | "Start your family's economy →" |
| Sign-in link | `.landing-already` | "Already have an account? Sign in" |

### Feature Grid (6 items)
```
💰 Kids earn GB$ for chores, learning & outdoor work
🍕 Spend on food, screen time & real privileges
⏱️ Screen time tracked by a live countdown timer
⚠️ Consequences for poor choices — money or time
📚 Summer Academy built in
🔒 Parents control every rule
```
Desktop: 2 columns. Mobile: 1 column.

### CTA Behavior
Both the button and "Sign in" link execute:
```js
landingSection.classList.add('hidden');
appSection.classList.remove('hidden');
// → lands on #authStep0 (login wizard, step 0)
```

---

## Responsive Breakpoints

| Breakpoint | Change |
|------------|--------|
| ≤640px | `.landing-headline` → 1.4rem |
| ≤640px | `.landing-principles` → 1 column |
| ≤640px | `.landing-features` → 1 column |
| ≤640px | `.landing-preview-grid` → 3 columns |
| All | `.landing-coin` capped at 120px with `object-fit:cover` |

---

## All Images Required

| Image | Path (under `public/`) | Status | Optimal Size |
|-------|------------------------|--------|--------------|
| GB$ Coin logo | `/images/gbucks-coin.png` | ✅ (6MB — optimize!) | 256×256 / <50KB |
| Wallet menu | `/images/wallet/wallet_menu.png` | ✅ | — |
| Food menu | `/images/food/food_menu.png` | ✅ | — |
| Screen time menu | `/images/tablet_time/gaming_menu.png` | ✅ | — |
| Learning menu | `/images/learning/learning_menu.png` | ✅ | — |
| Consequences menu | `/images/consequences/consequences_menu_money.png` | ✅ | — |
| Consequences time | `/images/consequences/consequences_menu_time.png` | ✅ | — |
| Original chore board | `/images/legacy/goodbody_legacy_schedule.JPG` | ❌ MISSING | — |

**Image Optimization Priority:**  
`gbucks-coin.png` at 6MB blocks first paint. Export a 256×256 PNG version for web use.

---

## Social / OG Meta Tags *(not yet added)*

Add to `<head>` in `index.html`:
```html
<meta property="og:title"       content="GB$ Family Wallet"/>
<meta property="og:description" content="The Goodbody family economy system — earn, spend, learn."/>
<meta property="og:image"       content="https://goodbodybucks.web.app/images/gbucks-coin.png"/>
<meta property="og:url"         content="https://goodbodybucks.web.app/"/>
<meta property="og:type"        content="website"/>
<meta name="twitter:card"       content="summary_large_image"/>
<meta name="twitter:title"      content="GB$ Family Wallet"/>
<meta name="twitter:description" content="Real chores. Real money. Real consequences."/>
<meta name="twitter:image"      content="https://goodbodybucks.web.app/images/gbucks-coin.png"/>
```

---

## CSS Classes Reference

| Class | File | Purpose |
|-------|------|---------|
| `.landing-hero` | gbucks.css | Hero card wrapper, centered |
| `.landing-coin` | gbucks.css | 120px circular coin image |
| `.landing-headline` | gbucks.css | 1.75rem H2 headline |
| `.landing-sub` | gbucks.css | Muted body copy, 480px max |
| `.landing-preview` | gbucks.css | App screenshots card |
| `.landing-preview-grid` | gbucks.css | 5-col → 3-col thumbnail grid |
| `.landing-preview-item` | gbucks.css | Grid cell: image + label |
| `.landing-preview-img` | gbucks.css | Square thumbnail, rounded |
| `.landing-preview-label` | gbucks.css | Emoji + name caption |
| `.landing-legacy` | gbucks.css | Legacy photo card (auto-hides) |
| `.landing-legacy-img` | gbucks.css | Photo, max 480px |
| `.landing-origin-story` | gbucks.css | Gradient dark-green card |
| `.landing-kicker` | gbucks.css | Green uppercase eyebrow |
| `.landing-story-title` | gbucks.css | 1.2rem card headline |
| `.landing-story-copy` | gbucks.css | Muted-light body text |
| `.landing-principles` | gbucks.css | 3-col principles grid |
| `.landing-principle` | gbucks.css | Individual principle tile |
| `.landing-section-title` | gbucks.css | 1.05rem section H3 |
| `.landing-features` | gbucks.css | 2-col feature bullets |
| `.landing-feature` | gbucks.css | Single feature item, surface2 bg |
| `.landing-quote` | gbucks.css | Blockquote, green left border |
| `.landing-cta` | gbucks.css | Full-width CTA button |
| `.landing-already` | gbucks.css | "Already have account" footnote |
