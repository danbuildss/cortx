# CORTX Design System

> The single source of truth for colors, typography, spacing, components, and conventions. Read this before adding UI.

---

## Principles

- **Dark by default, light supported.** The app shell is dark; the landing page is light-first. Both themes are fully implemented everywhere.
- **Dense, not minimal.** Information density over whitespace. Data should be readable at a glance — no decorative padding, no unnecessary chrome.
- **Semantic color.** Status (operational / degraded / critical) is encoded in color _and_ text, never color alone.
- **Inline SVG icons only.** 14×14, stroke 1.5px, `strokeLinecap="round"` `strokeLinejoin="round"`. No icon library. Custom drawn per component.
- **CSS custom properties everywhere.** Never hardcode hex values in component code. Always use a token.

---

## Fonts

| Role | Font | Usage |
|------|------|-------|
| App sans | `var(--font-geist-sans)` (Geist Sans) | All app UI text |
| App mono | `var(--font-geist-mono)` (Geist Mono) | Code, IDs, timestamps, latency values |
| Landing | `'Inter', 'Inter Variable', system-ui` | Marketing / landing page only |

Font features on landing: `"cv01", "ss03"` (Inter alternates).  
`-webkit-font-smoothing: antialiased` on both surfaces.

---

## Color Tokens — App (`globals.css`)

The app is dark by default. Light theme via `[data-theme="light"]` on `<html>`.  
Theme stored in `localStorage` at key `cortx-app-theme`. Inline script in `(app)/layout.tsx` prevents flash.

### Backgrounds

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `--bg-page` | `#08090a` | `#f7f8f8` | Page background |
| `--bg-surface` | `#111214` | `#ffffff` | Cards, sidebar |
| `--bg-elevated` | `#16181d` | `#f3f4f6` | Elevated cards, modals |
| `--bg-subdued` | `#0d0e11` | `#f7f8f8` | Recessed areas |
| `--bg-muted` | `#1e2028` | `#e5e7eb` | Inputs, muted areas |
| `--bg-hover` | `rgba(255,255,255,0.05)` | `rgba(0,0,0,0.05)` | Hover states |

### Borders

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `--border-subtle` | `#16181d` | `#eaecef` | Hairline dividers |
| `--border-mid` | `#1e2028` | `#e5e7eb` | Section dividers |
| `--border-default` | `#2a2d35` | `#d1d5db` | Input borders, card borders |
| `--border-focus` | `rgba(255,255,255,0.22)` | `rgba(0,0,0,0.22)` | Focused input ring |

### Text

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `--text-primary` | `#f0f1f3` | `#0d0d0e` | Body text, headings |
| `--text-secondary` | `#9ca3af` | `#4b5563` | Supporting text, labels |
| `--text-muted` | `#6b7280` | `#6b7280` | Placeholders, disabled |
| `--text-dim` | `#4b5563` | `#9ca3af` | Very low-priority text |

### Sidebar

| Token | Dark | Light |
|-------|------|-------|
| `--sidebar-bg` | `#111214` | `#ffffff` |
| `--sidebar-border` | `#1e2028` | `#e5e7eb` |

### Status (semantic — never use for decoration)

| Token | Value | Meaning |
|-------|-------|---------|
| `--status-operational` | `#22c55e` | All checks passing |
| `--status-operational-bg` | `rgba(34,197,94,0.07)` | Operational background tint |
| `--status-operational-border` | `rgba(34,197,94,0.18)` | Operational border tint |
| `--status-degraded` | `#f59e0b` | Some failures, not critical |
| `--status-degraded-bg` | `rgba(245,158,11,0.08)` | Degraded background tint |
| `--status-critical` | `#ef4444` | Incident open, service down |
| `--status-critical-bg` | `rgba(239,68,68,0.08)` | Critical background tint |
| `--status-critical-border` | `rgba(239,68,68,0.2)` | Critical border tint |
| `--status-unknown` | `#6b7280` | No data yet |

Status colors map in code:

```ts
const STATUS_COLORS: Record<string, string> = {
  operational: 'var(--status-operational)',
  degraded:    'var(--status-degraded)',
  critical:    'var(--status-critical)',
  unknown:     'var(--text-muted)',
};
```

---

## Color Tokens — Landing (`landing.css`, scoped to `.lp`)

