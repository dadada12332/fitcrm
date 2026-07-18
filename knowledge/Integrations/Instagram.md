---
type: integration
status: in-progress
updated: 2026-07-18
tags: [fitcrm, instagram, meta, integrations, attribution]
---

# Instagram Integration

## Product boundary

FitCRM подключает профессиональный Instagram account клуба через Instagram Login. Платформенные метрики Meta и CRM-атрибуция показываются отдельно: reach/views не считаются лидами, а клиент и выручка попадают в attribution только через `marketing_touchpoints`.

## Implemented foundation

- OAuth authorization code flow с одноразовым SHA-256 state и сроком жизни 10 минут.
- Long-lived token хранится AES-256-GCM encrypted в service-only `integration_connections`.
- Синхронизация до 50 posts/reels, базовых counters и доступных media/account Insights.
- Журнал `integration_sync_runs` с error/rate-limit состояниями.
- Подписанный `X-Hub-Signature-256` webhook и идемпотентное хранение событий.
- Meta data deletion callback и disconnect с отзывом permissions и удалением локальных данных.
- Адаптивный `/integrations/instagram` с platform-reported и CRM-attributed метриками.
- Migration `0062_instagram_integration_foundation.sql` применена в production Supabase.

## Meta setup

Vercel production variables:

- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`
- `META_GRAPH_API_VERSION=v25.0`

Meta dashboard URLs:

- OAuth redirect: `https://fitcrm-three.vercel.app/api/integrations/instagram/callback`
- Webhook: `https://fitcrm-three.vercel.app/api/integrations/instagram/webhook`
- Data deletion: `https://fitcrm-three.vercel.app/api/integrations/instagram/data-deletion`

Requested permissions: `instagram_business_basic`, `instagram_business_manage_insights`, `instagram_business_manage_comments`, `instagram_business_manage_messages`, `instagram_business_content_publish`.

## Security invariants

- Token, OAuth state and raw webhook payload are inaccessible to `anon` and `authenticated`.
- Derived media, Insights, sync runs and touchpoints are read-only for authenticated staff and filtered by `user_club_ids()` RLS.
- Every mutating CRM action checks `settings.integrations` and manually scopes service-role queries by `club_id`.
- Webhook rejects requests without a valid Meta HMAC signature.

## Remaining

- Create/configure Meta Developer App and pass App Review; no production credentials currently exist.
- Verify OAuth, Insights and webhook end to end against a real professional account.
- Process Direct events into a consent-aware inbox with identity/phone deduplication.
- Add UTM/deep-link campaign builder and first-touch/last-touch rules.
- Add scheduled incremental sync after real API rate limits are measured.

## Production verification

- Commit `b2dc9f2`, Vercel deployment `dpl_86fEe4mCMKgoz3i89jDLnDcy9NAs` READY; alias `fitcrm-three.vercel.app` points to it.
- Authenticated owner opens `/integrations/instagram`; empty setup state renders correctly when Meta credentials are absent.
- Mobile viewport `390x844`: `scrollWidth=390`, nested cards `0`, connect button safely disabled.
- Invalid webhook signature and unsigned data-deletion request return `401`; missing webhook verify token returns `403`; invalid OAuth state redirects without exchanging a token.
- Vitest: 92 passed, 1 skipped; TypeScript, target ESLint and production build passed.

## Official sources

- [Instagram Platform overview](https://developers.facebook.com/documentation/instagram-platform/overview)
- [Instagram Insights](https://developers.facebook.com/documentation/instagram-platform/insights)
- [Instagram Webhooks](https://developers.facebook.com/documentation/instagram-platform/webhooks)
- [Instagram content publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing)
