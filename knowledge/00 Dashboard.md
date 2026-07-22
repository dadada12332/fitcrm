---
type: dashboard
updated: 2026-07-18
tags: [fitcrm, operations]
---

# FitCRM Dashboard

## Сейчас

| Поле | Значение |
|---|---|
| Версия package | `0.1.0` |
| Окружение | Production + local; отдельные staging/preview не подтверждены |
| Production | [fitcrm-three.vercel.app](https://fitcrm-three.vercel.app), состояние последнего deploy не проверено |
| Спринт | Production readiness и стабилизация |
| Активная задача | [[Tasks/TASK-0006-pererabotat-ai-analitiku-po-dizain-sisteme]] |

## Быстрый обзор

- Состояние: [[02 Current State]]
- Работа: [[05 Kanban]] · [[04 Roadmap]]
- Риски: [[08 Known Issues]]
- Решения: [[07 Decision Log]]
- Изменения: [[06 Changelog]]
- Передача AI: [[10 AI Handoff]]

## Ближайший фокус

1. Провести backup/restore drill.
2. Переработать AI Аналитику по дизайн-системе.
3. Расширить data-mutating E2E после появления staging DB.
4. Закрыть launch-блокеры: мониторинг, dependency advisories и реальные SMS/email.

## Критические риски

- Нет изолированного staging Supabase для автоматического data-mutating E2E.
- `xlsx` содержит high dependency advisories.
- Стратегия restore не проверена.

## Последние завершённые изменения

<!-- AUTO:START recent-commits -->
- `db482fa` · 2026-07-22 · docs: record upgrade CTA refinement [skip ci]
- `fe68f58` · 2026-07-22 · fix: preserve upgrade button height
- `057d003` · 2026-07-22 · style: strengthen plan upgrade call to action
- `2f37b01` · 2026-07-22 · docs: record plan limit audit release [skip ci]
- `f4f7cb2` · 2026-07-22 · feat: audit plan limits and add upgrade dialog
- `898f6b8` · 2026-07-22 · docs: record landing previous-price release [skip ci]
- `908eae6` · 2026-07-22 · fix: show previous plan price on landing
- `a080c10` · 2026-07-22 · docs: record plan enforcement release [skip ci]
<!-- AUTO:END recent-commits -->

## Последние решения и деплои

- Решения: [[Decisions/ADR-0001-infrastructure-regions]] · [[Decisions/ADR-0002-server-action-authorization]]
- Deploy: нет доступных подтверждённых данных о времени последнего production deploy.

Последнее автоматическое обновление: <!-- AUTO:START updated-at -->
2026-07-22 Asia/Tashkent
<!-- AUTO:END updated-at -->
