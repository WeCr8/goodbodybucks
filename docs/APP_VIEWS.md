# GB$ App — Views, Usage & Goals

**App URL:** https://goodbodybucks.web.app/  
**Stack:** Vanilla JS ES modules, Firebase Auth + Realtime Database, Firebase Hosting + Functions (Python/Flask)

---

## Core App Goal

Create a real economy for families: kids **earn** GB$ (GoodBodyBucks) for chores, learning, and outdoor work, then **spend** them on food privileges, screen time, and rewards. Parents control every rule. The system replaces negotiation with published prices and visible consequences.

**Design principle:** Contribution comes before consumption.

---

## App Entry Flow

```
Visit goodbodybucks.web.app
    ↓
Landing page (not authed)
    ↓
Click "Get Started" or "Sign in"
    ↓
Login wizard (authStep0)
    ↓
Authenticated? → onAuthStateChanged → bootstrap()
    ↓
role === "admin" → Parent Hub
role === "kid"   → Kid Hub
```

---

## Authentication Wizard

All auth views live inside `<div class="card" id="loginCard">`.  
Step transitions are handled by `showAuthStep(step)` in `auth.js`.

### Step 0 — Welcome (`#authStep0`)

**Shown:** On first load of app section; on sign-out.  
**Components:**
- Google Sign-In button → `loginWithGoogle()`
- Apple Sign-In button → `loginWithApple()`
- "New Family" card → `showAuthStep('new-family')`
- "Sign In" card → `showAuthStep('role-picker')`

**Purpose:** Entry point. Two paths: brand-new family vs. returning member.

---

### Step: New Family (`#authNewFamily`)

**Shown:** First-time parent setup.  
**Components:**
- "Continue with Google" button → `loginWithGoogle()` (creates family after popup)
- Divider
- Email form: Family Name + Email + Password → `createFamilyAndLogin()`
- Back button → step0

**On success:**
1. `createUserWithEmailAndPassword(email, pass)`
2. POST `/api/setup_family` → creates Firestore records
3. POST `/api/bootstrap` → seeds admin membership + wallet
4. Shows `#familyIdBanner` with the new Family ID + copy button
5. Saves Family ID to `localStorage`
6. Routes to Parent Hub

---

### Step: Role Picker (`#authRolePicker`)

**Shown:** Returning users — after entering Family ID.  
**Components:**
- Family ID input (`#familyIdVisible`) — auto-fills from `localStorage` on revisit
- "Parent" card → `showAdmin()` → step: admin-form
- "Kid" card → `showKid()` → step: kid-form

---

### Step: Parent Login (`#adminBox`)

**Components:**
- Google button → `loginWithGoogle()`
- Apple button → `loginWithApple()`
- Email + Password form → `loginAdmin()`
- Back button → role-picker

**On success:** `signInWithEmailAndPassword` → bootstrap → Parent Hub.

---

### Step: Kid Login (`#kidBox`)

**Components:**
- Name input (e.g., "Miles" or "Sabrina")
- PIN field (min 6 chars)
- Form → `loginKid()`
- Back button → role-picker

**How it works:** Kid name + Family ID are combined to derive the Firebase email (`miles.familyid@gbucks.local`). PIN is the password. Account was created server-side by parent via Add Child.

**On success:** bootstrap → Kid Hub.

---

### Step: Google/Apple Link (`#authGoogleLink`)

**Shown:** After Google/Apple sign-in when no Family ID is stored.  
**Two sub-paths:**
- "New Family" → shows form with Family Name → `createFamilyWithGoogle()`
- "Existing Family" → shows Family ID input → `linkGoogleToFamily()`

---

## Kid Hub

**Element:** `<div id="kidHub" class="hub hidden">`  
**Access:** `role === "kid"` after auth.  
**Tabs:** Wallet · Shop · Learn · Timer · Academy

---

### 💰 Wallet Tab (`#kidWalletTab`)

**Purpose:** Show the kid what they have — their "bank account."

**Components:**
- `#walletDisplay` — rendered by `wallet.js`:
  - GB$ balance (large green number)
  - Screen minutes remaining (blue)
  - Session status indicator
  - Lock status warning
- `#historyView` — toggle to see recent transactions/ledger

**Goal:** Real-time visibility into earnings. Makes value feel concrete.

---

### 🛒 Shop Tab (`#kidShopTab`)

**Purpose:** Spend GB$ on real privileges.

