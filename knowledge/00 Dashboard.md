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
- `dd013bb` · 2026-07-18 · Add Telegram Mini App back navigation
- `0e869c3` · 2026-07-18 · Document Telegram multi-club self-test fix [skip ci]
- `9cd0b22` · 2026-07-18 · Scope Telegram self-test to current club
- `e7ea58e` · 2026-07-18 · Document Telegram Mini App and Instagram rollout [skip ci]
- `b2dc9f2` · 2026-07-18 · Harden Instagram deletion callback
- `d2c603e` · 2026-07-18 · Refine Instagram setup layout
- `7e64c47` · 2026-07-18 · Add Instagram integration foundation
- `580b9e8` · 2026-07-18 · Add Telegram client Mini App
<!-- AUTO:END recent-commits -->

## Последние решения и деплои

- Решения: [[Decisions/ADR-0001-infrastructure-regions]] · [[Decisions/ADR-0002-server-action-authorization]]
- Deploy: нет доступных подтверждённых данных о времени последнего production deploy.

Последнее автоматическое обновление: <!-- AUTO:START updated-at -->
2026-07-18 Asia/Tashkent
<!-- AUTO:END updated-at -->
