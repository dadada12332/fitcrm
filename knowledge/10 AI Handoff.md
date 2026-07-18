---
type: ai-handoff
status: active
updated: 2026-07-18
tags: [fitcrm, ai]
---

# AI Handoff

## Читать первым

1. `/AGENTS.md` — критические инженерные правила.
2. [[01 Project Context]] — стабильный контекст.
3. [[02 Current State]] — текущее состояние.
4. [[03 Current Task]] и [[05 Kanban]] — активная работа.
5. `/DESIGN_SYSTEM.md` и профильный ADR/документ для конкретной задачи.

## Краткий контекст

FitCRM — Next.js 16 + React 19 мультитенантная CRM для фитнес-клубов Узбекистана. Данные, Auth, RLS, Realtime и Storage находятся в Supabase; приложение — Vercel. Prisma/tRPC отсутствуют.

## Текущая задача

<!-- AUTO:START current-task -->
[[03 Current Task]] — TASK-0004, status `blocked`: Провести backup/restore drill.
<!-- AUTO:END current-task -->

## Последние существенные изменения

<!-- AUTO:START recent-changes -->
- `580b9e8` · 2026-07-18 · Add Telegram client Mini App
- `e9e64ae` · 2026-07-18 · Document Telegram self-test fix [skip ci]
- `7a7ce7c` · 2026-07-18 · Fix Telegram self-test pairing
- `56bcd9c` · 2026-07-18 · Document verified Telegram production rollout [skip ci]
- `7cc3f87` · 2026-07-18 · Enforce one club per Telegram bot
- `e3af97f` · 2026-07-18 · Rebuild Telegram integration around club bots
- `249ee65` · 2026-07-18 · Document roles loading fix [skip ci]
- `28efccd` · 2026-07-18 · Fix roles settings loading loop
- `ec911ad` · 2026-07-18 · Document client payment binding [skip ci]
- `119d7f7` · 2026-07-18 · Bind client profile payments to client
<!-- AUTO:END recent-changes -->

## Известные проблемы

- Регион Supabase не подтверждён при Vercel `syd1`.
- Нет unit/integration CI и автоматических tenant isolation тестов.
- SMS/email delivery и проверенный backup/restore отсутствуют.
- Подробнее: [[08 Known Issues]].

## Нельзя нарушать

- Каждая мутирующая Server Action проверяет `getCurrentClub()` и `can(...)`.
- `createServiceClient()` требует ручного `clubId` scope.
- `.or(...ilike...)` использует `sanitizeSearchTerm()`.
- UI использует дизайн-токены и `src/components/ui/`; пути всегда проверяются по коду.
- Не логировать и не сохранять секреты или клиентские данные.
- Не считать deploy/tests успешными без фактической проверки.

## Источники истины

Код → реализация; миграции → БД; Git → история; Figma/`DESIGN_SYSTEM.md` → UI; Current State → оперативный статус; ADR → причины решений; Kanban → работа.

## Не предполагать без проверки

Production deploy, применённые миграции, регион Supabase, наличие провайдеров и точные пути из старых `FITCRM_*` документов.

Последнее автоматическое обновление: <!-- AUTO:START updated-at -->
2026-07-18 Asia/Tashkent
<!-- AUTO:END updated-at -->
