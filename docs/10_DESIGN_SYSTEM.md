# FinSight AI — Design System & Styling

> This document covers the complete visual design system: color palette, typography, spacing conventions, currency formatting, and component styling patterns.

---

## Theme Philosophy

FinSight AI uses a **premium dark mode** design as its primary (and only) theme. The design language is:
- **Minimal and data-dense** — Information is organized into cards with subtle borders, not heavy dividers.
- **Accent-driven** — A single bright accent color (lime `#C8FF00`) is used sparingly for calls-to-action, chart lines, and key highlights.
- **Legible** — High contrast primary text on dark backgrounds, with muted secondary text for labels.

---

## Color Palette

All colors are defined in `frontend/tailwind.config.ts` as custom Tailwind tokens under the `colors` key. These are the only colors used in the UI — generic Tailwind colors (plain `red`, `blue`, `green`, etc.) are not used.

### Background Colors

| Token | Hex Value | Usage |
|-------|-----------|-------|
| `background` | `#0B0D11` | Main page background |
| `sidebar` | `#090B0F` | Sidebar navigation background (slightly darker) |
| `card` | `#12141B` | Card backgrounds (portfolios, news, indices) |
| `card2` | `#0E1014` | Nested cards, secondary card variants |
| `dim` | `#1D2028` | Muted background elements (dividers, hover states) |

### Border Colors

| Token | Value | Usage |
|-------|-------|-------|
| `border` | `rgba(255,255,255,0.07)` | Default card borders — very subtle |
| `border-hi` | `rgba(255,255,255,0.13)` | Higher contrast borders (hover, active states) |

### Text Colors

| Token | Hex Value | Usage |
|-------|-----------|-------|
| `text` | `#ECEEF2` | Primary text: headings, values, important labels |
| `muted` | `#636B7A` | Secondary text: field labels, timestamps, subtitles |

### Accent Colors

| Token | Hex Value | Usage |
|-------|-----------|-------|
| `lime` | `#C8FF00` | Primary accent: CTA buttons, active nav items, chart lines, key metrics |
| `lime-dim` | `rgba(200,255,0,0.12)` | Lime-tinted backgrounds (hover states, active badges) |
| `purple` | `#9B72FF` | Secondary accent: AI-related elements, badges |
| `pink` | `#FF4FD8` | Tertiary accent: select highlights |

### Semantic Colors

| Token | Hex Value | Usage |
|-------|-----------|-------|
| `green` | `#4ADE80` | Positive values: price gains, positive P&L, bullish sentiment |
| `red` | `#F87171` | Negative values: price drops, negative P&L, bearish sentiment |
| `amber` | `#FBBF24` | Warning states: triggered alerts, neutral sentiment badges |

---

## Typography

### Font Families

| Role | Font | Source | CSS Variable |
|------|------|--------|-------------|
| **Headings** | Outfit | Google Fonts | `--font-outfit` |
| **Body / Labels** | DM Sans | Google Fonts | `--font-dm-sans` |

Both fonts are loaded via Next.js `next/font/google` in `layout.tsx` and applied to the `<html>` element as CSS variables. Tailwind uses `font-heading` and `font-body` utility classes mapped to these variables.

### Type Scale

| Element | Tailwind Classes | Notes |
|---------|-----------------|-------|
| Page titles | `text-2xl font-heading font-semibold text-text` | |
| Section headings | `text-lg font-heading font-medium text-text` | |
| Card headings | `text-base font-semibold text-text` | |
| Body text | `text-sm font-body text-text` | |
| Labels / captions | `text-xs font-body text-muted` | |
| Numbers (prices) | `text-2xl font-heading font-bold text-text` | Larger for hero values |
| Positive values | add `text-green` | Always paired with `+` prefix |
| Negative values | add `text-red` | Always paired with `-` prefix |

---

## Spacing & Layout Conventions