#### Food Section
- `food_menu.png` image (tappable)
- Tap → `showFoodMenu()` → populates `#foodMenuGrid`
- Tap item → `openPurchaseModal(item)` → shows: item name, cost, current balance, new balance
- Confirm → `confirmPurchase()` → deducts GB$ → parent fulfills food order

#### Screen Time Section
- `gaming_menu.png` image (tappable)
- Tap → `showScreenMenu()` → populates `#screenMenuGrid`
- Screen packages: [15 min / 30 min / 60 min / etc.] at different GB$ costs
- Confirm → adds minutes to kid's timer balance

**Goal:** Kids make real spending decisions. Choices have visible cost.

---

### 📚 Learn Tab (`#kidLearnTab`)

**Purpose:** Connect learning behaviors to earning.

**Components:**
- `learning_menu.png` (tappable) → `showLearningMenu()`
- Learning categories: reading, outdoor time, instrument practice, etc.
- Each shows the GB$ reward value

**Workflow:**
1. Kid completes a learning task
2. Shows parent the result
3. Parent awards GB$ via Parent Hub → Rewards tab → "Reward a Kid"

**Goal:** Make education feel like it pays — because in this system, it does.

---

### ⏱️ Timer Tab (`#kidTimerTab`)

**Purpose:** Physical accountability for screen time.

**Components:**
- Mode selector: Tablet | Game
- "▶ Start Session" → `startSession()` → begins countdown
- "■ Stop Session" → `stopSession()` → ends early, preserves remaining minutes
- Live countdown visible in wallet

**Workflow:**
1. Kid buys screen time on Shop tab
2. Switches to Timer tab, selects mode
3. Starts session → timer counts down
4. Session ends (time runs out or stopped) → session recorded in ledger

**Goal:** No screen time without currency. Makes "unlimited scrolling" impossible by design.

---

### 🏆 Academy Tab (`#kidAcademyTab`)

**Purpose:** Summer Academy hub shortcut within the kid's wallet view.

**Components:**
- GB$ coin header + tagline "Goodbody Family · 8 Weeks · GB$12–15/day"
- Academy pills: "⚡ Load Allotment" | "🎯 Academy Rewards"
- Link to full Academy page (`/academy/`)
- Certificate links (per-kid: Miles, Sabrina + blank)
- Academy materials grid

**Goal:** Integrate the 8-week summer curriculum directly with the wallet. Academy work earns real GB$.

---

## Parent Hub

**Element:** `<div id="parentHub" class="hub hidden">`  
**Access:** `role === "admin"` after auth.  
**Tabs:** Dashboard · Rewards · Rules · Family · Menus

---

### 📊 Dashboard Tab (`#parentDashTab`)

**Purpose:** At-a-glance view of every family member's status.

**Components:**
- `#kids` — rendered by `state.js` / `members.js`:
  - Per-kid row: name, GB$ balance, minutes remaining, session active/idle, lock indicator
- "↻ Refresh" button → `refreshState()`

**Goal:** Instant situational awareness. See who's on screens, who's locked, who needs a reward.

---

### 🎁 Rewards Tab (`#parentRewardsTab`)

**Purpose:** Distribute GB$ to kids.

#### Daily Allotment
- JSON textarea: `{ "Miles": 12, "Sabrina": 15 }`
- "Apply Allotment" → `dailyAllotment()` → POST `/api/admin/allotment`
- Distributes GB$ to all named kids at once

**Morning routine:** Parent opens app, taps Apply Allotment — done. Day starts.

#### Reward a Kid
- Name input + reward type dropdown (chore done, reading, outdoor work, etc.)
- "Award GB$" → `rewardKid()` → POST `/api/admin/reward`

**Goal:** One-tap positive reinforcement immediately linked to behavior.

---

### ⚠️ Rules Tab (`#parentRulesTab`)

**Purpose:** Apply consequences. Remove time or money as punishment.

#### Time Consequences
- Kid name + consequence type (e.g., "Lose 30 min")
- "Apply Time Penalty" → `timePunish()` → deducts minutes

#### Money Consequences
- Kid name + consequence type (e.g., "Lose GB$5 for lying")
- "Apply Money Penalty" → `moneyPunish()` → deducts GB$

**Goal:** Consequences are immediate, visible, and proportional. No abstract grounding — real currency/time is removed.

---

### 🏠 Family Tab (`#parentFamilyTab`)

**Purpose:** Manage family membership and identity.

