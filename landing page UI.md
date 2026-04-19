# FinSight AI — Landing Page Implementation Plan

> **Document Type:** Anti-Gravity Cloud Agent Execution Instructions  
> **Target Output:** Production-ready Next.js 14 landing page  
> **Stitch Project ID:** `5562709792059955014`  
> **Created:** April 17, 2026  
> **Scope:** Convert the provided HTML/Tailwind landing page UI into a clean, fully-connected Next.js 14 App Router page, wired to existing `/auth/login` and `/auth/signup` routes.

---

## ⚠️ PRE-EXECUTION RULES (Read First — Non-Negotiable)

1. **Stitch MCP First:** Before writing any code, connect to the Stitch MCP server and load project `5562709792059955014`. Pull the latest Stitch design tokens, component specs, and any overrides from the project. These take precedence over the raw HTML reference if there are conflicts.
2. **Protected Files:** The existing codebase is protected. The only file being **replaced** is `frontend/src/app/page.tsx` (which currently just redirects to `/dashboard`). Everything else is append or create-new only.
3. **Auth Routes Are Sacred:** Do NOT touch `frontend/src/app/auth/login/page.tsx` or `frontend/src/app/auth/signup/page.tsx`. Only link to them.
4. **Design System Consistency:** The project uses `tailwind.config.ts` with a custom dark theme (lime `#C8FF00`, card backgrounds, etc.). The landing page uses the same colour palette — verify tokens match before writing JSX.
5. **Single File Output:** The entire landing page must live in `frontend/src/app/page.tsx` as a single Server Component file (no `"use client"` unless strictly required for the ticker animation). Sub-components that are reused go into `frontend/src/components/landing/`.

---

## SECTION 1 — MCP CONNECTION & STITCH SETUP

### 1.1 — Connect to Stitch MCP Server

```
Tool: stitch_mcp
Action: connect
Project ID: 5562709792059955014
```

After connecting, instruct the agent to:
1. Pull the full design spec for project `5562709792059955014`
2. Extract: colour tokens, typography scale, spacing scale, component variants, animation specs
3. Download any custom SVG assets or icon overrides defined in the Stitch project
4. Note any component names in the Stitch project that map to sections in the HTML reference (Hero, FeatureCard, ProtocolStep, Footer, NavBar)

### 1.2 — Stitch Asset Extraction Checklist

Before writing a single line of JSX, confirm the following have been pulled from Stitch:

- [ ] Primary colour token (expected: `#C8FF00` — lime)
- [ ] Background colour token (expected: `#0e0e13`)
- [ ] Surface container token (expected: `#1f1f25`)
- [ ] Secondary colour token (expected: `#d2bbff` — purple)
- [ ] Error/negative colour token (expected: `#ffb4ab` — red)
- [ ] Typography: headline font (expected: `Inter`, weights 400/700/800)
- [ ] Typography: mono font (expected: `JetBrains Mono`, weights 400/500/700)
- [ ] Border radius tokens (expected: default `2px`, lg `4px`, xl `8px`, full `12px`)
- [ ] Any Stitch-specific overrides that differ from the HTML reference

If the Stitch project contains a `LandingPage` frame or artboard, use that as the definitive visual reference instead of the HTML document.

---

## SECTION 2 — ROUTE ARCHITECTURE

### 2.1 — Root Route Takeover

The current `frontend/src/app/page.tsx` simply redirects authenticated users to `/dashboard`. This file must be **replaced entirely** with the landing page component.

**New behaviour of `frontend/src/app/page.tsx`:**
- Unauthenticated users → See the full landing page
- Authenticated users → Redirect to `/dashboard` (preserve this logic via the existing `AuthContext`)

**Implementation approach:**

```tsx
// frontend/src/app/page.tsx
import { redirect } from 'next/navigation'
// Check auth state server-side if possible, else handle client-side
// If user is authenticated, redirect('/dashboard')
// Otherwise, render <LandingPage />
```

Because the existing project uses `frontend/src/lib/auth-context.tsx` for auth state (which is client-side), the redirect logic should be handled in `frontend/src/middleware.ts` — which already exists and handles protected routes. Check the middleware: if it already redirects `/` for authenticated users to `/dashboard`, no change is needed in `page.tsx` itself.

### 2.2 — New Files to Create

```
frontend/src/app/page.tsx                        ← REPLACE (was a redirect stub)
frontend/src/components/landing/NavBar.tsx        ← CREATE NEW
frontend/src/components/landing/TickerTape.tsx    ← CREATE NEW (needs "use client")
frontend/src/components/landing/HeroSection.tsx   ← CREATE NEW
frontend/src/components/landing/TrustBar.tsx      ← CREATE NEW
frontend/src/components/landing/FeatureGrid.tsx   ← CREATE NEW
frontend/src/components/landing/ProtocolSection.tsx ← CREATE NEW
frontend/src/components/landing/LandingFooter.tsx ← CREATE NEW
```

### 2.3 — Button Routing Map

