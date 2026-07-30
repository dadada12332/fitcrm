---
type: dashboard
updated: 2026-07-30
tags: [fitcrm, operations]
---

# FitCRM Dashboard

## Сейчас

| Поле | Значение |
|---|---|
| Версия package | `0.1.0` |
| Окружение | Production + local; отдельные staging/preview не подтверждены |
| Production | [fitcrm-three.vercel.app](https://fitcrm-three.vercel.app), deployment `dpl_4nQEW2YfGp3kPjkChRhPT1qtJV5b` READY; smoke и error scan чистые |
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
- `ae4f9c7` · 2026-07-29 · docs: record promo preview fix [skip ci]
- `770d370` · 2026-07-29 · fix: preview promo discounts in subscription
- `0b1978e` · 2026-07-29 · docs: record club compensation release [skip ci]
- `a7467db` · 2026-07-29 · feat: add targeted club compensations
- `b43c287` · 2026-07-28 · docs: record legacy banner removal [skip ci]
- `32d031a` · 2026-07-28 · fix: remove legacy CRM system banner
- `4ef8d18` · 2026-07-28 · docs: record CRM announcements release [skip ci]
- `7c3a1b4` · 2026-07-28 · feat: deliver platform announcements in CRM
<!-- AUTO:END recent-commits -->

## Последние решения и деплои

- Решения: [[Decisions/ADR-0001-infrastructure-regions]] · [[Decisions/ADR-0002-server-action-authorization]]
- Deploy: нет доступных подтверждённых данных о времени последнего production deploy.

Последнее автоматическое обновление: <!-- AUTO:START updated-at -->
2026-07-30 Asia/Tashkent
<!-- AUTO:END updated-at -->