#### ➕ Add a Child *(primary use)*
- Name + PIN (6+ chars)
- "Add Child" → `addKid()` → POST `/api/admin/create_kid`
- Server-side creation: parent **stays logged in** (Admin SDK used, not client sign-in)
- Kid signs in with name + PIN
- Status message shows kid's login name on success

#### 🪪 Your Family ID
- Displays `familyId` for the signed-in family
- Copy button
- Share with co-parents, kids' devices, etc.

#### Advanced Member Management *(edge cases)*
- Add member by Firebase UID (existing accounts)
- Remove member by UID or name
- Reset kid values: balance, minutes, lock status

#### Family Setup *(one-time)*
- Family name input → `setupFamily()`
- Seeds the Firestore family record — only needed on first creation

---

### 📋 Menus Tab (`#parentMenusTab`)

**Purpose:** Visual reference of all purchasable item menus.

**Components:**
- 🍕 Food Menu → `food_menu.png` (tappable, expands item grid)
- 🎮 Screen Time Menu → `gaming_menu.png` (tappable)
- 📚 Learning Rewards → `learning_menu.png` (tappable)

**Goal:** Let parents verify exactly what kids can buy. Audit menu accuracy. Reference prices when kids ask.

---

## Global Components

### User Bar (`#userBar`)
- Shown when authenticated
- Displays: family email / kid name
- Family ID in `#userBarFamilyId` (for parent: also shown in Family tab)
- "Sign Out" button → `signOut()` → clears state → returns to step0

### Purchase Modal (`#purchaseModal`)
- Triggered by any shop purchase
- Shows: item image, item name, cost, current balance, new balance
- Optional alternative item grid (select different option)
- "Confirm Purchase" → `confirmPurchase()` → writes ledger + deducts wallet
- Accessible: click outside to dismiss

### Status Pill (`#status`)
- `role="status" aria-live="polite"` for screen reader support
- Displays auth/operation feedback messages inline

---

## Backend API Endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/health` | none | Health check |
| POST | `/api/bootstrap` | any | Seed member + wallet on login |
| POST | `/api/setup_family` | any | Create family Firestore record |
| POST | `/api/admin/allotment` | admin | Distribute daily GB$ to kids |
| POST | `/api/admin/reward` | admin | Award GB$ for specific action |
| POST | `/api/admin/create_kid` | admin | Create kid Firebase Auth + membership (server-side) |
| POST | `/api/admin/add_member` | admin | Add existing Firebase UID to family |
| POST | `/api/admin/remove_member` | admin | Remove member |
| POST | `/api/admin/reset_kid` | admin | Reset kid wallet values |
| POST | `/api/kid/buy_screen` | kid | Purchase screen time minutes |
| POST | `/api/kid/buy_food` | kid | Purchase food item |
| POST | `/api/kid/start_session` | kid | Start timer session |
| POST | `/api/kid/stop_session` | kid | Stop timer session |
| POST | `/api/admin/time_punish` | admin | Apply time penalty |
| POST | `/api/admin/money_punish` | admin | Apply money penalty |

All routes require Firebase ID token in `Authorization: Bearer <token>` header (enforced by `@auth_required` decorator in `app.py`).

---

## Data Model (Firebase Realtime DB)

```
families/
  {familyId}/
    info/
      name: "Goodbody"
      adminEmail: "parent@email.com"
    members/
      {uid}/
        uid, name, role ("admin"|"kid"), createdTs
    wallets/
      {uid}/
        balanceGb, minutes, locked, updatedTs
    sessions/
      {uid}/
        active, mode, startTs, endTs, updatedTs
    ledger/
      {pushId}/
        ts, actorUid, targetUid, action, meta
```

---

## App-Wide Design Goals

| Goal | How It's Achieved |
|------|-------------------|
| Contribution before consumption | No GB$ = no spending. Wallet starts at 0. |
| Visible cause-and-effect | Every transaction logged in ledger. Balance always visible. |
| Parent controls everything | Admin-only endpoints for awards, punishments, member management |
| Reduce daily negotiation | Published prices replace bargaining. Rules are in the app. |
| Real consequences | Time and money removed instantly — not "I'll take your iPad away" |
| Positive reinforcement loop | Earning is visible, spending is satisfying, learning pays |
| Summer Academy integration | 8-week curriculum tied directly to daily GB$ allotment |
| Multi-device family | Family ID shared across devices; localStorage saves returning users |
