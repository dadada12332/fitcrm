# Membership duration chevron — Design QA

## Target

- Source visual truth: `/var/folders/lb/xkrtj8910d98wdwc_pflc1s80000gn/T/TemporaryItems/NSIRD_screencaptureui_x2ER5a/Снимок экрана 2026-07-30 в 12.35.15.png`.
- Implementation: authenticated production `/memberships`, “Добавление абонемента” drawer.
- Goal: move the duration-select chevron away from the right edge and preserve comfortable text spacing.

## Viewport and evidence

- Source pixels: `239 × 104`.
- Implementation screenshot: `artifacts/membership-duration-chevron-fixed-production.png`.
- Implementation viewport: `1280 × 720` CSS px at density `1`.
- Focused comparison: `artifacts/membership-duration-chevron-comparison.png`.
- State: light theme, Russian locale, add-membership drawer open.

## Required fidelity surfaces

- Typography: the existing input text and label styles are unchanged.
- Spacing and layout: custom chevron is inset `12px` from the select’s right edge.
- Colors and tokens: icon uses `text-muted-foreground`; field uses the existing input tokens.
- Icon fidelity: Lucide `ChevronDown` replaces the inconsistent browser-native arrow.
- Copy and content: duration options and labels are unchanged.

## Interaction and browser verification

- `/memberships` loaded successfully with an authenticated owner test account.
- “Добавить абонемент” opens the drawer and the duration control remains a native accessible select.
- Computed select appearance: `none`.
- Computed select right padding: `40px`.
- Computed chevron right inset: `12px`.
- Browser console errors: none observed during the flow.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none.

## Comparison history

- Initial finding: the browser-native select arrow sat almost flush with the right edge.
- Fix: hid the native arrow, reserved `40px` for the control affordance, and positioned a
  design-system chevron with a stable `12px` right inset.
- Post-fix evidence: the arrow has balanced breathing room and the selected value cannot overlap it.

## Final result

passed
