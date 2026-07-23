# FitCRM Access Bridge

Локальный агент между FitCRM Cloud и уже установленной в клубе системой контроля доступа.
Bridge работает внутри сети клуба: учётные данные Sigur/ZKBio/HikCentral не покидают локальный
компьютер, а наружу уходит только нормализованное событие прохода.

## Требования

- Node.js 20+ либо Docker;
- постоянный исходящий HTTPS-доступ к FitCRM;
- локальная доступность сервера/контроллера СКУД;
- API-лицензия производителя, если она требуется установленной версией.

## Быстрый запуск

1. В CRM откройте «Интеграции» → нужный провайдер.
2. Создайте Bridge-ключ и скачайте персональный `config.json`.
3. Замените в нём адрес СКУД, ID считывателей и значения, помеченные `REPLACE`.
4. Задайте переменные `VENDOR_USERNAME` и `VENDOR_PASSWORD`.
5. Выполните `npm run doctor -- ./config.json`, затем `npm start -- ./config.json`.
6. Проверьте `http://127.0.0.1:8787/health`.

Для Docker скопируйте `config.docker.example.json` в `config.docker.json` и используйте
`docker compose -f docker-compose.example.yml up -d --build`.
Для Windows запустите PowerShell от администратора:
`.\deploy\install-windows.ps1 -ConfigPath .\config.json`.
Для Linux с systemd: `sudo ./deploy/install-linux.sh ./config.json`.

## Что уже реализовано

- Sigur Public REST API: авторизация, `/events`, курсор и дедупликация;
- ZKBio CVSecurity / ZKBio Time / BioTime: настраиваемые официальные API-пути и профили полей;
- Hikvision ISAPI: Digest authentication и поток `alertStream`;
- HikCentral OpenAPI: Artemis HMAC и callback/polling режим;
- дисковая очередь с атомарной записью, backoff и dead-letter;
- heartbeat, `/health`, `/doctor`, безопасная ротация ключа;
- Windows Scheduled Task, Linux systemd и Docker;
- 31 contract/unit тест без зависимости от реального оборудования.

## Fail-closed

- online access request при недоступности FitCRM всегда получает отказ;
- подтверждённые passage-события сохраняются в дисковой очереди и доставляются повторно;
- неизвестный или неподтверждённый результат не создаёт посещение;
- стабильный ID события предотвращает двойное списание визита.

## Ограничение аппаратной проверки

Эмуляторы и contract-тесты проверяют парсинг, авторизацию, очередь и cloud-flow, но не могут
подтвердить электрическое реле, направление считывателей, offline-буфер и особенности firmware.
Перед включением реле выполните commissioning checklist для конкретной модели.
Чек-лист находится в `docs/commissioning.md`.
