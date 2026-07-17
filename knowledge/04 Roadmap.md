---
type: roadmap
status: active
updated: 2026-07-18
tags: [fitcrm, product]
---

# Roadmap

Этот roadmap отражает подтверждённое текущее направление. `FITCRM_ROADMAP.md` от 2026-07-06 остаётся историческим снимком и не используется как оперативный источник.

## Now — production readiness

- Подтвердить и сблизить регионы Vercel/Supabase.
- Добавить автоматические проверки tenant isolation, auth и критических сценариев.
- Настроить monitoring/error tracking и алерты.
- Проверить backup/restore процесс.
- Завершить провайдеры SMS/email и автоматические уведомления.

## Next — устойчивость продукта

- Усилить enforcement тарифных лимитов.
- Завершить classes/bookings UI.
- Довести audit trail и Platform Admin monitoring.
- Формализовать release и rollback процесс.
- Сгенерировать типы Supabase и постепенно убрать критический `any`.

## Later

- White label и домены клубов.
- Публичный API и внешние интеграции.
- Полноценный AI-ассистент.
- Клиентские мобильные приложения и публичная запись.

Состояние конкретных работ: [[05 Kanban]]. Launch-критерии: [[Infrastructure/Launch Checklist]].
