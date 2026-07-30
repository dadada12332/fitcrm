# Language switcher border removal — Design QA

## Target

- Source visual truth: `/var/folders/lb/xkrtj8910d98wdwc_pflc1s80000gn/T/TemporaryItems/NSIRD_screencaptureui_tTQNph/Снимок экрана 2026-07-30 в 11.37.15.png`.
- Implementation: authenticated local `/dashboard`.
- Goal: remove the capsule border, card background and shadow from the `RU` language trigger
  without changing its position, label or dropdown behavior.

## Viewport and evidence

- Source pixels: `112 × 61`.
- Implementation screenshot: `artifacts/language-switcher-borderless-dashboard-local.png`.
- Implementation viewport: `1280 × 720` CSS px at density `1`.
- Focused comparison: `artifacts/language-switcher-reference-vs-borderless.png`.
- State: light theme, Russian locale, language menu closed.
- A focused comparison is required because the requested change affects a 40 × 32 px control.

## Required fidelity surfaces

- Typography: existing 12 px semibold locale label is preserved.
- Spacing and layout: the trigger remains 40 × 32 px in the existing top-bar action group.
- Colors and tokens: the resting state is transparent; the existing token-based muted hover
  state remains.
- Image quality and assets: no assets changed; existing icons remain sharp and untouched.
- Copy and content: the `RU` label and all three language options are unchanged.

## Interaction verification

- Computed border width: `0px`.
- Computed box shadow: `none`.
- Computed background: transparent.
- The dropdown still opens and shows Russian, Uzbek and English.
- Browser console errors: none.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none.

## Comparison history

- Initial source finding: the outlined capsule made the locale control visually heavier than the
  adjacent icon-only actions.
- Fix: removed `border`, `bg-card`, `shadow-xs` and the pill radius from the trigger.
- Post-fix evidence: the focused comparison shows a plain `RU` label aligned with the theme and
  notification actions, while preserving the same hit area.

## Final result

passed
