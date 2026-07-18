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
[[03 Current Task]] — TASK-0007, status `in-progress`: Ночной аудит надёжности и производительности.
<!-- AUTO:END current-task -->

## Последние существенные изменения

<!-- AUTO:START recent-changes -->
- `63a6670` · 2026-07-18 · Harden Telegram tenant boundaries
- `dc9b926` · 2026-07-18 · Replace vulnerable spreadsheet parser
- `6ded6e4` · 2026-07-18 · Report infrastructure health truthfully
- `686869d` · 2026-07-18 · Scope payment service queries by club
- `470bf62` · 2026-07-18 · Redesign AI analytics workspace
- `55eeb1d` · 2026-07-18 · Add guarded backup restore runbook
- `50e3ef4` · 2026-07-18 · Document test baseline and RPC security incident
- `32f4975` · 2026-07-18 · Add security regression tests and harden public RPCs
- `cb792ac` · 2026-07-18 · Document verified Sydney infrastructure topology
- `abedb02` · 2026-07-18 · Add operational Obsidian knowledge vault
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
