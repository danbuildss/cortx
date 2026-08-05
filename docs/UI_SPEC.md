# CORTX — UI Specification

---

## Design Language

CORTX feels like infrastructure software: Vercel dashboard, Better Stack, Linear, Railway. Not a consumer app. Not a SaaS trial landing page. The UI is precise, dense where it needs to be, and gives the builder confidence that the tool is serious.

### Typography

**Font:** Geist (sans) + Geist Mono (code, evidence, timestamps)

| Role | Class | Weight |
|---|---|---|
| Page heading | `text-2xl` | semibold |
| Section heading | `text-base` | semibold |
| Body | `text-sm` | regular |
| Label | `text-xs` | medium |
| Code / evidence | `text-xs` Geist Mono | regular |

No italic anywhere. No ultra bold (900).

### Colors (dark theme primary)

Background scale: `#000000` → `#181818` → `#1F1F1F` → `#272727` → `#313131`

| Token | Value | Use |
|---|---|---|
| `bg-page` | `#000000` | Page background |
| `bg-surface` | `#111111` | Cards, panels |
| `bg-elevated` | `#1a1a1a` | Modals, drawers |
| `bg-muted` | `#272727` | Input backgrounds, table stripes |
| `border-default` | `#2a2a2a` | All card/table borders |
| `text-primary` | `#f0f0f0` | Headings, primary content |
| `text-secondary` | `#888888` | Labels, secondary info |
| `text-muted` | `#555555` | Placeholder, disabled |
| `status-operational` | `#22c55e` | Green |
| `status-degraded` | `#f59e0b` | Amber |
| `status-critical` | `#ef4444` | Red |
| `status-unknown` | `#555555` | Grey |

### Spacing

Only use the defined spacing scale (see `landing-page-design` skill for full table). Key values:

- Card padding: `24px` (Spacing-300)
- Section gap: `32px` (Spacing-400)
- Table row height: `40px`
- Sidebar width: `240px`

### Corner Radius

- Cards: `rounded-lg` (8px)
- Badges: `rounded-md` (6px)
- Inputs: `rounded-md` (6px)
- Buttons: `rounded-md` (6px)
- Nested inner elements follow the nested radius formula: `inner = outer − gap`

### Status Badges

```
Operational   ● green dot + "Operational"   bg: green/10  text: green
Degraded      ● amber dot + "Degraded"      bg: amber/10  text: amber
Critical      ● red dot  + "Critical"       bg: red/10    text: red
Unknown       ● grey dot + "Unknown"        bg: grey/10   text: grey
```

Badge is a pill: `px-2 py-0.5 rounded-full text-xs font-medium`. Dot is `w-1.5 h-1.5 rounded-full` inline-flex.

### Terminal-Inspired Elements

Evidence blocks, raw request/response, JSON output:

```
bg: #0a0a0a
border: 1px solid #2a2a2a
border-radius: rounded-md
font: Geist Mono text-xs
padding: 12px 16px
color: #a0a0a0 (default), #22c55e (pass), #ef4444 (fail), #f59e0b (warning)
overflow-x: auto
```

---

## Sidebar Structure

Present on all authenticated pages.

```
[CORTX]                     ← wordmark, top-left

─────────────────
Overview
Services            (count badge if >0)
Incidents           (open count badge)
─────────────────
Settings
  Alert settings
─────────────────
[user email]        ← bottom, with sign out
```

- Width: 240px fixed
- Background: `#111111`
- Border-right: `1px solid #1f1f1f`
- Active item: white text + subtle `bg-white/5` background
- Hover: `bg-white/5`
- No icons in V1 (text only, cleaner)

---

## Page 1: Landing Page

**Purpose:** Convert Bankr builders into signups. One offer, one CTA.

**Layout type:** C (minimal conversion page — high-intent audience)

**Main sections:**
1. Nav (wordmark left, "Sign in" + "Get started" right)
2. Hero (headline, subheadline, primary CTA, proof line)
3. Tagline reveal (animated word-by-word scroll)
4. Pipeline diagram (6 stages: Availability → Payment Terms → Payment → Delivery → JSON → Schema)
5. How it works (3 steps)
6. Footer (privacy, terms)

**Hero copy:**
- Headline: "Your endpoint is up. Is it working?"
- Subheadline: "CORTX runs a real payment through your x402 service every few minutes — availability, price, delivery, and schema — and tells you the moment something breaks."
- CTA: "Start monitoring" → `/signup`
- Proof line: "Built for Bankr builders."

**Pipeline diagram:**
- 6 boxes connected by arrows: `Availability → Payment Terms → Payment → Delivery → JSON → Schema`
- Each box shows a stage name + green check or red X (in a static illustration showing a passing service)
- Terminal aesthetic: dark background, monospace labels