| Button / Link | Current HTML `href` | Next.js `href` | Component |
|---|---|---|---|
| "Login" (NavBar) | `#` | `/auth/login` | `NavBar.tsx` |
| "Sign In" (NavBar) | `#` | `/auth/signup` | `NavBar.tsx` |
| "Institutional Access" (NavBar CTA) | none | `/auth/signup` | `NavBar.tsx` |
| "Login" (Hero CTA — left button) | none | `/auth/login` | `HeroSection.tsx` |
| "Sign In" (Hero CTA — right button) | none | `/auth/signup` | `HeroSection.tsx` |
| Footer "Market Overview" | `#` | `/dashboard` (post-auth) | `LandingFooter.tsx` |
| Footer "Portfolio Health" | `#` | `/portfolio` (post-auth) | `LandingFooter.tsx` |
| Footer "Alpha Signals" | `#` | `/ai-research` (post-auth) | `LandingFooter.tsx` |
| Footer "API Documentation" | `#` | `/docs` or `#` (static) | `LandingFooter.tsx` |
| Footer "Privacy Policy" | `#` | `/privacy` or `#` (static) | `LandingFooter.tsx` |
| Footer "Status" | `#` | `#` (static) | `LandingFooter.tsx` |
| Footer "Contact Support" | `#` | `#` (static) | `LandingFooter.tsx` |
| Footer "X / Twitter" | `#` | `#` (social, leave as-is) | `LandingFooter.tsx` |
| Footer "LinkedIn" | `#` | `#` (social, leave as-is) | `LandingFooter.tsx` |

**Critical rule:** Every "Login" reference routes to `/auth/login`. Every "Sign In" or "Sign Up" or "Register" reference routes to `/auth/signup`. Do not mix them.

---

## SECTION 3 — DEPENDENCY & FONT SETUP

### 3.1 — Google Fonts

The landing page uses two fonts not currently loaded by the main app layout:
- `Inter` (already likely loaded — verify in `layout.tsx`)
- `JetBrains Mono` (new — needs to be added)

**Action:** Open `frontend/src/app/layout.tsx` and check the existing font imports. If `JetBrains Mono` is not there, **append** it to the `next/font/google` import. Do not modify any existing font setup.

```tsx
// Append to the existing font import block in layout.tsx
import { JetBrains_Mono } from 'next/font/google'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains-mono',
})
```

Then add `jetbrainsMono.variable` to the `<body>` className alongside existing font variables.

### 3.2 — Material Symbols Icon Font

The landing page uses Google Material Symbols Outlined icons (`query_stats`, `smart_toy`, `analytics`, `architecture`, `tune`).

**Action:** Add the Material Symbols stylesheet to `frontend/src/app/layout.tsx` inside the existing `<head>` section (via Next.js `<link>` tag or metadata):

```tsx
// In layout.tsx <head> or via next/head
<link
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,300,0,0"
  rel="stylesheet"
/>
```

### 3.3 — Tailwind Config Verification

The landing page HTML references many custom colour tokens (e.g., `bg-surface-container`, `text-on-surface-variant`, `text-secondary`, `text-error`, `border-outline-variant`). These must exist in `frontend/tailwind.config.ts`.

Cross-reference the HTML's Tailwind colour names against the existing `tailwind.config.ts`. The current config uses different token names (`background`, `card`, `lime`, `muted`, etc.).

**Resolution approach:**
- Where the HTML uses `bg-surface` → use `bg-[#131318]` (hardcode with the hex from the Tailwind config in the HTML)
- Where the HTML uses `text-on-surface-variant` → use `text-[#bacac2]`
- Where the HTML uses `text-secondary` → use `text-[#d2bbff]`
- Where the HTML uses `text-error` → use `text-[#ffb4ab]`
- Where the HTML uses `bg-surface-container` → use `bg-[#1f1f25]`

**Do not modify `tailwind.config.ts`** — use inline hex values from the Material Design token spec embedded in the HTML's Tailwind config block for the landing page only. This keeps the landing page self-contained without disrupting the existing app's design system.

---

## SECTION 4 — COMPONENT SPECIFICATIONS

### 4.1 — `NavBar.tsx` (Fixed Floating Pill Navigation)

**File:** `frontend/src/components/landing/NavBar.tsx`  
**Type:** `"use client"` (needed for scroll-based transparency effects if added later; safe to start as server component and upgrade)

**Structure:**
```
<header> fixed, top-0, left-0, right-0, z-50, flex, items-center, justify-center, pt-6, px-4
  <nav> glass pill shape — bg-white/5, backdrop-blur-xl, rounded-full, max-w-fit, px-8, py-3, border border-white/10, shadow
    <span> Logo text — "FinSight AI", text-xl, font-bold, text-[#e4e1e9], Inter font
    <div> Nav links (hidden on mobile, flex on md+)
      <Link href="/auth/login"> "Login" — active style: text-[#C8FF00], border-b border-[#C8FF00]
      <Link href="/auth/signup"> "Sign In"
    <Link href="/auth/signup">
      <button> "Institutional Access" — CTA pill button
```

