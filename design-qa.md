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

# Design QA: Landing Pricing

## Target

- Make pricing easier to scan while keeping plan data controlled by Platform Admin.
- Turn Standard into the clear recommended choice through value, proof and action hierarchy.
- Preserve the restrained light landing style and responsive behavior.

## Captures Reviewed

- Before: production `/#pricing`, 1440x1000.
- After: local `/#pricing`, 1440x1000 and 390x844.
- Interaction: monthly/yearly billing, four registration CTAs, Russian and Uzbek.

## Findings

- The corner ribbon was replaced with a compact recommendation badge and a clear value proposition.
- Standard now has a focused blue CTA, proof block and stable visual emphasis without changing database pricing.
- Plan names and conversion copy are localized instead of mixing English names into Russian and Uzbek pages.
- All cards remain readable in a 4-column desktop grid and a single-column mobile flow.
- The pricing container expands to 1760px; laptop widths use a 2×2 grid instead of compressing four narrow columns.
- No horizontal overflow was found at 390px; billing controls and long Uzbek copy fit correctly.

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

# Design QA: Landing Growth OS and Retention

## Target

- Continue the existing light editorial landing style without introducing a separate visual system.
- Explain Retention and Growth OS as one product flow before the pricing section.
- Keep the product story readable and interactive on desktop and mobile.

## Captures Reviewed

- Desktop: `/\#growth-os`, 1440x1000, Russian.
- Mobile: `/\#growth-os`, 390x844, Russian and Uzbek.
- Interaction: all three retention signals and synchronized Growth OS action state.

## Findings

- The section reuses the landing's large typography, framed product surfaces and restrained blue accent.
- Retention signals, AI recommendation, next action and expected result form one clear left-to-right story on desktop.
- Mobile stacks the two product surfaces without horizontal overflow or clipped labels.
- Automatic scenario rotation pauses on hover/focus and respects reduced-motion preferences.
- The AI recommendation now exposes two concrete employee outputs: a call script and SMS copy, both readable on desktop and mobile.
- Russian, English and Uzbek dictionaries are complete and type-safe.

## Result

final result: passed
