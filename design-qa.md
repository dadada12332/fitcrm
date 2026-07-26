# Design QA — compact subscription screen

## Evidence

- Source visual truth:
  `/var/folders/lb/xkrtj8910d98wdwc_pflc1s80000gn/T/TemporaryItems/NSIRD_screencaptureui_JcNBLs/Снимок экрана 2026-07-27 в 04.30.15.png`
- Browser-rendered desktop:
  `/Users/amiran/fitcrm/artifacts/subscription-compact-desktop.png`
- Browser-rendered mobile:
  `/Users/amiran/fitcrm/artifacts/subscription-compact-mobile.png`
- Combined full-view comparison:
  `/Users/amiran/fitcrm/artifacts/subscription-compact-comparison.png`
- Route/state: authenticated synthetic club owner at `/settings/subscription`, light theme.
- Source pixels: `3840 × 2216`.
- Desktop implementation pixels: `1681 × 1420`; CSS viewport `1681 × 1420`, DPR `1`.
- Mobile implementation pixels: `609 × 1319`; responsive capability requested at
  `390 × 844`, browser reported CSS viewport `487px` at DPR `0.8`.
- Source was proportionally normalized to `1681px` width for the side-by-side comparison.
  Business-vs-Trial content differs because the source and QA tenant have different current plans;
  hierarchy and density were compared, not literal values.

## Full-view comparison

The source places ten large usage cards before plan selection, pushing the purchase decision below
the fold. The implementation keeps the same subscription hierarchy and shared FitCRM surfaces, but
compresses the current plan into a header plus five small cells, promotes the three plans directly
below it, and moves six secondary limits into a collapsed disclosure. The complete decision area now
fits in one desktop viewport without removing entitlement data.

## Focused checks

- Typography: existing CRM font stack and heading/body weights are preserved; prices, plan names and
  current status remain visually dominant without oversized KPI numerals.
- Spacing/layout: plan cards share equal height; the current-plan grid aligns on desktop and becomes
  one date row plus a `2 × 2` capacity grid on mobile.
- Colors/tokens: only `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`,
  `border-border` and brand semantic utilities are used.
- Images/assets: no raster or custom decorative assets are required; existing Lucide icons remain.
- Copy/content: all ten limits, billing period controls, plan benefits and request actions remain
  available. Secondary limits are discoverable under “Все лимиты тарифа”.
- A separate focused crop was not needed: the high-resolution combined view keeps labels, values,
  progress bars and buttons readable.

## Comparison history

1. Initial responsive pass found a P2 mobile overflow: the current price retained the desktop card
   action column, and the five summary cells created an empty final grid cell.
2. Fixed the header with explicit mobile row/column placement, made the expiry cell span both mobile
   columns, and placed four primary limits in a balanced `2 × 2` grid.
3. Post-fix mobile evidence shows no horizontal document overflow; desktop reports
   `scrollWidth === innerWidth` (`1681px`).

## Findings

- No actionable P0/P1/P2 visual mismatch remains.
- P3: a dedicated narrow-phone shell audit could further tune the global settings tab bar, which is
  outside this subscription component and intentionally remains horizontally scrollable.

## Interactions and runtime

- Opened and closed “Все лимиты тарифа”; all six secondary limits rendered.
- Switched billing period between `1 мес` and `3 мес`.
- No Next.js error overlay appeared and the tested interactions completed without browser-tool
  exceptions from the application.

## Implementation checklist

- [x] Put available plans above secondary usage details.
- [x] Keep primary capacity and expiry visible at a glance.
- [x] Preserve access to every existing limit.
- [x] Verify desktop and responsive layouts in the authenticated app.
- [x] Verify disclosure and billing-period interactions.

final result: passed
