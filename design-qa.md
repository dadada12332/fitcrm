# Retention queue divider — Design QA

## Target

- Reference: `Снимок экрана 2026-07-27 в 18.36.41.png`.
- Replace the visually black divider below the retention queue header with the standard CRM
  border token.

## Verified surfaces

- Authenticated `/retention` screen at `1280 px`.
- Queue header, surrounding card border and content transition.
- Document horizontal overflow.

## Comparison

- Before: `border-b` inherited a dark default border color and read as a black rule.
- After: `border-border` resolves to `rgb(228, 228, 231)` in the current light theme.
- Divider remains `1 px` and aligns with the card's neutral outline.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none.
- Horizontal overflow: none (`scrollWidth = innerWidth = 1280`).

## Evidence

- `artifacts/retention-divider-light.png`
- `artifacts/retention-divider-comparison.png`

## Final result

Passed.
