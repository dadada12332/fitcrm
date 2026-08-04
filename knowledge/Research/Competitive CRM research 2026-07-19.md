---
type: research
status: active
updated: 2026-08-04
tags: [fitcrm, research, crm, retention, leads]
---

# Competitive CRM research — 2026-07-19

## Цель

Сравнить FitCRM с доступными fitness CRM и региональными CRM, выделить повторяющиеся продуктовые паттерны и выбрать безопасную для локального прототипа функцию.

## Проверенные официальные источники

| Решение | Наблюдаемый акцент | Ссылка |
| --- | --- | --- |
| Gymdesk | Lead capture, pipeline, follow-up, источники и conversion tracking | https://gymdesk.com/features/lead-management |
| Mindbody | Настраиваемая воронка, задачи, timeline касаний и аналитика | https://www.mindbodyonline.com/en-gb/business/lead-management |
| Glofox | Capture/nurture лидов и связанный fitness lifecycle | https://www.glofox.com/llm-info/ |
| Virtuagym | Lead management, retention tools, community и challenges | https://business.virtuagym.com/ |
| PerfectGym | At-risk members, predictive sales insights и поведенческие сигналы | https://www.perfectgym.com/en/solutions/gym-management-software |
| Zen Planner | Engagement tracking, автоматические коммуникации и churn prevention | https://zenplanner.com/blogs/choosing-the-best-gym-management-software-for-member-retention/ |
| UZFIT | Абонементы, клиенты, посещения, платежи, аналитика и помощь с запуском | https://uzfit.uz/crm |
| FitBase Uzbekistan | Задачи, роли, приложение, формы сайта и мессенджеры | https://fitbase.uz/capabilities |
| FitBase Kazakhstan | Лиды из нескольких каналов, воронка, автозадачи и коммуникации | https://fitbase.kz/ |
| Umai CRM | Kanban лидов, омниканальность и локальные интеграции | https://www.umaicrm.kz/ |
| LuckyFit | Захват лидов, задачи, аналитика и контроль доступа | https://lucky-fit.com/ru/ |

## Выводы

1. Главный стратегический пробел FitCRM — полноценный presale lead pipeline: источник, стадия, ответственный, следующее действие, история касаний, причина потери и conversion analytics.
2. Второй повторяющийся паттерн — не просто отчетность, а actionable retention: система сама выделяет риск, объясняет его и ведет к следующему действию.
3. Региональные продукты продают не только список модулей, но и локальную адаптацию, внедрение, коммуникации и быстрый старт.
4. FitCRM уже имеет достаточно данных для retention MVP без новой схемы: срок абонемента, посещения, долг, заморозка и цена.

## Дополнительный innovation scan

- PerfectGym описывает real-time engagement score, at-risk workflows, behavioral segmentation и personalized re-engagement: https://www.perfectgym.com/en/blog/business/reactive-proactive-role-predictive-analytics-gym-member-retention
- В релизе PerfectGym за июнь 2026 появились AI Member Chatbot, family/group accounts и referral rewards: https://support.perfectgym.com/hc/en-001/articles/47318913986961-Release-June-2026
- Perfect Score превращает посещения в видимый клиенту engagement/rank loop: https://help.perfectgym.com/hc/en-001/articles/39316233021713-How-does-Perfect-Score-work-in-the-Mobile-App
- Gymdesk объединяет automation builder, lead status, источники и referral rewards: https://docs.gymdesk.com/en/help/docs/marketing-settings
- PerfectGym формулирует наиболее полезную роль AI как усиление сотрудника по всему lifecycle, а не замену человека: https://web-back.perfectgym.com/node/694

Повторяющийся разрыв между продуктами: системы либо показывают BI, либо выполняют отдельные automation rules. Редко встречается единый управленческий цикл `сигнал → приоритет → гипотеза → ожидаемый эффект → human-approved действие → измерение`.

## Решение Growth OS

На существующих данных собран локальный schema-free прототип такого цикла:

