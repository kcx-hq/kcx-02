# KCX Frontend Design System / Client Portal UI Guide

Last updated: March 26, 2026  
Based on current implementation state in `frontend/src` (new repo; final active theme reference).

## 1. Purpose
- This document is the single source of truth for **current KCX client-facing UI direction** in the new frontend.
- It aligns future client portal pages (starting with post-login homepage) to the **finalized visual language already implemented**.
- It is implementation-first: use this before building any new page/section/component.

## 2. Final Design Source of Truth
- The **current new frontend codebase** is the final visual reference.
- Old client portal screenshots and old landing-page variants are history/reference only.
- Do not reintroduce styling from old variants. Build from:
  - `src/styles/globals.css`
  - `tailwind.config.js`
  - `src/features/landing/**`
  - shared layout/ui primitives in `src/components/**`

## 3. Brand / Visual Direction
- Overall feel: modern, enterprise, premium, cloud-finops product.
- Tone: calm, trustworthy, technically credible, low-noise.
- UX direction: structured and guided (CloudZero-like clarity), but rendered in KCX's own dark-aurora + soft-light surface system.
- Interaction style: motion-enhanced but controlled, with reduced-motion support.

## 4. Actual Theme Tokens Found in Code

### Core brand and semantic colors
- Primary:
  - `--brand-primary: #3e8a76`
  - `--brand-primary-hover: #23a282` (buttons often also use `#357563` for hover on solid CTAs)
  - `--brand-primary-soft: #e2f3ee`
- Secondary:
  - `--brand-secondary: #192630`
- Main surfaces:
  - `--bg-main: #f2f3f2`
  - `--bg-surface: #f7f8f7`
  - `--bg-soft: #ecefed`
  - `--bg-soft-2: #e4e8e6`
  - `--bg-dark: #192630`
- Text hierarchy:
  - `--text-primary: #1c2321`
  - `--text-secondary: #4b5a55`
  - `--text-muted: #8a9a94`
  - `--text-disabled: #c7cfcb`
  - `--text-on-dark: #ffffff`
  - `--text-on-dark-muted: #9ca3af`
- Borders:
  - `--border-light: #dde3e0`
  - `--border-muted: #eef1ef`
  - `--border-dark: rgba(255,255,255,0.12)`
  - `--kcx-border-soft: rgba(118,177,157,0.28)`
  - `--kcx-border-strong: rgba(83,147,127,0.44)`
- Highlight palettes:
  - `--highlight-green: #e2f3ee`
  - `--highlight-blue: #e9f1fb`
  - `--highlight-yellow: #fbf6e8`

### State colors (inferred from implementation)
- Success/positive: green family (`#3e8a76`, `#2f7f68`, `#10b981` accents).
- Warning: yellow surfaces exist (`--highlight-yellow`) but warning-specific component language is not standardized yet.
- Error: form error states use red (`border-red-500`, `text-red-600`).

### Dark/light section palette
- Dark surface scale:
  - `--kcx-surface-dark-1: #050b11`
  - `--kcx-surface-dark-2: #081620`
  - `--kcx-surface-dark-3: #0d1a24`
- Light surface scale:
  - `--kcx-surface-light-1: #f6faf8`
  - `--kcx-surface-light-2: #eef4f1`
  - `--kcx-surface-light-3: #e8f0ed`
- Card surfaces:
  - `--kcx-card-light: rgba(252,255,253,0.84)`
  - `--kcx-card-dark: rgba(8,20,30,0.82)`

### Gradients, glow, shadows
- Global body background uses layered radial + vertical gradient from deep navy to mist light.
- Aurora/glow language is core (hero and dark sections), built from multi-layer radial/linear gradients.
- Shadows:
  - `--shadow-sm`, `--shadow-md`, `--shadow-lg`
  - `--kcx-shadow-soft`, `--kcx-shadow-deep`

### Radius system
- `--radius-sm: 8px`
- `--radius-md: 12px`
- `--radius-lg: 16px`
- `--radius-xl: 20px`
- `--radius-2xl: 24px`
- Common component radii: `rounded-xl`, `rounded-2xl`, occasional `rounded-[24px]+` for premium cards.

### Spacing rhythm
- Token scale:
  - `--space-xs: 4px`, `--space-sm: 8px`, `--space-md: 16px`, `--space-lg: 24px`, `--space-xl: 32px`, `--space-2xl: 48px`, `--space-3xl: 64px`, `--space-4xl: 96px`
- Section rhythm: typically `clamp(4rem, 9vw, 7.5rem)` vertical.
- Container padding: `clamp(1rem, 3vw, 3rem)`.

### Typography
- Base font: Inter (`@fontsource/inter`).
- `--kcx-font-heading`: Inter + fallbacks.
- `--kcx-font-body`: Inter + system fallbacks.
- Recurring sizes:
  - Eyebrow labels: ~`11px`, uppercase, high letter spacing (`0.14em-0.22em`).
  - Section titles: roughly `1.65rem` to `3rem+`, semibold, tight tracking.
  - Body copy: `14px-16px`, generous line-height (`1.6-1.75`).

### Button styles
- Shared primitive in `components/ui/button.tsx` (`default`, `secondary`, `outline`, `ghost`, `link`).
- Product CTAs commonly override to KCX green solid with white text.
- CTA shape trend: `rounded-xl`, medium weight, clear hover state, visible focus ring.