The landing page is light by default. Dark via `@media (prefers-color-scheme: dark)` + `[data-theme="dark"]`.

### Key landing tokens

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--bg` | `#f7f8f8` | `#08090a` | Page background |
| `--bg-white` | `#ffffff` | `#111214` | Card surfaces |
| `--bg-subtle` | `#f3f4f6` | `#16181d` | Subtle sections |
| `--text-1` | `#0d0d0e` | `#f0f1f3` | Primary text |
| `--text-2` | `#4b5563` | `#9ca3af` | Secondary text |
| `--text-3` | `#9ca3af` | `#6b7280` | Muted text |
| `--indigo` | `#5e6ad2` | _(same)_ | Brand accent |
| `--indigo-text` | `#4a57c5` | `#8b96e9` | Indigo on text |
| `--indigo-dim` | `rgba(94,106,210,0.08)` | `rgba(94,106,210,0.12)` | Accent background |
| `--cta-bg` | `#0d0d0e` | `#f0f1f3` | CTA button background |
| `--cta-text` | `#ffffff` | `#0d0d0e` | CTA button text |

### Shadows (landing only)

| Token | Light | Dark |
|-------|-------|------|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)` | `0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)` |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)` | `0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)` |
| `--shadow-xl` | `0 16px 48px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)` | `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)` |

### Border radius scale (landing)

| Token | Value | Use |
|-------|-------|-----|
| `--r-xs` | `2px` | Tags, chips |
| `--r-sm` | `4px` | Small elements |
| `--r-md` | `6px` | Buttons, inputs |
| `--r-lg` | `8px` | Nav items, badges |
| `--r-xl` | `12px` | Cards |
| `--r-2xl` | `16px` | Large cards |
| `--r-3xl` | `20px` | Feature panels |
| `--r-pill` | `9999px` | Status pills |

---

## Layout

### App shell

```
<html data-theme="dark|light">
  <body>
    <MobileNav />          ← sticky top bar, visible on mobile only
    <div class="app-shell"> ← display:flex; height:100vh; overflow:hidden
      <Sidebar />           ← 200px fixed, hidden on mobile
      <main>               ← flex:1; overflow-y:auto; background:var(--bg-page)
        {page content}
      </main>
    </div>
    <FeedbackWidget />      ← fixed bottom-right
  </body>
</html>
```

### Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| `≤768px` | Sidebar hidden, mobile nav bar visible, `.app-shell` height `calc(100vh - 48px)` |
| `>768px` | Sidebar visible, mobile nav hidden |

### Content padding

- Desktop pages: `padding: 24px` (via `.page-content`)
- Mobile: `padding: 16px` (overridden in `@media (max-width:768px)`)
- Overview grid on mobile: `grid-template-columns: repeat(2, 1fr)` → `1fr`

### Landing max-width

`max-width: 1120px; margin: 0 auto; padding: 0 24px`

---

## Components

### Buttons

**Primary (app)** — `.btn-primary`
```css
background: var(--text-primary);   /* inverted: white on dark, black on light */
color: var(--bg-page);
padding: 7px 14px;
border-radius: 6px;
font-size: 13px;
font-weight: 500;
transition: opacity 0.15s;
/* hover: opacity 0.85 */
```

**Nav ghost (landing)** — `.btn-nav-ghost`
```css
border: 1px solid var(--border);
color: var(--text-2);
padding: 5px 13px;
border-radius: var(--r-lg);  /* 8px */
font-size: 13px;
font-weight: 500;
```

**Nav CTA (landing)** — `.btn-nav-cta`
```css
background: var(--cta-bg);
color: var(--cta-text);
padding: 5px 15px;
border-radius: var(--r-lg);
font-size: 13px;
font-weight: 500;
/* hover: opacity 0.85 */
```

### Inputs — `.app-input`

```css
background: var(--bg-muted);
border: 1px solid var(--border-default);
border-radius: 6px;
padding: 8px 12px;
font-size: 13px;
color: var(--text-primary);
/* focus: border-color var(--border-focus) */
/* placeholder: var(--text-muted) */
/* option: background var(--bg-surface) */
```

### Nav links (sidebar) — `.app-nav-link`