**CTA Button Styles:**
- Background: `bg-[#C8FF00]`
- Text: `text-[#002118]`
- Shape: `rounded-full`
- Size: `px-5 py-2`
- Font: `text-xs font-bold uppercase tracking-wider`
- Hover: `hover:brightness-110`
- Active: `active:scale-95`
- Shadow: `shadow-[0_0_15px_rgba(200,255,0,0.3)]`

**Important:** In Next.js, use `<Link>` from `next/link` instead of `<a>` for all internal routes.

---

### 4.2 — `TickerTape.tsx` (Scrolling Market Data Strip)

**File:** `frontend/src/components/landing/TickerTape.tsx`  
**Type:** `"use client"` ← Required (CSS animation + potential future live data hook)

**Structure:**
```
<div> ticker-wrap — width 100%, overflow-hidden, bg-white/2, border-bottom: 1px solid rgba(200,255,0,0.1), py-2
  <div> ticker — display flex, white-space nowrap, animation: ticker 30s linear infinite
    [Duplicate the stock items twice for seamless infinite scroll loop]
```

**Stock items to display (static for V1 — replace with live data in future sprint):**

| Symbol | Value | Direction |
|---|---|---|
| RELIANCE.NS | +2.4% | positive (lime) |
| NIFTY 50 | 22,345.20 (+0.8%) | positive (lime) |
| SENSEX | 73,651.35 (+0.7%) | positive (lime) |
| TCS.NS | -1.2% | negative (red: `#ffb4ab`) |
| HDFCBANK.NS | +0.4% | positive (lime) |
| INFY.NS | -0.5% | negative (red: `#ffb4ab`) |

**CSS Animation (add to `globals.css` or as a `<style>` tag inside the component using Next.js `<style jsx>`):**

```css
@keyframes ticker {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.ticker-animate {
  animation: ticker 30s linear infinite;
}
```

**Font:** `JetBrains Mono`, `text-xs`, `tracking-tighter`

**Gap between items:** `space-x-12` (48px horizontal gap)

**Live Data Note (future):** In a later sprint, replace the hardcoded items with a `useEffect` that calls `marketApi.getIndices()` and `marketApi.getMovers()` every 30 seconds. For V1, static data is acceptable.

---

### 4.3 — `HeroSection.tsx` (Main Landing Hero)

**File:** `frontend/src/components/landing/HeroSection.tsx`

**Structure:**
```
<section> relative, px-8 md:px-24, py-20 lg:py-32, flex flex-col, items-center, text-center
  
  [Background gradient overlay]
  <div> absolute inset-0, bg-gradient-to-b from-[#C8FF00]/5 to-transparent, pointer-events-none

  [Headline]
  <h1> text-6xl md:text-8xl, font-extrabold, text-[#e4e1e9], tracking-tighter, mb-6, max-w-4xl, leading-tight
    "Intelligence behind"
    <br/>
    <span class="text-[#C8FF00]">"every rupee."</span>

  [Subheadline]
  <p> text-[#bacac2], text-lg md:text-xl, max-w-2xl, mb-10, leading-relaxed
    "Real-time analytics and portfolio intelligence for the modern Indian investor. 
    Experience sovereign-grade data processing for your retail wealth."

  [CTA Buttons Row]
  <div> flex, gap-4
    <Link href="/auth/login">
      <button> Primary — bg-[#C8FF00], text-[#002118], px-8 py-4, rounded-lg, font-bold, text-lg
              hover:shadow-[0_0_30px_rgba(200,255,0,0.4)], transition-all
        "Login"
    <Link href="/auth/signup">
      <button> Secondary — border border-[#3b4a44], text-[#e4e1e9], px-8 py-4, rounded-lg, font-bold, text-lg
              hover:bg-white/5, transition-all
        "Sign In"

  [Dashboard Preview Image]
  <div> mt-20, w-full, max-w-5xl, relative, group
    [Glow effect behind card]
    <div> absolute -inset-1, bg-gradient-to-r from-[#C8FF00] to-[#d2bbff], blur-2xl, opacity-20, 
         group-hover:opacity-30, transition duration-1000
    [Card]
    <div> relative, glass-card, rounded-2xl, overflow-hidden, aspect-video, shadow-2xl
      <img> w-full, h-full, object-cover, mix-blend-luminosity, hover:mix-blend-normal, transition duration-700
           src: (Stitch project image asset, or use the src from HTML reference)
           alt: "FinSight AI financial dashboard preview"
      [Gradient overlay on image]
      <div> absolute inset-0, bg-gradient-to-t from-[#131318] to-transparent, opacity-60
      [macOS-style traffic light dots]
      <div> absolute top-6 left-6, flex gap-2
        <div> w-3 h-3, rounded-full, bg-[#ffb4ab]   ← red
        <div> w-3 h-3, rounded-full, bg-yellow-500   ← yellow
        <div> w-3 h-3, rounded-full, bg-[#C8FF00]    ← green
```

**Glass card utility class** (add to `globals.css`):
```css
.glass-card {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
```

**Dashboard preview image:** Pull from Stitch project `5562709792059955014`. If no specific image asset is defined there, use the `src` URL from the HTML reference as a fallback. Wrap in Next.js `<Image>` component (not raw `<img>`) for optimisation:

```tsx
import Image from 'next/image'

<Image
  src="<stitch-asset-url-or-html-fallback-url>"
  alt="FinSight AI financial dashboard preview"
  fill
  className="object-cover mix-blend-luminosity group-hover:mix-blend-normal transition-all duration-700"
/>
```

---

### 4.4 — `TrustBar.tsx` (Statistics Strip)

**File:** `frontend/src/components/landing/TrustBar.tsx`

**Structure:**
```
<section> bg-[#0e0e13], py-16 px-8, border-y: 1px solid rgba(255,255,255,0.05)
  <div> max-w-7xl mx-auto, grid, gap-8, md:grid-cols-3, grid-cols-1
    [Stat 1]
    <div> text-center
      <p> JetBrains Mono, text-[#C8FF00], text-3xl, font-bold → "1,200+"
      <p> text-[#bacac2], text-xs, uppercase, tracking-widest, mt-2 → "Active Stocks"
    [Stat 2]
    <div> text-center
      <p> "98.7%"
      <p> "System Uptime"
    [Stat 3]
    <div> text-center
      <p> "< 200ms"
      <p> "Data Latency"
```

---

### 4.5 — `FeatureGrid.tsx` (Bento Feature Cards)

**File:** `frontend/src/components/landing/FeatureGrid.tsx`

**Section wrapper:**
```
<section> py-32 px-8 md:px-24
  [Section Header]
  <div> mb-16
    <h2> text-4xl, font-bold, text-[#e4e1e9], tracking-tight, mb-4 → "Sovereign Capabilities"
    <div> w-20 h-1 bg-[#C8FF00]   ← lime underline accent
  
  [Bento Grid]
  <div> grid, grid-cols-1 lg:grid-cols-3, gap-6
    <PortfolioCard />
    <AIResearchCard />
    <LiveTerminalCard />
```

#### Sub-Card: Portfolio Intelligence Card

```
<div> glass-card, rounded-2xl, p-8, relative, overflow-hidden, group, flex flex-col, justify-between
  [Icon — top right absolute]
  <div> absolute top-0 right-0 p-8
    <span> Material Symbol "query_stats", text-[#C8FF00], text-4xl

  [Content]
  <div> relative z-10, flex flex-col, h-full
    <h3> text-2xl, font-bold, mb-4 → "Portfolio"
    <p> text-[#bacac2], mb-8 → "Deep-dive into risk exposure, sector correlation..."

    [Metric rows — bottom]
    <div> space-y-4 mt-auto
      <div> bg-[#1f1f25], p-4, rounded-xl, flex items-center justify-between, border-l-4 border-[#C8FF00]
        <span> JetBrains Mono, text-sm → "Diversification Score"
        <span> text-[#C8FF00], font-bold → "88/100"
      <div> bg-[#1f1f25], p-4, rounded-xl, flex items-center justify-between, border-l-4 border-[#d2bbff]
        <span> "Risk-Adjusted Return"
        <span> text-[#d2bbff], font-bold → "2.44"

  [Background abstract image — bottom right]
  <img> absolute, bottom-0, right-0, w-1/2, opacity-20, group-hover:opacity-40, transition-opacity
       (Pull from Stitch assets)
```

#### Sub-Card: AI Research Chat Card

```
<div> glass-card, rounded-2xl, p-8, flex flex-col, justify-between, border-t-2 border-[#d2bbff]/30
  [AI Header Row]
  <div> flex items-center gap-2 mb-6
    <div> w-8 h-8, rounded-full, bg-[#d2bbff], flex items-center justify-center
      <span> Material Symbol "smart_toy", text-[#131318], text-sm
    <span> font-bold, text-[#d2bbff] → "AI Research"

  [Chat Preview]
  <div> space-y-4
    [User bubble]
    <div> bg-[#2a292f], p-3, rounded-lg, text-sm, text-[#bacac2]
      "Compare Tata Motors vs Mahindra & Mahindra for the next 12 months?"
    [AI response bubble]
    <div> bg-[#d2bbff]/10, p-3, rounded-lg, text-sm, border border-[#d2bbff]/20
      <span> text-[#d2bbff], font-bold, block, mb-1, italic → "Analyst AI:"
      "Based on EV roadmap and commercial volume, Tata Motors shows a 14% higher alpha potential..."

  [Bottom divider + security note]
  <div> mt-auto pt-8
    <div> h-[1px] bg-white/5 mb-4
    <p> text-xs, text-[#bacac2], JetBrains Mono → "SECURE SESSION ENCRYPTED"
```

#### Sub-Card: Live Terminal Card

```
<div> glass-card, rounded-2xl, p-8, overflow-hidden, group, border-t-2 border-[#C8FF00]/30, flex flex-col
  <h3> text-2xl, font-bold, mb-4, JetBrains Mono, tracking-tight → "LIVE TERMINAL"

  [Terminal readout lines]
  <div> JetBrains Mono, text-[10px], space-y-2, opacity-70, mt-auto
    <div> flex justify-between
      <span> "FETCH_NIFTY50_RT"   <span> text-[#C8FF00] → "OK"
    <div> flex justify-between
      <span> "LATENCY_MS"         <span> text-[#C8FF00] → "142"
    <div> flex justify-between
      <span> "WS_STREAM_CONNECT"  <span> text-[#C8FF00] → "ACTIVE"
    <div> h-[1px] bg-white/10 my-4
    <div> text-[#e4e1e9] → "SCANNING ORDER BOOKS..."
    <div> text-[#d2bbff] → "WHALE MOVEMENT DETECTED: HDFCBANK"
```

