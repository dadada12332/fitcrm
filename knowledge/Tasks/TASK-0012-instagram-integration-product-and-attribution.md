---
id: TASK-0012
type: feature
status: in-progress
priority: P2
module: integrations
created: 2026-07-18
updated: 2026-07-18
owner: unassigned
tags: [fitcrm, task, instagram, attribution]
---

# Instagram integration: content, leads and attribution

## Goal

Подключить профессиональный Instagram account клуба и показать контент, эффективность, входящие лиды и подтверждённую конверсию в клиентов/оплаты.

## Reason

Это следующая интеграция после Telegram. Архитектура должна отличать платформенные метрики Instagram от реально атрибутированных CRM-клиентов.

## Requirements

- OAuth Meta без ручного хранения access token в `clubs.settings`; encrypted/service-only credentials.
- Синхронизация posts/reels/stories и Insights с checkpoint, retry и rate-limit status.
- UTM/deep links, promo codes и lead forms для first-touch/last-touch attribution.
- Inbox leads с deduplication по телефону/Instagram identity и явным consent.
- Dashboard в дизайн-системе: reach, engagement, profile actions, leads, clients, revenue и conversion funnel.
- Универсальные `integration_connections`, `integration_sync_runs` и `integration_events` либо осознанный Telegram-compatible adapter слой.

## Acceptance criteria

- [ ] Permissions и Meta App Review requirements подтверждены по официальной документации.
- [ ] Метрики подписаны как platform-reported или CRM-attributed.
- [ ] Cross-club token/data isolation покрыта тестами.
- [ ] Disconnect/revoke и data deletion callback реализованы.
- [ ] Mobile/desktop UI и empty/error/rate-limited states проверены.

## Files and data

- Files: определить после API research.
- Tables: proposed `integration_connections`, `instagram_media`, `instagram_insights`, `marketing_touchpoints`, `integration_sync_runs`.

## Must not break

Telegram flows, tenant isolation, auth, production data и payment attribution.

## Changes

Добавлены migration `0062`, encrypted service-only connection, OAuth callback/state, Graph sync posts/reels/Insights, signed webhook, data deletion, disconnect и адаптивный dashboard. Platform metrics и CRM attribution разделены.

## Verification

- `npx tsc --noEmit` — passed.
- Vitest — 92 passed, 1 skipped.
- `npm run build` — passed.
- Production grants: credential/state/event tables service-only; derived tables authenticated SELECT only под RLS.
- Production deployment `dpl_86fEe4mCMKgoz3i89jDLnDcy9NAs` READY; mobile `390px` без overflow; неподписанные Meta callbacks отклоняются.

## Remaining

Реальный Meta App OAuth/App Review, end-to-end Graph verification, Direct inbox/deduplication, campaign link builder и scheduled incremental sync.

## Blockers

Требуются Meta Developer App, professional Instagram account, verified business и App Review. Без credentials UI честно показывает setup blocker.
