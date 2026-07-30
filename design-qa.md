# Dashboard visit chart border — Design QA

## Target

- Source visual truth: `/var/folders/lb/xkrtj8910d98wdwc_pflc1s80000gn/T/TemporaryItems/NSIRD_screencaptureui_SZnTYH/Снимок экрана 2026-07-30 в 12.14.43.png`.
- Implementation: authenticated production `/dashboard`.
- Goal: remove the doubled side and bottom borders from the visit chart while preserving the
  existing card composition.

## Viewport and evidence

- Source pixels: `472 × 498`.
- Implementation screenshot: `artifacts/dashboard-chart-border-fixed-production.png`.
- Implementation viewport: `1280 × 720` CSS px at density `1`.
- Focused comparison: `artifacts/dashboard-chart-border-comparison.png`.
- Normalization: both focused card regions were cropped to `395 × 451` px.
- State: light theme, Russian locale, empty visit chart.

## Required fidelity surfaces

- Typography: headings, labels and numeric values are unchanged.
- Spacing and layout: the card remains `395px` wide and keeps the original section heights.
- Colors and tokens: the remaining outline uses the design-system `border-border` token.
- Image quality and assets: the Recharts radial remains sharp and unchanged.
- Copy and content: all dashboard copy and values are preserved.

## Interaction and browser verification

- `/dashboard` loaded successfully with an authenticated owner test account.
- Computed inner borders: left `0px`, right `0px`, bottom `0px`.
- Computed outer borders: left `1px`, right `1px`, bottom `1px`.
- Computed outer border color: `rgb(228, 228, 231)` (`border-border`).
- Browser console errors: none.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none.

## Comparison history

- Initial finding: the body rendered its own left, right and bottom border inside an already
  bordered card, making the sides and lower edge appear thicker.
- Fix: removed the inner body border and shadow, leaving one token-based outline on the outer card.
- Post-fix evidence: the focused comparison shows a uniform one-pixel perimeter with no doubled
  side or bottom edges.

## Final result

passed