---

### 4.6 — `ProtocolSection.tsx` (The 3-Step Methodology)

**File:** `frontend/src/components/landing/ProtocolSection.tsx`

**Structure:**
```
<section> py-32 px-8 md:px-24, bg-[#1b1b20], overflow-hidden
  <div> max-w-7xl mx-auto

    [Section eyebrow + headline]
    <div> text-center mb-24
      <h2> JetBrains Mono, text-[#C8FF00], text-sm, uppercase, tracking-[0.3em], mb-4
           → "The Methodology"
      <p> text-4xl md:text-5xl, font-bold, tracking-tight → "The Wealth Protocol"

    [3-Step row]
    <div> relative, flex flex-col md:flex-row, justify-between, items-center, gap-12

      [Connecting line — desktop only]
      <div> hidden md:block, absolute, top-1/2, left-0, w-full, h-[1px],
           bg-gradient-to-r from-transparent via-[#C8FF00]/30 to-transparent, -translate-y-1/2

      [Step 1 — Analyze]
      <div> relative z-10, flex flex-col, items-center, text-center, max-w-xs, group
        <div> w-16 h-16, rounded-full, bg-[#131318], border border-[#C8FF00], flex items-center justify-center, mb-6,
             shadow-[0_0_20px_rgba(200,255,0,0.2)], group-hover:scale-110, transition-transform
          <span> Material Symbol "analytics", text-[#C8FF00]
        <h4> text-xl, font-bold, mb-2 → "1. Analyze"
        <p> text-[#bacac2], text-sm → "Our AI scans 10,000+ data points..."

      [Step 2 — Build]
      <div> (same structure, border and shadow use [#d2bbff] purple)
        <span> Material Symbol "architecture", text-[#d2bbff]
        "2. Build"

      [Step 3 — Optimize]
      <div> (same structure as Step 1 — back to lime)
        <span> Material Symbol "tune", text-[#C8FF00]
        "3. Optimize"
```

---

### 4.7 — `LandingFooter.tsx` (Footer)

**File:** `frontend/src/components/landing/LandingFooter.tsx`

**Note:** This is a separate `LandingFooter` to avoid conflicting with any existing footer component. The existing app uses no global footer (the layout only adds Sidebar + Providers). This component is only rendered on the landing page.

**Structure:**
```
<footer> bg-[#0e0e13], w-full, px-8 md:px-16 lg:px-24, pt-20 pb-10, border-t border-white/5
         JetBrains Mono, text-xs, uppercase, tracking-widest

  [4-column grid]
  <div> grid, grid-cols-1 md:grid-cols-4, gap-12, mb-16

    [Column 1 — Brand]
    <div> col-span-1
      <span> text-lg, font-black, text-[#C8FF00], mb-6, block → "FinSight AI"
      [Live status indicator]
      <div> flex items-center gap-3
        <div> relative flex h-2 w-2
          <span> animate-ping, absolute, inline-flex, h-full w-full, rounded-full, bg-[#C8FF00], opacity-75
          <span> relative, inline-flex, rounded-full, h-2 w-2, bg-[#C8FF00]
        <span> text-[#bacac2] → "System Operational"

    [Column 2 — Terminal]
    <div>
      <h5> text-white, mb-6, font-bold → "Terminal"
      <ul> space-y-4
        <li><Link href="/dashboard"> "Market Overview"</Link>
        <li><Link href="/ai-research"> "Alpha Signals"</Link>
        <li><Link href="/portfolio"> "Portfolio Health"</Link>

    [Column 3 — Protocol]
    <div>
      <h5> → "Protocol"
      <ul> space-y-4
        <li><a href="#"> "API Documentation"</a>
        <li><a href="#"> "Whitepaper"</a>
        <li><a href="#"> "Compliance"</a>

    [Column 4 — Support]
    <div>
      <h5> → "Support"
      <ul> space-y-4
        <li><a href="#"> "Contact Support"</a>
        <li><a href="#"> "Privacy Policy"</a>
        <li><a href="#"> "Status"</a>

  [Bottom bar]
  <div> flex flex-col md:flex-row, justify-between, items-center, border-t border-white/5, pt-8, opacity-80
    <p> → "© 2024 FinSight AI. Sovereign Intelligence for the Lunar Vault."
    <div> flex gap-6 mt-4 md:mt-0
      <a href="#" hover:text-[#C8FF00]> "X / TWITTER"</a>
      <a href="#" hover:text-[#C8FF00]> "LINKEDIN"</a>
```

---

## SECTION 5 — ROOT PAGE ASSEMBLY

### 5.1 — `page.tsx` Final Structure

**File:** `frontend/src/app/page.tsx`

