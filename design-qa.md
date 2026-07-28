# Retention expiring drawer — Design QA

## Target

- Reference: `/var/folders/lb/xkrtj8910d98wdwc_pflc1s80000gn/T/TemporaryItems/NSIRD_screencaptureui_H4OmLF/Снимок экрана 2026-07-28 в 12.37.52.png`.
- Route: authenticated `/retention`.
- Goal: replace the navigation from `Истекающие` with an in-context right drawer where the
  operator can find a client, call or copy the phone, run AI analysis and renew a membership.

## Viewports and state

- Reference: `3840 × 2130`, normalized to `1920 × 1065` for comparison.
- Desktop implementation: `1920 × 1065`, drawer open, first renewal form expanded.
- Mobile implementation: `390 × 844`, drawer open.
- The source shows the closed retention screen, so it is used to verify the shell and design
  language. The drawer is the intentional interaction extension requested in the brief.

## Visual comparison

- Full comparison: `artifacts/retention-expiring-drawer-comparison.png`.
- Desktop result: `artifacts/retention-expiring-drawer-final.png`.
- Mobile result: `artifacts/retention-expiring-drawer-mobile.png`.

## Required surfaces

- Typography: the existing application font, weights and tabular numeric styles are preserved.
- Layout: the drawer is anchored to the right, keeps the retention queue visible and becomes
  full-width on mobile.
- Spacing: summary, search, client cards and inline renewal use the existing CRM card rhythm.
- Color: only system tokens are used (`bg-card`, `bg-muted`, `border-border`, semantic
  destructive badges); no raw colors were added.
- Assets: no new raster or generated assets; existing Lucide icons are used.
- Copy: concise Russian workflow copy focused on completing renewals without leaving the page.

## Interaction verification

- `Истекающие` and the warning banner open the same drawer.
- Search by client name and phone works.
- Inline renewal opens, selects a tariff, can be cancelled and submits through the canonical
  permission-checked Server Action.
- Call, copy phone and AI analysis actions remain available in context.
- The route stays `/retention`; successful renewal removes the client from the queue and refreshes
  server data.
- Fresh browser console errors: none.

## Findings

- First pass exposed a Base UI button semantics warning for the phone link; fixed with
  `nativeButton={false}` and rechecked.
- P0: none.
- P1: none.
- P2: none.
- P3: none.

## Final result

passed