- **Page padding:** `p-6` or `p-8` on the main content area.
- **Card padding:** `p-4` or `p-5` inside cards.
- **Card gap:** `gap-4` between cards in grid layouts.
- **Border radius:** Cards use `rounded-xl` (12px). Buttons use `rounded-lg` (8px). Badges use `rounded-full`.
- **Card border:** `border border-border` (uses the `border` color token).
- **Grid layout:** Dashboard uses CSS grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-4`) for responsive index cards.

---

## Component Visual Patterns

### Cards

Standard card pattern:
```html
<div class="bg-card border border-border rounded-xl p-4">
  <!-- content -->
</div>
```

Hover-interactive cards add:
```html
class="hover:border-border-hi transition-colors duration-200"
```

### Buttons

Primary CTA button (lime):
```html
<button class="bg-lime text-background font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
  Buy
</button>
```

Destructive button (red):
```html
<button class="bg-red/10 text-red border border-red/20 font-medium px-4 py-2 rounded-lg hover:bg-red/20">
  Delete
</button>
```

### Badges / Pills

Sentiment badge pattern:
```html
<!-- Positive -->
<span class="bg-green/10 text-green text-xs px-2 py-0.5 rounded-full font-medium">positive</span>

<!-- Negative -->
<span class="bg-red/10 text-red text-xs px-2 py-0.5 rounded-full font-medium">negative</span>

<!-- Neutral -->
<span class="bg-amber/10 text-amber text-xs px-2 py-0.5 rounded-full font-medium">neutral</span>
```

### Value Display (Gain/Loss)

```html
<!-- Positive -->
<span class="text-green font-semibold">+₹1,530.00 (+8.40%)</span>

<!-- Negative -->
<span class="text-red font-semibold">-₹420.00 (-2.30%)</span>
```

---

## Custom Scrollbar Styling

Defined in `frontend/src/app/globals.css`:

```css
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
```

This creates a thin (4px), transparent-backed scrollbar that blends into the dark theme while remaining visible on hover.

---

## Currency Formatting

All monetary values displayed in the UI are in **Indian Rupees (₹)**.

The `formatINR()` utility in `lib/utils.ts` uses:
```typescript
value.toLocaleString('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
```

This produces the Indian number formatting convention:
- `₹1,82,050.00` (lakhs grouping: 1,00,000 = 1 lakh)
- `₹19,28,00,00,00,000.00` (crores)

---

## Chart Styling (Recharts)

The portfolio value area chart on the dashboard uses Recharts `AreaChart` with:
- **Fill color:** `lime` (`#C8FF00`) with opacity gradient (100% → 0%)
- **Stroke color:** `lime` (`#C8FF00`)
- **Grid lines:** `rgba(255,255,255,0.05)` — barely visible
- **Tooltip background:** `card` (`#12141B`) with `border-border`
- **Axis text:** `muted` (`#636B7A`)
- **No dot markers** on the line (clean look)

---

## TailwindCSS Configuration Summary

`frontend/tailwind.config.ts` extends the default Tailwind theme with:

```typescript
theme: {
  extend: {
    colors: {
      background: "#0B0D11",
      sidebar: "#090B0F",
      card: "#12141B",
      card2: "#0E1014",
      border: "rgba(255,255,255,0.07)",
      "border-hi": "rgba(255,255,255,0.13)",
      lime: "#C8FF00",
      "lime-dim": "rgba(200,255,0,0.12)",
      text: "#ECEEF2",
      muted: "#636B7A",
      dim: "#1D2028",
      green: "#4ADE80",
      red: "#F87171",
      amber: "#FBBF24",
      purple: "#9B72FF",
      pink: "#FF4FD8",
    },
    fontFamily: {
      heading: ["var(--font-outfit)", "sans-serif"],
      body: ["var(--font-dm-sans)", "sans-serif"],
    },
  },
}
```

`content` is set to scan all `.tsx` and `.ts` files under `src/` for class usage.
