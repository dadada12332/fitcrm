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

# Design QA: Reports Attention

## Target

- Replace equal-weight floating alert cards with one quiet operational surface.
- Preserve direct navigation while separating actionable problems from attendance context.

## Captures Reviewed

- Desktop: `/reports`, authorized QA club, 1280x720.
- Mobile: `/reports`, authorized QA club, 390x844.
- Interaction: at-risk client row to the clients report.

## Findings

- Priority rows use CRM tokens and consistent 8px surfaces without raw colors.
- Resolved rows are visibly calm and disabled; active rows remain obvious and actionable.
- Attendance is a separate segment and no longer competes with urgent tasks.
- Labels and descriptions wrap correctly on mobile without horizontal overflow.
- The alert badge matches the actual sum of expiring, at-risk and debt records.

## Result

final result: passed

# Design QA: Telegram Broadcast

## Target

- CRM reference pattern: compact bordered tools, Zinc/shadcn tokens, restrained status colors and clear primary action.
- Expected result: one coherent broadcast workflow with a readable editor, separate live preview and responsive history.

## Captures Reviewed

- Before: connected QA state at 1280x720.
- After: connected QA state at 1280x720 and 390x844.
- Mobile interaction states: scheduled send, variable popover, personalized preview and 4097/4096 limit error.

## Findings

- The previous three-column grid squeezed the composer and detached settings from the send action.
- The new two-column layout gives the composer the primary width and keeps the preview stable at 340px.
- Mobile controls stack without horizontal overflow; primary and test actions remain reachable below the editor.
- Telegram limits, attachment metadata and errors are visible before submission.
- The preview uses CRM tokens and the real bot display name while external links use the bot username.

## Result

final result: passed