```css
display: block;
padding: 7px 12px;
border-radius: 6px;
font-size: 13px;
font-weight: 400;
color: var(--text-secondary);
/* hover/active: background var(--bg-hover), color var(--text-primary) */
margin-bottom: 2px;
```

### Incident row — `.incident-row-link`

```css
transition: background 0.1s;
/* hover: background var(--bg-hover) */
```

---

## Icons

All icons are inline SVG, hand-drawn, consistent style:

```
width="14" height="14"
viewBox="0 0 16 16"
fill="none"
stroke="currentColor"
strokeWidth="1.5"
strokeLinecap="round"
strokeLinejoin="round"
```

Solid fill dots (status indicators) use `fill="currentColor" stroke="none"`.

**Current icon set:**
- `OverviewIcon` — 2×2 grid of squares with rx=1
- `ServicesIcon` — two horizontal bars (server rows) with small dot
- `IncidentsIcon` — triangle warning, line + dot
- `StatusPagesIcon` — globe with meridian lines
- `AlertsIcon` — bell with arc
- `AccountIcon` — person silhouette

When adding new icons: draw at 16×16 viewBox, use same stroke spec, export as a named function component collocated with its parent file.

---

## Animations

All defined in `globals.css`, applied via utility classes:

| Class | Keyframes | Duration | Use |
|-------|-----------|----------|-----|
| `.anim-fade-up` | `fadeUp` — translateY(6px) → 0, opacity 0→1 | 0.35s ease | Page section entrance |
| `.anim-fade-in` | `fadeIn` — opacity 0→1 | 0.3s ease | Quick reveals |
| `.donut-arc` | `donutFill` — stroke-dashoffset 283→0 | 1.1s cubic-bezier(0.4,0,0.2,1) 0.15s | Donut charts |
| `.chart-fade` | `fadeIn` | 0.6s ease 0.1s | Chart entrance |

**Stagger delays** (for metric card grids):

```css
.delay-1 { animation-delay: 0.05s; }
.delay-2 { animation-delay: 0.10s; }
.delay-3 { animation-delay: 0.15s; }
.delay-4 { animation-delay: 0.20s; }
```

Respect `prefers-reduced-motion` when adding new animations.

---

## Scrollbars

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #444; }
```

---

## Theme System

### App (dark default)
- Default: no `data-theme` needed — dark tokens in bare `:root`
- Light: `document.documentElement.setAttribute('data-theme', 'light')`
- Persisted in `localStorage` at key `cortx-app-theme`
- Flash prevention: inline script in `(app)/layout.tsx` reads storage before hydration

### Landing (light default, scoped to `.lp`)
- Default: light tokens on `.lp`
- Dark (OS): `@media(prefers-color-scheme:dark) { .lp:not([data-theme]) { … } }`
- Dark (manual): `.lp[data-theme="dark"] { … }`
- Light (manual): `.lp[data-theme="light"] { … }`
- Toggle button: `.btn-theme` — swaps moon/sun icon via `display` rules tied to `data-theme`

---

## Do / Don't

| Do | Don't |
|----|-------|
| Use CSS custom property tokens | Hardcode hex values in JSX/TSX |
| Encode status in text AND color | Use status color without a label |
| Use `var(--bg-hover)` for row hover | Write `rgba(...)` inline for hover |
| Draw SVG icons at 16×16 viewBox, 14×14 rendered | Import from an icon library |
| Use `--border-default` for input borders | Use `--border-subtle` for interactive borders |
| Cap response body display (already done in check runner) | Render unbounded user content |
| Use Geist Mono for timestamps, IDs, latency | Use Geist Sans for code or numbers |
| `border-radius: 6px` for buttons and inputs | Mix radius values without reason |

---

## Files

| File | What's in it |
|------|-------------|
| `app/globals.css` | App tokens (dark default), nav links, buttons, inputs, animations, responsive overrides |
| `app/landing.css` | Landing tokens (light default, `.lp` scoped), full nav, all sections, footer, dark theme override |
| `components/sidebar.tsx` | Sidebar layout, nav links, icon components, theme toggle logic |
| `components/mobile-nav.tsx` | Mobile top bar |
| `components/app-theme-provider.tsx` | Theme context + localStorage sync |
| `components/feedback-widget.tsx` | Fixed bottom-right feedback button |
