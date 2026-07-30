---
type: ai-handoff
status: active
updated: 2026-07-18
tags: [zalkins, ai]
---

# AI Handoff

## Читать первым

1. `/AGENTS.md` — критические инженерные правила.
2. [[01 Project Context]] — стабильный контекст.
3. [[02 Current State]] — текущее состояние.
4. [[03 Current Task]] и [[05 Kanban]] — активная работа.
5. `/DESIGN_SYSTEM.md` и профильный ADR/документ для конкретной задачи.

## Краткий контекст

Zalkins — Next.js 16 + React 19 мультитенантная CRM для фитнес-клубов Узбекистана. Данные,
Auth, RLS, Realtime и Storage находятся в Supabase; приложение — Vercel. Prisma/tRPC отсутствуют.
Репозиторий, legacy lowercase identifiers и текущий production alias пока сохраняют имя `fitcrm`
для обратной совместимости.

## Текущая задача

<!-- AUTO:START current-task -->
Нет активной задачи. Выберите следующую из [[05 Kanban]].
<!-- AUTO:END current-task -->

## Последние существенные изменения

<!-- AUTO:START recent-changes -->
- `86e7cd6` · 2026-07-30 · docs: record membership chevron QA [skip ci]
- `f20a71a` · 2026-07-30 · fix: align membership duration chevron
- `8f514a4` · 2026-07-30 · docs: record dashboard border QA [skip ci]
- `933fafe` · 2026-07-30 · fix: remove doubled dashboard chart border
- `6466723` · 2026-07-30 · docs: record membership freeze release [skip ci]
- `0791937` · 2026-07-30 · feat: configure membership freeze allowance
- `86287ca` · 2026-07-30 · docs: record language switcher release [skip ci]
- `ae299d3` · 2026-07-30 · fix: simplify language switcher chrome
- `ae4f9c7` · 2026-07-29 · docs: record promo preview fix [skip ci]
- `770d370` · 2026-07-29 · fix: preview promo discounts in subscription
<!-- AUTO:END recent-changes -->

## Известные проблемы

- Vercel `syd1` и Supabase `ap-southeast-2` подтверждены как Sydney-регионы; cold latency остаётся под наблюдением.
- Unit/integration и opt-in tenant isolation тесты существуют локально; автоматический GitHub CI пока не подключён.
- SMS/email delivery и проверенный backup/restore отсутствуют.
- Подробнее: [[08 Known Issues]].

## Нельзя нарушать

- Каждая мутирующая Server Action проверяет `getCurrentClub()` и `can(...)`.
- `createServiceClient()` требует ручного `clubId` scope.
- `.or(...ilike...)` использует `sanitizeSearchTerm()`.
- UI использует дизайн-токены и `src/components/ui/`; пути всегда проверяются по коду.
- Не логировать и не сохранять секреты или клиентские данные.
- Не считать deploy/tests успешными без фактической проверки.

## UI QA gate

- Для UI-задач сначала проверять localhost авторизованным синтетическим QA-пользователем в отдельном клубе без клиентских данных.
- Проверять сценарий, framework overlay, browser/server errors и фактический визуальный результат; затем запускать TypeScript, релевантные тесты и build.
- Push в `main` выполнять только после успешной локальной проверки, затем проверять production deployment.
- В финальном отчёте по каждой UI-правке, включая небольшую, прикладывать актуальный screenshot из проверенного приложения; для responsive-правок показывать desktop и mobile отдельно.
- QA credentials существуют только локально и не должны попадать в Git, knowledge, Obsidian или вывод команд.

## Источники истины

Код → реализация; миграции → БД; Git → история; Figma/`DESIGN_SYSTEM.md` → UI; Current State → оперативный статус; ADR → причины решений; Kanban → работа.

## Не предполагать без проверки

Production deploy, применённые миграции, регион Supabase, наличие провайдеров и точные пути из старых `FITCRM_*` документов.

Последнее автоматическое обновление: <!-- AUTO:START updated-at -->
2026-07-30 Asia/Tashkent
<!-- AUTO:END updated-at -->