```tsx
// This is the root landing page for unauthenticated users.
// Authenticated users are redirected to /dashboard by middleware.ts.

import NavBar         from '@/components/landing/NavBar'
import TickerTape     from '@/components/landing/TickerTape'
import HeroSection    from '@/components/landing/HeroSection'
import TrustBar       from '@/components/landing/TrustBar'
import FeatureGrid    from '@/components/landing/FeatureGrid'
import ProtocolSection from '@/components/landing/ProtocolSection'
import LandingFooter  from '@/components/landing/LandingFooter'

export const metadata = {
  title: 'FinSight AI | Sovereign Intelligence for the Lunar Vault',
  description: 'Real-time analytics and portfolio intelligence for the modern Indian investor.',
}

export default function LandingPage() {
  return (
    <>
      {/* Noise texture overlay — fixed, pointer-events-none, z-index 9999 */}
      <div className="noise-overlay" aria-hidden="true" />

      <NavBar />

      <main className="pt-24">
        <TickerTape />
        <HeroSection />
        <TrustBar />
        <FeatureGrid />
        <ProtocolSection />
      </main>

      <LandingFooter />
    </>
  )
}
```

### 5.2 — Noise Overlay CSS

Add the following to `frontend/src/app/globals.css` (append only, do not disturb existing styles):

```css
/* ─── Landing Page: Noise Overlay ─────────────────────────────────────────── */
.noise-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
}

/* ─── Landing Page: Glass Card ─────────────────────────────────────────────── */
.glass-card {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

/* ─── Landing Page: Ticker Animation ──────────────────────────────────────── */
@keyframes ticker-scroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.ticker-animate {
  display: flex;
  white-space: nowrap;
  animation: ticker-scroll 30s linear infinite;
}
.ticker-wrap {
  width: 100%;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(200, 255, 0, 0.1);
}

/* ─── Landing Page: Material Symbols config ───────────────────────────────── */
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
}
```

---

## SECTION 6 — LAYOUT CONFLICT PREVENTION

### 6.1 — Sidebar Suppression on Landing Page

The root `layout.tsx` wraps ALL pages in `<Sidebar>` and `<Providers>`. The landing page must NOT show the app sidebar. This is the most critical integration concern.

**Solution:** Use Next.js route groups to exclude the landing page from the app layout.

**Implementation:**

1. Create a new route group `(app)` for all authenticated pages:
   ```
   frontend/src/app/(app)/dashboard/page.tsx    ← move existing
   frontend/src/app/(app)/portfolio/page.tsx     ← move existing
   frontend/src/app/(app)/ai-research/page.tsx   ← move existing
   frontend/src/app/(app)/stock/[symbol]/page.tsx ← move existing
   frontend/src/app/(app)/watchlist/page.tsx      ← move existing
   frontend/src/app/(app)/news/page.tsx           ← move existing
   frontend/src/app/(app)/alerts/page.tsx         ← move existing
   frontend/src/app/(app)/settings/page.tsx       ← move existing
   ```

2. Create `frontend/src/app/(app)/layout.tsx` — move the Sidebar/Providers wrapper here from root `layout.tsx`.

3. Make the root `layout.tsx` minimal — only global fonts, `<html>`, `<body>`, and `<Providers>` (React Query wrapper).

4. The landing page (`/page.tsx`) and auth pages (`/auth/*/page.tsx`) remain at the root level and get no sidebar.

**⚠️ WARNING — Existing File Move Protocol:**  
Moving pages into the `(app)` group changes their file paths but NOT their URL routes (route groups with parentheses are invisible in the URL). This means `/dashboard` still works at the same URL. However, any imports in these files that use relative paths must be updated to use the `@/` alias (which they already should be, per the existing code).

**Before moving any file, verify with the developer that this route group refactor is approved.** If the developer wants a lower-risk approach, the alternative is described in Section 6.2.

### 6.2 — Alternative: Conditional Sidebar Rendering (Lower Risk)

If moving files into a route group is not approved, use the lower-risk approach of conditionally hiding the sidebar on the landing page:

In `frontend/src/app/layout.tsx`, add path detection:

```tsx
// In the root layout, use usePathname() to detect if we're on the landing page
// and conditionally render the Sidebar
```

This requires making `layout.tsx` a `"use client"` component — which is generally not recommended for root layouts. Use a wrapper component instead:

Create `frontend/src/components/AppShell.tsx`:
```tsx
"use client"
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLandingPage = pathname === '/'
  const isAuthPage = pathname.startsWith('/auth')
  const showSidebar = !isLandingPage && !isAuthPage

  return (
    <div className={showSidebar ? 'flex h-screen' : ''}>
      {showSidebar && <Sidebar />}
      <div className={showSidebar ? 'flex-1 overflow-auto' : 'w-full'}>
        {children}
      </div>
    </div>
  )
}
```

Then update `layout.tsx` to use `<AppShell>` instead of rendering `<Sidebar>` directly. This is the preferred approach if route group refactoring is not approved.

---

## SECTION 7 — MIDDLEWARE UPDATE

**File:** `frontend/src/middleware.ts`

Review the existing middleware to ensure it handles the landing page correctly:

Current behaviour (inferred): Middleware likely redirects all unauthenticated users to `/auth/login`.

**Required new behaviour:**
- `/` (landing page) → **always accessible**, no auth required
- `/auth/login` and `/auth/signup` → accessible without auth (they already are)
- `/dashboard`, `/portfolio`, `/ai-research`, etc. → require auth (redirect to `/auth/login` if not authenticated)
- If authenticated user visits `/` → redirect to `/dashboard`

**Middleware update (append the landing page to the public routes allowlist):**

```typescript
// In the matcher or publicRoutes array, ensure '/' is listed as public:
const publicRoutes = ['/', '/auth/login', '/auth/signup']

// Logic:
// 1. If route is public → allow through
// 2. If route is protected AND user is authenticated → allow through
// 3. If route is protected AND user is not authenticated → redirect to /auth/login
// 4. If route is '/' AND user IS authenticated → redirect to /dashboard
```

---

## SECTION 8 — STITCH ASSET INTEGRATION

### 8.1 — Image Assets

Pull the following image assets from Stitch project `5562709792059955014` and save to `frontend/public/landing/`:

| Asset Name | Used In | Expected Dimensions |
|---|---|---|
| `dashboard-preview.jpg` or `.webp` | Hero section — main dashboard mock | 1280×720 (16:9) |
| `portfolio-abstract.jpg` or `.webp` | Portfolio feature card background | 400×300 |

