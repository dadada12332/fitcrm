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
| Активная задача | [[Tasks/TASK-0003-critical-flow-tests]] |

## Быстрый обзор

- Состояние: [[02 Current State]]
- Работа: [[05 Kanban]] · [[04 Roadmap]]
- Риски: [[08 Known Issues]]
- Решения: [[07 Decision Log]]
- Изменения: [[06 Changelog]]
- Передача AI: [[10 AI Handoff]]

## Ближайший фокус

1. Подтвердить фактический регион Supabase и близость к Vercel.
2. Добавить автоматические проверки критических auth/RLS и пользовательских сценариев.
3. Провести backup/restore drill.
4. Закрыть launch-блокеры: мониторинг и реальные SMS/email.

## Критические риски

- Регион Supabase не подтверждён, а Vercel настроен на `syd1`.
- Нет unit/integration CI и автоматических RLS-тестов.
- Стратегия restore не проверена.

## Последние завершённые изменения

<!-- AUTO:START recent-commits -->
- `abedb02` · 2026-07-18 · Add operational Obsidian knowledge vault
- `dcea7c6` · 2026-07-18 · Keep support diagnostics visible on mobile
- `58ffb23` · 2026-07-18 · Fix platform support mobile header
- `edd49e7` · 2026-07-18 · Fix platform connections mobile actions
- `1cf7e0a` · 2026-07-18 · Fix platform dashboard mobile grid
- `f4543f3` · 2026-07-18 · Unify platform admin design system
- `44e8945` · 2026-07-17 · Hide breadcrumbs on mobile top bar
- `5172f4f` · 2026-07-17 · Filter expired notifications by end date
<!-- AUTO:END recent-commits -->

## Последние решения и деплои

- Решения: [[Decisions/ADR-0001-infrastructure-regions]] · [[Decisions/ADR-0002-server-action-authorization]]
- Deploy: нет доступных подтверждённых данных о времени последнего production deploy.

Последнее автоматическое обновление: <!-- AUTO:START updated-at -->
2026-07-18 Asia/Tashkent
<!-- AUTO:END updated-at -->
