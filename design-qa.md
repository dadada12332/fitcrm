# Design QA — aligned profile grid

- Source visual:
  `/var/folders/lb/xkrtj8910d98wdwc_pflc1s80000gn/T/TemporaryItems/NSIRD_screencaptureui_8jemcw/Снимок экрана 2026-07-27 в 10.15.38.png`
- Implementation screenshots:
  - `/Users/amiran/fitcrm/artifacts/profile-equal-grid-local.jpg`
  - `/Users/amiran/fitcrm/artifacts/profile-equal-grid-bottom-local.jpg`
- Combined comparison:
  `/Users/amiran/fitcrm/artifacts/profile-equal-grid-comparison-final.png`
- Browser viewport: 1681 × 1420 CSS pixels, device scale 1
- State: authenticated owner, light theme, profile route

## Full-view comparison evidence

The source used two independent vertical columns. As a result, the shorter Telegram card
ended well above the email card and the sessions card appeared stranded at the bottom-right.
The implementation uses one shared two-column grid, so cards participate in real horizontal
rows instead of two unrelated stacks.

The content order is now:

1. Identity summary across the full width.
2. Personal data and Telegram access.
3. Password and login email.
4. Active sessions across the full width.

## Measured layout evidence

- Personal data: 307 px.
- Telegram Mini App: 307 px.
- Password: 307 px.
- Login email: 307 px.
- Row 1 cards share the same top coordinate.
- Row 2 cards share the same top coordinate.
- The sessions card spans the complete content width.
- Document `scrollWidth` equals the 1681 px viewport width; the main container has no
  horizontal overflow.

## Required fidelity surfaces

- Existing Card, Button, Badge and Input primitives are unchanged.
- Existing semantic color tokens, typography and 16 px grid gap are preserved.
- All profile actions and form states remain functional.
- On widths below `xl`, the grid naturally collapses into one ordered column.

## Comparison history

1. P1 — independent columns produced unrelated vertical rhythms and visibly different card
   endings.
2. Fix — flattened both columns into one `xl:grid-cols-2` grid with stretched card items.
3. P2 — sessions belonged to neither column and made the right side look heavier.
4. Fix — sessions moved below the grid as one full-width account-level action.
5. Post-fix measurement — all four primary cards render at exactly 307 px in the verified
   desktop state.

## Remaining findings

No actionable P0/P1/P2 findings remain in the requested profile-layout scope.

## Final result

passed