1. `Пульс клуба` агрегирует риск, долги, посещения и динамику выручки.
2. `План на сегодня` переводит сигналы в упорядоченные действия.
3. `Revenue opportunity radar` показывает денежный пул, который можно вернуть.
4. `What-if` симулятор отделяет фактические пулы от пользовательских assumptions.
5. `Playbooks` дают готовый, но не отправленный текст для сотрудника.
6. `Growth experiments` связывают гипотезу, метрику, срок и ожидаемый диапазон эффекта.
7. `Experiment-to-playbook` соединяет идею с исполнимым сценарием.
8. `Human-in-the-loop` исключает автоматическую коммуникацию без проверки контекста.

Это не заявлено как уникальная функция всего мирового рынка без полного patent/product audit. Дифференциатор FitCRM здесь — связность ежедневного управленческого цикла и локальная Telegram/payment среда.

## Решение для текущей ветки

Реализовать `Удержание BETA` как schema-free read-only очередь на существующих данных. Это позволяет проверить ценность на localhost без миграции общей Supabase и без риска для production.

Полноценную воронку лидов вынести в отдельную задачу после согласования модели данных. Для нее нужны как минимум сущности lead, stage history, activity/next action, source, loss reason и ownership с tenant-scoped RLS.

## Позиционирование

FitCRM можно продавать как операционную систему клуба для локального рынка: ежедневные действия владельца, Telegram/Instagram-коммуникации, локальные платежи и контроль удержания в одном интерфейсе. Новый центр удержания усиливает обещание `CRM показывает не только что произошло, но и кому нужно уделить внимание сегодня`.

## Ограничения исследования

Проверены публичные продуктовые страницы, а не платные аккаунты конкурентов. Конкретная глубина функций, качество UX и тарифные ограничения требуют отдельного hands-on benchmark.

## Обновление — 2026-08-04

### Контур подписки самой CRM

Официальные материалы YCLIENTS подтверждают полезный локальный паттерн: уведомлять администратора
и сотрудника за 3 дня, за 1 день и сразу после окончания лицензии, показывать точную дату и вести
в понятный сценарий оплаты. Stripe отделяет `active`, `past_due` и `unpaid`, поддерживает
настраиваемые renewal/trial/failed-payment reminders и даёт прямую ссылку в управление подпиской.

Источники:

- https://support.yclients.com/117
- https://support.yclients.com/82-536--sposoby-oplaty-yclients-rf/
- https://docs.stripe.com/billing/subscriptions/overview
- https://docs.stripe.com/billing/revenue-recovery/customer-emails
- https://docs.stripe.com/customer-management

Для Zalkins зафиксирована модель, в которой назначенный тариф и состояние оплаченного периода —
разные сущности. В UI и доступах используются состояния `active`, `expiring`, `expired`,
`trial_*`, `unlimited` и операционный `suspended`; наличие `clubs.plan = business` само по себе
не означает активную подписку.

Принятый recovery-flow:

1. За 7 дней появляется постоянный баннер и событие в центре уведомлений.
2. Telegram владельцу отправляется один раз на рубежах 7/3/1/0 дней и после истечения, в таймзоне
   и на языке коммуникаций клуба.
3. После истечения сохраняются данные и доступны только «Подписка» и «Поддержка»; владелец может
   продлить тот же тариф, сотрудник без billing-права видит понятное объяснение.
4. Pending-заявка показывается как отдельное состояние и не маскируется под активный тариф.
5. Продление того же тарифа добавляет срок к `max(now, current_expiry)`; смена тарифа начинает
   новый срок сейчас и повторно проверяет фактические лимиты при одобрении.
6. Заявка хранит неизменяемый снимок цены, валюты, периода и скидок; администратор не может
   молча пересчитать уже согласованную сумму по новой цене.
7. Операционная приостановка клуба не снимается одобрением оплаты автоматически.

Рекомендуемое следующее продуктовое решение: отдельно согласовать grace/read-only политику.
Рабочий вариант — 3 календарных дня grace для онлайн-оплаты, до 5 рабочих дней для подтверждённого
банковского перевода, затем read-only до 30 дней без удаления данных. До утверждения Zalkins
остаётся на строгом ограничении с доступом к продлению и поддержке.

### Обновлённая матрица fitness CRM