If Stitch does not have these images, fall back to the image URLs in the HTML reference (they are hosted on Google's AIDA public CDN). In production, self-host all images in `/public/landing/` for performance and reliability.

### 8.2 — Image Optimisation

Use Next.js `<Image>` for all images to get automatic WebP conversion and responsive sizing:

```tsx
import Image from 'next/image'

// Hero preview image
<div className="relative w-full aspect-video">
  <Image
    src="/landing/dashboard-preview.jpg"
    alt="FinSight AI financial dashboard"
    fill
    priority          // above-the-fold image — preload
    className="object-cover ..."
  />
</div>

// Portfolio card background
<Image
  src="/landing/portfolio-abstract.jpg"
  alt=""
  width={400}
  height={300}
  className="absolute bottom-0 right-0 ..."
/>
```

### 8.3 — Stitch Component Overrides

After pulling the Stitch project spec, check for any component-level overrides that differ from the HTML reference. Common overrides that Stitch projects specify:

- Button corner radius (Stitch may specify a different border-radius for the CTA)
- Specific shadow values for the hero card glow
- Exact opacity values for the glass card
- Animation duration/easing for the ticker tape

Apply any Stitch overrides on top of the HTML reference spec. **Stitch is the source of truth** for final visual details.

---

## SECTION 9 — TYPOGRAPHY IMPLEMENTATION

All typography in the landing page uses two font families:

### Primary: Inter
Already loaded in the Next.js project via `next/font/google`. Used for:
- All headings (`<h1>`, `<h2>`, `<h3>`, `<h4>`)
- Body copy (`<p>`)
- Nav links and buttons

Weights used: 400 (regular), 700 (bold), 800 (extrabold)

### Monospace: JetBrains Mono
New addition — must be added to the font loading in `layout.tsx`. Used for:
- Ticker tape stock symbols and prices
- Feature card metric labels
- Terminal readout lines
- Trust bar statistics
- Footer navigation

In Tailwind JSX, apply the mono font using: `font-['JetBrains_Mono']`  
Or define a utility class in `globals.css`: `.font-mono-brand { font-family: 'JetBrains Mono', monospace; }`

### Material Symbols
Icon font loaded via Google Fonts CDN link in `<head>`. Applied using:
```html
<span class="material-symbols-outlined">query_stats</span>
```
Icon names used: `query_stats`, `smart_toy`, `analytics`, `architecture`, `tune`

---

## SECTION 10 — ANIMATION SPECIFICATIONS

### 10.1 — Ticker Tape

- **Type:** CSS infinite scroll
- **Duration:** 30 seconds per full loop
- **Easing:** `linear` (consistent speed, no acceleration)
- **Implementation:** Duplicate the item list inside the ticker div to create a seamless loop (the animation shifts by exactly 50% since the list is duplicated once)

### 10.2 — CTA Button Hover Glow

- **Selector:** Primary CTA button (lime green)
- **Effect:** `box-shadow: 0 0 30px rgba(200, 255, 0, 0.4)` on hover
- **Transition:** `transition-all` with default 150ms duration

### 10.3 — Hero Image Glow

- **Effect:** The `absolute -inset-1` div behind the dashboard preview has `blur-2xl` and changes `opacity-20 → opacity-30` on `group-hover`
- **Transition:** `transition duration-1000` (1 full second — slow, dramatic)

### 10.4 — Dashboard Image Blend

- **Default:** `mix-blend-luminosity` (desaturated, dark feel)
- **On hover:** `mix-blend-normal` (full colour revealed)
- **Transition:** `transition-all duration-700` (0.7 seconds)

### 10.5 — Protocol Step Circles

- **Effect:** Each icon circle scales up on step hover
- **Transform:** `group-hover:scale-110`
- **Transition:** `transition-transform`

### 10.6 — System Status Pulse

- **Component:** Footer — live status dot
- **Effect:** `animate-ping` on outer span (Tailwind built-in) — creates a pulsing ring effect
- No custom CSS needed; Tailwind's `animate-ping` handles this

---

## SECTION 11 — MOBILE RESPONSIVENESS

The landing page must be fully responsive. Key breakpoints:

| Breakpoint | Changes |
|---|---|
| `< md` (< 768px) | Nav links hidden, only show logo + CTA button |
| `< md` | Hero headline shrinks from `text-8xl` to `text-6xl` |
| `< md` | Trust bar stacks vertically (`grid-cols-1`) |
| `< md` | Feature bento grid stacks vertically (`grid-cols-1`) |
| `< md` | Protocol steps stack vertically, connecting line hidden |
| `< md` | Footer grid stacks to `grid-cols-1` |
| `< md` | Footer bottom bar stacks vertically |

---

## SECTION 12 — ACCESSIBILITY CHECKLIST

Before marking the task complete, verify:

- [ ] All `<img>` elements have descriptive `alt` text (or `alt=""` if purely decorative)
- [ ] The noise overlay has `aria-hidden="true"`
- [ ] All `<Link>` elements have visible text (no icon-only links without aria labels)
- [ ] Colour contrast: white text on `#0e0e13` background meets WCAG AA (it does — contrast ratio > 4.5:1)
- [ ] The ticker tape should have `aria-hidden="true"` or a `role="marquee"` with `aria-label` for screen readers
- [ ] The `<header>` landmark is properly labelled
- [ ] CTA buttons have clear action text ("Login", "Sign In" — these are already clear)

---

## SECTION 13 — FINAL FILE DELIVERABLE CHECKLIST

When Anti-Gravity completes the implementation, the following files must exist:

### New Files Created
- [ ] `frontend/src/app/page.tsx` (replaced)
- [ ] `frontend/src/components/landing/NavBar.tsx`
- [ ] `frontend/src/components/landing/TickerTape.tsx`
- [ ] `frontend/src/components/landing/HeroSection.tsx`
- [ ] `frontend/src/components/landing/TrustBar.tsx`
- [ ] `frontend/src/components/landing/FeatureGrid.tsx`
- [ ] `frontend/src/components/landing/ProtocolSection.tsx`
- [ ] `frontend/src/components/landing/LandingFooter.tsx`
- [ ] `frontend/public/landing/dashboard-preview.jpg` (or `.webp`, from Stitch)
- [ ] `frontend/public/landing/portfolio-abstract.jpg` (or `.webp`, from Stitch)

### Existing Files Modified (Append/Patch Only)
- [ ] `frontend/src/app/globals.css` — noise overlay, glass card, ticker animation CSS appended
- [ ] `frontend/src/app/layout.tsx` — JetBrains Mono font added, Material Symbols CDN link added, AppShell wrapper added
- [ ] `frontend/src/middleware.ts` — landing page `/` added to public routes
- [ ] `frontend/src/components/AppShell.tsx` — created (new component, replaces direct Sidebar usage in layout)

### Existing Files NOT Touched (Protected)
- `frontend/src/app/auth/login/page.tsx`
- `frontend/src/app/auth/signup/page.tsx`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/portfolio/page.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/lib/api-client.ts`
- `frontend/tailwind.config.ts`
- All backend files

---

## SECTION 14 — SMOKE TEST PROCEDURE

After implementation, run through this manually:

1. **Start backend:** `uvicorn app.main:app --reload` (from `/backend`)
2. **Start frontend:** `npm run dev` (from `/frontend`)
3. **Open:** `http://localhost:3000`

**Expected:** Landing page renders, NOT the dashboard redirect.

**Test checklist:**
- [ ] Navbar is visible and fixed at top with glass pill shape
- [ ] Ticker tape scrolls continuously from right to left
- [ ] Hero headline reads "Intelligence behind every rupee."
- [ ] Hero "Login" button → navigates to `http://localhost:3000/auth/login` ✓
- [ ] Hero "Sign In" button → navigates to `http://localhost:3000/auth/signup` ✓
- [ ] Navbar "Login" → `/auth/login` ✓
- [ ] Navbar "Sign In" → `/auth/signup` ✓
- [ ] Navbar "Institutional Access" → `/auth/signup` ✓
- [ ] Trust bar shows 3 stats in a row (desktop) / stacked (mobile)
- [ ] All 3 feature cards render correctly
- [ ] Protocol section shows 3 steps with connecting line visible on desktop
- [ ] Footer renders with pulse animation on status dot
- [ ] Footer "Market Overview" → `/dashboard`
- [ ] Logging in via `/auth/login` → successfully redirects to `/dashboard` (existing auth flow unchanged)
- [ ] Authenticated user visiting `localhost:3000/` → redirects to `/dashboard` (not stuck on landing page)
- [ ] No TypeScript errors in console
- [ ] No 404 errors for images or fonts

---

*Execution plan complete. Anti-Gravity Cloud Agent should execute Sections 1 through 14 in order, beginning with the Stitch MCP connection in Section 1.*
