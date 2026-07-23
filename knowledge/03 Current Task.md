---
type: current-task
status: completed
updated: 2026-07-23
tags: [fitcrm, tasks, integrations, access-control]
---

# Current Task

Довести контроль доступа до устанавливаемой сборки: локальный FitCRM Bridge для Windows,
Linux и Docker с адаптерами Sigur, ZKTeco и Hikvision, дисковой очередью, retries,
health-check, конфигурацией из CRM и contract-тестами без физического турникета.

## Уже готово

- Карточки и страницы настройки добавлены в существующий раздел «Интеграции».
- Реализованы service-only настройки, зашифрованные секреты Bridge, привязки идентификаторов,
  входящие события, online decision, журнал и симулятор.
- Проход создаёт посещение атомарно, учитывает лимит абонемента, reservation, anti-passback и
  идемпотентность событий.
- Миграции `0082` и `0083` применены в production Supabase.
- Аппаратное открытие остаётся выключенным до contract-теста с конкретным контроллером.

## Готово

- Локальный FitCRM Bridge поставляется для Windows, Linux systemd и Docker.
- Реализованы адаптеры Sigur Public REST API, ZKBio CVSecurity/ZKBio Time/BioTime и
  Hikvision ISAPI/HikCentral.
- Дисковая очередь, retry/backoff, dead-letter, лимиты диска, heartbeat, health, doctor и
  provider checkpoints переживают перезапуск и временную недоступность FitCRM.
- В карточке провайдера доступны ZIP-релиз, ротация Bridge-ключа и персональный `config.json`.
- Contract/unit suite Bridge содержит 41 тест; TypeScript, Vitest и production build проходят.
- Миграция `0084_access_control_external_id` применена и проверена в production Supabase.
- Локальный UI-gate пройден в отдельном синтетическом QA-клубе; QA-данные удалены после проверки.

## Остаётся аппаратный gate

Синхронизация событий готова к установке, но конкретная модель, firmware, reader direction и
vendor API-коды проходят commissioning на объекте. Автоматическое управление реле остаётся
выключенным до hardware contract-test.
