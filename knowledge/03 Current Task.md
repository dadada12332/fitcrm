---
type: current-task
status: completed
updated: 2026-07-24
tags: [fitcrm, tasks, integrations, google-calendar]
---

# Current Task

Подключить Google Calendar в существующем каталоге интеграций, убрать нерабочую карточку
WhatsApp и дать сотруднику управляемый календарный workspace без автоматического переноса данных.

## Готово

- WhatsApp удалён из каталога, пустой раздел «Скоро» не показывается.
- Google Calendar стал рабочей интеграцией с отдельной страницей подключения.
- OAuth использует одноразовый state, offline access и минимальный календарный scope.
- Access/refresh tokens хранятся только server-side в зашифрованном виде.
- После OAuth открывается календарный workspace: месяц, события и заметки Google, форма нового
  события и список недавних посещений CRM.
- Ничего не переносится автоматически. Сотрудник отмечает нужные посещения и отправляет только
  выбранные; повторный перенос обновляет то же Google-событие без дубля.
- Отключение отзывает токен, но не удаляет осознанно созданные или перенесённые события.
- Миграция `0085_google_calendar_integration` применена и проверена в production Supabase.
- Google Calendar API включён; OAuth client опубликован для External audience, production callback
  добавлен, Client ID/Secret/Redirect URI сохранены в Vercel Production и Preview.
- Локально проверены disconnected и connected workspace, календарная сетка, форма и явный выбор
  посещения; TypeScript и production build проходят.

## Остаётся

- Для снятия Google-экрана «непроверенное приложение» и user cap до 100 пользователей потребуется
  OAuth verification Google; ранний controlled beta технически работает до прохождения verification.
