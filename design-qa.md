# Mobile TopBar actions — Design QA

## Target

- Reference: `Снимок экрана 2026-07-27 в 18.17.04.png`.
- Keep the sidebar toggle isolated on the left.
- Align search, language, theme and notifications to the right edge on mobile.

## Verified surfaces

- Authenticated CRM dashboard.
- Mobile viewport: `390 × 844`.
- TopBar layout and document horizontal overflow.

## Comparison

- Before: the hidden mobile breadcrumb did not reserve flex space, so the action group followed
  the sidebar toggle immediately.
- After: the action group uses `margin-left: auto`; its measured bounds are `x=214…374` inside a
  `390 px` header with `16 px` side padding.
- The sidebar toggle remains at `x=16…57`, preserving the intended split alignment.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none.
- Horizontal overflow: none (`scrollWidth = innerWidth = 390`).

## Evidence

- `artifacts/mobile-topbar-actions-right.png`
- `artifacts/mobile-topbar-reference-vs-result.png`

## Final result

Passed.