**Empty state:** N/A (public page)
**Loading state:** N/A (static)
**Error state:** N/A
**Mobile behavior:** Stack sections vertically. Nav collapses to wordmark + "Get started" only.
**Primary action:** "Start monitoring" → `/signup`

---

## Page 2: Login / Sign Up

**Purpose:** Authenticate the builder.

**Main sections:**
- Centered card, max-width 400px
- CORTX wordmark
- Email + password fields
- Submit button
- Toggle: "Already have an account? Sign in" / "Don't have an account? Sign up"

**Components:**
- Input: `bg-muted`, `border-default`, `rounded-md`
- Label above each input
- Error message below field (text-red, text-xs)
- Submit button: full-width, primary

**Empty state:** N/A
**Loading state:** Button shows spinner + "Signing in..."
**Error state:** Inline field errors + form-level error toast for network failures
**Mobile behavior:** Card becomes full-width with `px-4` padding
**Primary action:** Submit form

---

## Page 3: Overview

**Purpose:** Show all registered services and their current status at a glance.

**Main sections:**
- Page header: "Services" + "Add service" button (top right)
- Services table

**Services table columns:**
| Column | Content |
|---|---|
| Name | Service name (clickable → service detail) |
| Status | Status badge |
| Last check | Relative timestamp ("3m ago") |
| Latency | Last check latency in ms |
| Frequency | Check interval |
| Environment | Mainnet / Testnet badge |

**Empty state:**
```
No services yet
Add your first x402 service to start monitoring.
[Add service]
```
Center of page, no table shown.

**Loading state:** Table skeleton (3 rows, shimmer animation)
**Error state:** "Failed to load services. [Retry]"
**Mobile behavior:** Table collapses to card list. Each card shows name, status badge, last check time.
**Primary action:** "Add service" button

---

## Page 4: Add Service

**Purpose:** Register a new x402 endpoint for monitoring.

**Main sections:**
- Page header: "Add service" + "Cancel" link
- Single-column form, max-width 640px

**Form fields (in order):**

1. **Service name** — text input, placeholder "My x402 Service"
2. **Endpoint URL** — text input, placeholder "https://api.example.com/run", validated HTTPS
3. **Environment** — select: Mainnet / Testnet
4. **Safe test input** — JSON textarea, 8 rows, monospace font, placeholder `{"query": "test"}`
5. **Expected response schema** — JSON Schema textarea, 8 rows, monospace font
6. **Expected price** — number input + unit label (e.g., USDC)
7. **Maximum permitted test price** — number input + unit label, must be ≥ expected price
8. **Latency threshold** — number input + "ms" label
9. **Testing frequency** — select: Every 5 minutes / 15 minutes / 30 minutes / 1 hour
10. **Alert destination** — text input, placeholder "Telegram Chat ID"

**Below form:** "Add service" (primary) + "Cancel" (ghost)

**Components:**
- `<label>` above each field
- Helper text below complex fields (JSON fields, schema field)
- Zod validation on blur, all fields required
- JSON fields show syntax error inline

**Empty state:** N/A (form is always shown)
**Loading state:** Submit button disabled + spinner
**Error state:** Field-level inline errors; toast for server errors
**Mobile behavior:** Full-width form, same field order
**Primary action:** "Add service" → create and redirect to service detail

---

## Page 5: Service Detail

**Purpose:** Show the complete status, check history, and incidents for one service.

**Main sections:**
1. Page header: service name + status badge + "Edit" button + environment tag
2. **Signature pipeline component** (most recent check)
3. Open incidents (if any)
4. Check history table
5. Service configuration summary (collapsible)

### Signature Pipeline Component

This is the defining UI element of CORTX.

```
┌────────────┐    ┌──────────────┐    ┌─────────┐    ┌──────────┐    ┌──────┐    ┌────────┐
│Availability│ →  │Payment Terms │ →  │Payment  │ →  │Delivery  │ →  │JSON  │ →  │Schema  │
│    ✓       │    │    ✓         │    │   ✓     │    │   ✗      │    │  —   │    │   —    │
│   142ms    │    │  $0.01 USDC  │    │  paid   │    │ no body  │    │      │    │        │
└────────────┘    └──────────────┘    └─────────┘    └──────────┘    └──────┘    └────────┘
```

Each stage box:
- Stage name (Geist Mono, text-xs)
- Pass (✓ green) / Fail (✗ red) / Not reached (— grey)
- One line of evidence (latency, price, error summary)
- Clicking a box opens the evidence drawer for that stage

