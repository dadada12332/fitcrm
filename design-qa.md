# Design QA — sidebar, top bar, subscription limits and profile

- Source visuals:
  - `/var/folders/lb/xkrtj8910d98wdwc_pflc1s80000gn/T/TemporaryItems/NSIRD_screencaptureui_zJvnP2/Снимок экрана 2026-07-27 в 05.47.49.png`
  - `/var/folders/lb/xkrtj8910d98wdwc_pflc1s80000gn/T/TemporaryItems/NSIRD_screencaptureui_AjfGdJ/Снимок экрана 2026-07-27 в 05.48.22.png`
  - `/var/folders/lb/xkrtj8910d98wdwc_pflc1s80000gn/T/TemporaryItems/NSIRD_screencaptureui_uapF2M/Снимок экрана 2026-07-27 в 05.48.49.png`
  - `/var/folders/lb/xkrtj8910d98wdwc_pflc1s80000gn/T/TemporaryItems/NSIRD_screencaptureui_DSWhzk/Снимок экрана 2026-07-27 в 05.51.09.png`
- Implementation screenshots:
  - `/Users/amiran/fitcrm/artifacts/collapsed-club-switcher-visits-final.jpg`
  - `/Users/amiran/fitcrm/artifacts/subscription-limits-badge-fixed.jpg`
  - `/Users/amiran/fitcrm/artifacts/profile-redesign-desktop.jpg`
- Combined comparisons:
  - `/Users/amiran/fitcrm/artifacts/sidebar-collapsed-comparison-final.png`
  - `/Users/amiran/fitcrm/artifacts/profile-redesign-comparison-final.png`
- Browser viewport: 1681 × 1420 CSS pixels, device scale 1
- State: authenticated owner, light theme, Russian locale

## Full-view comparison evidence

The collapsed sidebar now keeps its 72 px footprint while the club menu is rendered in a
portal above the application shell. The menu no longer inherits the sidebar's clipping and
has enough width for the complete club name. The Visits page remains aligned and does not
shift when the switcher opens.

The profile now follows the compact CRM card system instead of one long form. Identity,
personal data, password, Telegram, email and active sessions have clear ownership and
separate actions. The two-column desktop layout preserves a short scan path and stacks
responsively without introducing new visual primitives.

## Focused comparison evidence

- The collapsed switcher comparison uses the same Visits route, interaction state and
  568 × 664 pixel region. The broken clipped panel is replaced by a complete anchored menu.
- The subscription accordion trigger keeps its title block on the left and places the
  secondary `6 лимитов` badge at the right edge, using a muted semantic badge.
- The top bar gives search a responsive 208–320 px desktop width and an 8 px separation
  before the language/theme/notification controls. The theme icon is now 20 px.
- The old `/settings/security` route redirects to `/profile#security`, so password and
  session controls have one canonical location.

## Required fidelity surfaces

- Typography: existing Geist hierarchy, label scale and CRM heading weights are preserved.
- Spacing: existing `gap`, card padding and responsive grid utilities are reused.
- Colors: semantic `bg-card`, `bg-muted`, `border-border`, `text-foreground`,
  `text-muted-foreground` and brand tokens only.
- Icons: existing Lucide icon set, with consistent 16–20 px sizing.
- Interaction: club list loads on open, tenant switching performs a full navigation,
  profile mutations show pending/result states, and destructive disconnect is explicit.

## Comparison history

1. P1 — the club list was absolutely positioned inside an `overflow-hidden` 72 px sidebar.
   Fix: portal-backed dropdown with a fixed readable width.
2. P2 — the subscription count badge competed with the title and sat near the middle.
   Fix: flexible title container plus a restrained trailing secondary badge.
3. P2 — search and utility controls were visually compressed.
   Fix: responsive search width, stable control sizes and explicit inter-group spacing.
4. P1 — profile security duplicated club settings and the profile was one dense sheet.
   Fix: one canonical personal-security surface and a compact task-oriented card layout.

## Primary interactions tested

- Collapse sidebar, open club switcher, wait for branches, and verify complete club labels.
- Open profile and verify all account sections render without horizontal overflow.
- Open `/settings/security` and verify redirect to `/profile#security`.
- Verify subscription accordion alignment in its collapsed state.
- Run TypeScript, focused security tests, production build and browser DOM checks.

## Remaining findings

No actionable P0/P1/P2 visual findings remain in the requested scope.

## Final result

passed