### Card styles
- High use of layered cards:
  - Light cards: subtle borders, soft shadows, slight gradients.
  - Dark cards: translucent dark glass, bright borders, glow overlays.
- Premium cards often include decorative pseudo-element glow (`kcx-premium-card*`).

### Input styles
- Standard form controls:
  - Height ~`44px` (`h-11`), `rounded-xl`/`rounded-2xl`
  - Soft border, white/light background on light forms
  - Strong focus ring in green family
  - Red error border/text for invalid states

### Badge / pill styles
- Recurring pattern: `rounded-full`, subtle border, soft tint/gradient background, small uppercase or compact label text.
- Used for section labels, tags, status chips, and category chips.

## 5. Layout Rules
- **Container**: use `kcx-container` (`max width: var(--kcx-content-max) = 1280px`), with responsive inline padding.
- **Section shell**: default to `kcx-section`; alternate with `kcx-section-light` and `kcx-section-dark`.
- **Grids**: responsive 1-col mobile to 2/3-col desktop; maintain spacious vertical rhythm.
- **Card spacing**: usually `gap-4` to `gap-8`; preserve visual breathing room over dense packing.
- **Responsiveness**:
  - Mobile-first Tailwind classes.
  - Multiple breakpoints used for motion reduction and hero complexity downshift.
- **Hero pattern**:
  - Dark aurora surface, strong headline, concise support copy, clear CTA.
  - Decorative atmosphere is layered behind content and never blocks readability.
- **Dashboard/product section pattern**:
  - Story-first: intro copy -> structured cards/flow -> actionable CTA.
- **CTA placement**:
  - End of major narrative sections.
  - Keep primary + secondary actions grouped and visually prioritized.
- **Empty states**:
  - No fully standardized component yet; direction inferred as intentional cards with explanatory copy + next action.

## 6. Component Language
- Section headers:
  - Eyebrow label, then high-emphasis heading, then concise contextual paragraph.
- Eyebrow labels:
  - Uppercase, tight size, increased tracking, green/mint tinted.
- Hero blocks:
  - Aurora background, dark gradient, premium layered atmosphere, centered/left narrative block.
- Action cards / feature cards / bento-like cards:
  - Rounded, bordered, soft shadow, icon + title + concise body.
- Status indicators:
  - Dot + tint chip patterns; green for positive/active.
  - `role="status"` used for form submit feedback.
- Tables/lists:
  - No production data table system currently implemented.
  - Lists are card rows, accordions, and step flows.
- Pills/tags/badges:
  - Rounded-full micro-surfaces for taxonomy/state labels.
- Sidebar/nav:
  - Header with mega menu on desktop.
  - Slide-in right drawer for mobile nav.
- Modal/drawer:
  - Drawer pattern exists (mobile nav).
  - No shared modal/dialog system in active use for client workflows yet.

## 7. UX Principles for Client Portal Pages
- First screen must orient the user quickly: what this page is, what state they are in, what to do next.
- Pages should drive action, not only present information.
- Empty states should be deliberate and helpful (context + CTA).
- Client homepage should expose multiple meaningful next paths.
- AWS setup and CSV/manual billing upload must both be easy to find.
- AWS connection should be encouraged but not hard-gated.
- Avoid clutter, weak hierarchy, and "generic admin template" aesthetics.
- Use enterprise SaaS information hierarchy: clear sectioning, intentional copy length, visual priority.

## 8. Current Product Constraints
- Rebuild context: new platform implementation in `kcx-02`.
- Current stage: UI/UX-first.
- Backend/data wiring is not required yet for most new pages.
- Dummy/static states are allowed and expected where needed.
- First priority: post-login client homepage.
- AWS/cloud client flows are a major upcoming area.
- Current primary operational flow: CSV/manual billing upload.
- AWS automated setup is future scope.
- AWS connection is optional after login (not a blocking first step).

## 9. Homepage Design Intent
- The client homepage (first page after login) should:
  - orient the user immediately,
  - show system readiness/state,
  - present clear entry points to key actions,
  - stay visually aligned with the finalized KCX theme,
  - leave room for near-term modules (AWS connect, CSV upload, support/tickets, announcements).
- Tone target: product-grade and enterprise-ready, clearly above old portal UX quality.

## 10. Do / Don't

### Do
- Reuse existing KCX tokens/components/layout patterns faithfully.
- Keep hierarchy clean and intentional.
- Use whitespace as a structural tool.
- Make each card/section purpose-driven.
- Preserve premium enterprise polish.

### Don't
- Copy old client portal UI patterns.
- Reintroduce old variant-based landing styles.
- Add arbitrary colors outside current token direction.
- Block UI progress on backend dependencies at this stage.
- Let pages drift into generic admin-template look and density.

## 11. Suggested Next Pages
- Client Homepage
- AWS Connection Entry
- AWS Manual Setup Guide
- Billing Uploads (CSV/manual first)
- Connection status + empty-state pages
- Support / Tickets
- Announcements

## Implementation Notes
- If unclear, prefer the current implementation over assumptions.
- For missing standards, mark as inferred and keep consistent with existing primitives.
- Treat this document as the baseline contract for new client-side page work.