The whole component is a horizontal row of 6 connected boxes. On mobile, stacks vertically.

**Evidence Drawer:**
- Slides in from the right (or bottom on mobile)
- Shows full evidence for the selected stage:
  - Stage name and result
  - Timestamp
  - Duration
  - Raw evidence in terminal block (monospace, scrollable)
  - Expected vs observed (for price, schema)
- "Close" button or click outside to dismiss

### Check History Table

Columns: Timestamp | Status | Latency | Failure stage | Evidence link

- Newest first
- Failure stage column shows "—" for passing checks, stage name for failures
- Each row is clickable → check detail page

**Empty state:** "No checks yet. The first check will run within [next interval]."
**Loading state:** Table skeleton
**Error state:** "Failed to load checks. [Retry]"
**Mobile behavior:** Simplified columns: Timestamp + Status + link
**Primary action:** Click pipeline stage to open evidence drawer

---

## Page 6: Check Detail

**Purpose:** Full evidence for a single check run.

**Main sections:**
1. Back link: "← [Service name]"
2. Check header: timestamp, overall result, total latency
3. Signature pipeline component (this specific check's results)
4. Per-stage evidence panels (expanded, not in a drawer)

**Per-stage evidence panel:**
- Stage name + result badge
- Duration
- Terminal block: raw request sent, raw response received (secrets redacted)
- For price stage: expected vs observed table
- For schema stage: AJV validation output (which fields failed, expected type vs received type)

**Empty state:** N/A (page only reachable for existing checks)
**Loading state:** Skeleton panels
**Error state:** "Failed to load check evidence. [Retry]"
**Mobile behavior:** Panels stack vertically, terminal blocks scroll horizontally
**Primary action:** None (read-only evidence view)

---

## Page 7: Incidents

**Purpose:** List all incidents across all services.

**Main sections:**
- Page header: "Incidents"
- Filter: All / Open / Resolved (tab or segmented control)
- Incidents table

### Incident Cards / Table

Columns: Service | Status | Severity | Opened | Resolved | Failure stage

**Incident status badges:**
- `Open` — red pill
- `Acknowledged` — amber pill
- `Resolved` — green pill

**Severity badges:**
- `Critical` — red text
- `Degraded` — amber text

Each row is clickable → incident detail (inline expand or separate page)

**Incident detail (expanded row or drawer):**
- Incident timeline:
  - `[timestamp] Incident opened — [failure stage]`
  - `[timestamp] Acknowledged by [user]` (if applicable)
  - `[timestamp] Resolved — [auto / manual]`
- "Acknowledge" button (if Open)
- "Resolve" button (if Open or Acknowledged)
- Link to triggering check

**Empty state:**
```
No incidents
All monitored services are passing their checks.
```

**Loading state:** Table skeleton
**Error state:** "Failed to load incidents. [Retry]"
**Mobile behavior:** Cards instead of table rows
**Primary action:** Acknowledge or Resolve buttons on open incidents

---

## Page 8: Alert Settings

**Purpose:** Configure Telegram alert destination per service (or globally if applicable in V1).

**Main sections:**
- Page header: "Alert settings"
- Per-service alert configuration table (service name + current chat ID + edit)
- "How to get your Telegram Chat ID" instructions (static, collapsible)

**Components:**
- Inline edit for each service's chat ID
- Save button per row (or global save)
- Test alert button: sends a test Telegram message to verify the chat ID works

**Empty state:** Shows all registered services with empty chat ID fields.
**Loading state:** Table skeleton
**Error state:** Inline error if Telegram delivery fails during test
**Mobile behavior:** Full-width form per service
**Primary action:** Save alert configuration + test alert

---

## Shared Components

### Tables

- Background: `bg-surface`
- Header row: `text-xs text-muted uppercase tracking-wide`
- Row height: `40px`
- Row hover: `bg-white/5`
- Border: `border-b border-default` between rows
- Clickable rows: cursor-pointer

### Buttons

| Variant | Style |
|---|---|
| Primary | `bg-white text-black hover:bg-white/90` |
| Secondary | `border border-default text-primary hover:bg-white/5` |
| Destructive | `bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20` |
| Ghost | `text-secondary hover:text-primary hover:bg-white/5` |

### Forms

- Inputs: `bg-muted border border-default rounded-md px-3 py-2 text-sm text-primary`
- Focus ring: `ring-2 ring-white/20`
- Error state: `border-red-500`
- Labels: `text-xs font-medium text-secondary mb-1`

### Toasts

- Position: bottom-right
- Success: green left border
- Error: red left border
- Duration: 4 seconds auto-dismiss
- No stacking in V1
