# Design QA: Telegram KPI

## Target

- User screenshot: legacy Telegram KPI cards with centered colored values.
- CRM reference pattern: `ClientsStats`, `MembershipsStats`, `ScheduleKPIs`, payments KPI.
- Expected result: one segmented KPI surface with neutral icons, left-aligned labels and values, responsive 2/4-column layout.

## Captures Reviewed

- Desktop: `/integrations/telegram`, connected QA state, 1280x720.
- Mobile: `/integrations/telegram`, connected QA state, 390x844.
- Mobile statistics tab: 390x844.

## Findings

- KPI typography, borders, spacing, icon treatment and colors match the established CRM pattern.
- Desktop renders four equal segments without independent floating cards.
- Mobile renders a stable 2x2 grid; labels wrap without clipping and values remain aligned.
- Light theme uses only design-system tokens. No raw colors or decorative styling added.
- Statistics tab reuses the same component and no longer nests muted cards inside a card.

## Result

final result: passed
