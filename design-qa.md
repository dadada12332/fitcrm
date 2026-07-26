# Design QA — subscription workspace redesign

- Source visual truth:
  `/var/folders/lb/xkrtj8910d98wdwc_pflc1s80000gn/T/TemporaryItems/NSIRD_screencaptureui_seqlvX/Снимок экрана 2026-07-27 в 02.34.48.png`
- Route/state: `/settings/subscription`, authenticated club owner.
- Source pixels: `2048 × 1054`; used as the current-state reference for hierarchy, density and content.

## Implemented direction

- The current subscription is promoted to a compact summary with plan, expiry, monthly price,
  days remaining and the two primary capacity metrics.
- A dedicated usage section shows all ten working entitlement limits. Persistent club capacity and
  calendar-month consumption are labelled separately.
- Available plans use the shared Card, Badge, Button and Tabs primitives. The former full-blue plan
  card is replaced with a neutral two-tone hierarchy; brand blue only marks the selected/current
  state and primary action.
- Existing request, cancellation and duration-selection behaviour is preserved.

## Verification

- Supabase read contracts for every displayed usage source were exercised with tenant-scoped,
  read-only queries.
- `npx tsc --noEmit` — passed.
- Focused ESLint for both edited files — passed.
- `npm run build` — passed; all 62 routes generated.
- `npm test` — 151 passed, 1 skipped, 2 unrelated existing security-suite failures.

## Visual gate

Chrome has an authenticated production FitCRM tab, but there is no authenticated localhost tab.
The redesigned protected route therefore could not be captured from the current local source
without copying credentials or bypassing authentication. No mock screenshot or old production
screen was substituted for the real implementation.

final result: blocked — authenticated localhost session is unavailable for the required desktop and mobile screenshots
