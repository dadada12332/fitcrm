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
- `62a645a` · 2026-07-18 · Configure Obsidian Kanban and Calendar [skip ci]
- `9c6d5a6` · 2026-07-18 · Document AI page spacing fix [skip ci]
- `2628a08` · 2026-07-18 · Align AI analytics page spacing
- `1610389` · 2026-07-18 · Document Telegram client identity model [skip ci]
- `2e3e585` · 2026-07-18 · Link Telegram visits by CRM client identity
- `26e801e` · 2026-07-18 · Document secure Telegram QR rollout [skip ci]
- `efd8664` · 2026-07-18 · Secure Telegram Mini App QR passes
- `d9295b4` · 2026-07-18 · Document Telegram Mini App back navigation [skip ci]
<!-- AUTO:END recent-commits -->

## Последние решения и деплои

- Решения: [[Decisions/ADR-0001-infrastructure-regions]] · [[Decisions/ADR-0002-server-action-authorization]]
- Deploy: нет доступных подтверждённых данных о времени последнего production deploy.

Последнее автоматическое обновление: <!-- AUTO:START updated-at -->
2026-07-18 Asia/Tashkent
<!-- AUTO:END updated-at -->
