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
- `50e3ef4` · 2026-07-18 · Document test baseline and RPC security incident
- `32f4975` · 2026-07-18 · Add security regression tests and harden public RPCs
- `cb792ac` · 2026-07-18 · Document verified Sydney infrastructure topology
- `abedb02` · 2026-07-18 · Add operational Obsidian knowledge vault
- `dcea7c6` · 2026-07-18 · Keep support diagnostics visible on mobile
- `58ffb23` · 2026-07-18 · Fix platform support mobile header
- `edd49e7` · 2026-07-18 · Fix platform connections mobile actions
- `1cf7e0a` · 2026-07-18 · Fix platform dashboard mobile grid
<!-- AUTO:END recent-commits -->

## Последние решения и деплои

- Решения: [[Decisions/ADR-0001-infrastructure-regions]] · [[Decisions/ADR-0002-server-action-authorization]]
- Deploy: нет доступных подтверждённых данных о времени последнего production deploy.

Последнее автоматическое обновление: <!-- AUTO:START updated-at -->
2026-07-18 Asia/Tashkent
<!-- AUTO:END updated-at -->