| Направление | Zalkins сейчас | Что показывают конкуренты | Вывод |
| --- | --- | --- | --- |
| Локальный рынок | UZS, Payme/Click, RU/UZ/EN, Telegram-first | Международные продукты сильнее в card/ACH/direct debit | Главный дифференциатор Zalkins для Узбекистана |
| Операции клуба | Клиенты, абонементы, посещения/QR, оплаты, расписание, склад, сотрудники, роли, зарплаты, отчёты | Базовый parity с Mindbody/Glofox/GymMaster | Сохранять простой единый UX, не раздувать меню |
| Growth/retention | Удержание, AI Аналитика, Growth OS, human-approved playbooks | Mindbody — pipeline/automation; Glofox — journeys; PerfectGym — at-risk/predictive; Virtuagym — retention/community | Следующий рычаг — единая automation engine и измеримый health score |
| Клиентский опыт | Telegram-бот, QR, расписание и продление | Branded apps, web portals, push, community, challenges | Telegram Mini App/PWA даст большую часть ценности дешевле native white-label apps |
| Продажи | Обращения и Growth OS, но нет полноценной lead funnel | Mindbody/PushPress — capture, pipeline, forms, workflows | Нужны lead stages, owner, next action, source, loss reason и conversion analytics |
| Платежи клиентов | Наличные + Payme/Click links/callbacks | Glofox/GymMaster/Virtuagym — recurring billing и automated failed-payment recovery | Нужен member dunning/recovery после появления безопасного recurring mandate |
| Доступ | QR check-in; отдельная интеграционная основа | Glofox/GymMaster/PerfectGym — door entry, kiosks, RFID/QR, 24/7 | Приоритетные локальные интеграции СКУД, а не собственное железо |
| Экосистема | Точечные интеграции | PushPress/PerfectGym — public API, webhooks, hardware/software ecosystem | После стабилизации core — API/webhooks и партнёрский каталог |
| Coaching/community | Не является ядром CRM | Virtuagym/PushPress — workouts, nutrition, progress, community/challenges | Добавлять позже или через партнёров; не размывать операционное позиционирование |

Официальные источники матрицы:

- Mindbody: https://www.mindbodyonline.com/business/pricing
- Glofox: https://www.glofox.com/
- PushPress: https://www.pushpress.com/pricing
- GymMaster: https://www.gymmaster.com/fitness-software/
- Virtuagym: https://business.virtuagym.com/gym-software/
- PerfectGym: https://www.perfectgym.com/en/solutions/gym-management-software

### Плюсы и минусы Zalkins

Плюсы:

- сильная локализация под Узбекистан вместо адаптации западного payment stack;
- Telegram как рабочий клиентский канал, а не дополнительный дорогой модуль;
- fitness-specific операционный контур уже связан с финансами, складом и командой;
- Growth OS и удержание ведут к действию, а не только показывают BI;
- прозрачные тарифные лимиты и компактный shadcn-интерфейс.

Минусы относительно зрелых конкурентов:

- нет универсального конструктора автоматизаций и полноценной presale-воронки;
- нет массового self-service mobile/PWA опыта уровня branded member app;
- нет полноценного recurring billing/dunning для платежей клиентов клуба;
- меньше готовых СКУД, hardware и marketplace-интеграций;
- нет слоя coaching/community/challenges и публичного API/webhooks;
- качество продукта сильнее зависит от ручного локального QA: визуальный baseline и CI ещё не
  полностью автоматизированы.

### Приоритет идей

1. `P0` — завершить и наблюдать platform subscription lifecycle.
2. `P1` — universal automation engine: trigger → conditions → audience → approval → channel → result.
3. `P1` — единый retention health score с объяснением причины риска и следующим действием.
4. `P1` — Telegram Mini App/PWA для записи, оплаты, QR, прогресса и push-like сценариев.
5. `P2` — lead pipeline и booking funnel с источником и conversion analytics.
6. `P2` — member payment recovery/dunning и безопасное автопродление после provider mandate.
7. `P2` — локальные СКУД/турникеты и kiosk mode.
8. `P3` — coaching/community/challenges, public API, webhooks и marketplace.

Позиционирование остаётся прежним, но формулируется точнее: **Zalkins — операционная система
фитнес-клуба в Узбекистане: команда, клиенты, деньги, удержание и локальные каналы в одном месте.**
