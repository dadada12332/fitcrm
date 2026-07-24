---
type: current-task
status: blocked
updated: 2026-07-24
tags: [fitcrm, tasks, integrations, google-calendar]
---

# Current Task

Подключить Google Calendar в существующем каталоге интеграций и убрать нерабочую карточку
WhatsApp.

## Готово

- WhatsApp удалён из каталога, пустой раздел «Скоро» не показывается.
- Google Calendar стал рабочей интеграцией с отдельной страницей подключения.
- OAuth использует одноразовый state, offline access и минимальный календарный scope.
- Access/refresh tokens хранятся только server-side в зашифрованном виде.
- Ручная синхронизация создаёт и обновляет занятия на 180 дней без дублей; удалённые и
  отменённые занятия удаляются из Google Calendar.
- Отключение отзывает токен и удаляет будущие события, созданные FitCRM.
- Миграция `0085_google_calendar_integration` применена и проверена в production Supabase.
- TypeScript, ESLint, Vitest и production build проходят.

## Внешняя настройка

Для реального OAuth нужны Google Cloud OAuth Web credentials и включённый Google Calendar API.
Переменные `GOOGLE_CALENDAR_CLIENT_ID` и `GOOGLE_CALENDAR_CLIENT_SECRET` пока отсутствуют в
локальном/Vercel окружении, поэтому кнопка подключения остаётся disabled до их добавления.
