# Design QA — subscription borders and locale control

- Source visual truth: `/var/folders/lb/xkrtj8910d98wdwc_pflc1s80000gn/T/TemporaryItems/NSIRD_screencaptureui_HqyvB9/Снимок экрана 2026-07-27 в 04.49.14.png`
- Implementation screenshot: `/Users/amiran/fitcrm/artifacts/subscription-role-lang-desktop-final.png`
- Responsive screenshot: `/Users/amiran/fitcrm/artifacts/subscription-role-lang-mobile-final.png`
- Combined comparison: `/Users/amiran/fitcrm/artifacts/subscription-border-design-qa-comparison-final.png`
- Source pixels: 3840 × 2216; normalized to 1680 px width for comparison
- Implementation pixels / CSS viewport: 1680 × 1050 at device scale 1
- Mobile pixels / CSS viewport: 390 × 844 at device scale 1
- State: authenticated owner, light theme, subscription tab, Russian locale

## Full-view comparison evidence

The source showed near-black `currentColor` borders around the current plan, plan grid,
benefit separators, and section dividers. The implementation uses the FitCRM semantic
`border-border` token throughout. The resulting hierarchy now matches neighboring CRM
screens: subtle Zinc boundaries, blue only for brand/selected states, and no heavy black
boxes. Density, card geometry, typography, and content order are preserved.

The mobile capture has no horizontal page overflow (`scrollWidth` equals `innerWidth` at
390 px). The settings navigation remains horizontally scrollable by design.

## Focused comparison evidence

A separate crop was not required: the affected borders occupy the full width of the
current-plan and pricing regions and are clearly readable in the normalized combined
comparison. The locale control was interaction-tested instead: the compact RU/UZ/EN pill
opens a grouped menu and all three options switch the CRM shell without a framework error.

## Required fidelity surfaces

- Fonts and typography: unchanged from the product's existing Geist/CRM hierarchy; no
  new type scale or weight introduced.
- Spacing and layout rhythm: existing compact subscription layout preserved; mobile cards
  stack without viewport overflow.
- Colors and visual tokens: all affected borders and dividers use semantic design-system
  tokens; the active plan uses a restrained brand border/ring.
- Image quality and assets: no raster assets are used on this screen; existing Lucide icons
  remain sharp and consistent.
- Copy and content: subscription copy is unchanged; locale labels are Russian, O‘zbekcha,
  and English.

## Comparison history

1. P1 — borders were near-black because bare `border`, `border-b`, and `border-t` used
   `currentColor`.
2. Fix — replaced them with `border-border`; selected plan uses
   `border-brand/40 ring-brand/10`.
3. Post-fix evidence — the desktop and mobile implementation captures show subtle borders,
   correct selected-state emphasis, and no hidden controls or overflow.

## Findings

No actionable P0/P1/P2 visual findings remain for the requested subscription-border and
language-control scope.

## Primary interactions tested

- Open locale menu.
- Switch Russian → English → O‘zbekcha → Russian.
- Verify navigation and settings labels update.
- Verify the route remains interactive and no framework error screen appears.
- Verify desktop and mobile subscription layouts.

## Final result

passed
