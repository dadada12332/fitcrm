---
type: research
status: active
updated: 2026-08-06
tags: [zalkins, research, fitness-crm, competition, strategy, roadmap]
---

# Fitness CRM benchmark и план лидерства — 2026-08-05

## Короткий вердикт

По публично подтверждаемой ширине функций **Zalkins пока не является самым полным продуктом
рынка**. В Узбекистане наиболее опасный прямой конкурент — FitBase: у него уже заявлены
воронка, универсальные автоматизации, клиентское приложение, расчет зарплаты, лист ожидания,
лояльность, договоры, несколько складов, СКУД и широкая интеграционная сеть. На глобальном
рынке Glofox, PerfectGym, Mindbody, PushPress и другие зрелее в recurring billing, dunning,
lead automation, member experience, hardware ecosystem и API.

При этом у Zalkins уже есть не только базовая CRM. В production работают операционный контур
клуба, Payme/Click, мультиязычность RU/UZ/EN, Telegram-бот клуба, полноценная Telegram Mini App,
клиентский inbox, QR, импорт, granular permissions и мультифилиальность. Retention и Growth OS
уже формируют редкий связный цикл `сигнал → объяснение → следующее действие → исход`, хотя пока
остаются Beta/LAB и требуют калибровки.

Самый реалистичный путь к лидерству — не копировать весь Mindbody, а стать:

> **Zalkins — Revenue & Retention OS для фитнес-клубов Центральной Азии: лиды, оплаты,
> посещения, команда и Telegram-автоматизации в одном локальном продукте.**

Победа должна измеряться не числом пунктов меню, а тем, сколько дополнительной выручки Zalkins
помог клубу получить и сохранить: конверсия лидов, продления, возврат долгов, восстановленные
платежи и возвращенные участники.

## Методика и границы исследования

- Срез актуален на **5 августа 2026 года**.
- Zalkins проверен по текущему коду, миграциям и оперативной документации. Код считался
  источником истины.
- Конкуренты проверены по официальным продуктовым страницам, pricing, документации и release
  notes. Сторонние рейтинги и SEO-агрегаторы не использовались как источник функций.
- `Production` означает подтвержденный реализованный контур Zalkins; `Partial/Beta` — рабочая,
  но неполная или несертифицированная функция; `Absent` — сущности/рабочего контура в коде нет.
- Функции конкурентов — заявления самих поставщиков, а не hands-on аудит платных аккаунтов.
  Отсутствие публичного подтверждения не доказывает отсутствие функции в enterprise-тарифе.
- Скорость, удобство, надежность поддержки и реальная глубина интеграций требуют отдельного
  mystery shopping и trial benchmark.

## Что рынок 2026 года уже считает базовым продуктом

Зрелая fitness CRM закрывает не отдельные справочники, а непрерывный жизненный цикл:

`лид → пробное занятие → продажа → онбординг → запись → посещение → платеж → вовлеченность → риск оттока → возврат`

Клиенты, абонементы, расписание и отчеты необходимы, но сами по себе уже не создают лидерства.
Повторяющиеся best-in-class паттерны:

1. Lead capture, pipeline, SLA и автоматические последовательности касаний.
2. Recurring billing, smart retries, debt collection и revenue protection.
3. Самообслуживание участника: покупка, запись, QR, заморозка, уведомления и прогресс.
4. Поведенческое удержание с причиной риска и конкретным следующим действием.
5. Waitlist, no-show/late-cancel policies и эффективное заполнение расписания.
6. Omnichannel коммуникации и единая история взаимодействия.
7. СКУД, kiosk и 24/7 access через сертифицированные адаптеры.
8. Открытые API/webhooks и централизованное управление сетями.
9. Быстрый перенос данных, настройка и обучение как часть продукта.

## Фактическая карта Zalkins

| Направление | Статус | Что подтверждено | Главные ограничения |
| --- | --- | --- | --- |
| Auth и онбординг | Production core | Email/password, Google OAuth, reset, инвайты, четырехшаговый старт клуба | Нет реального SMS-провайдера, CAPTCHA и done-for-you внедрения |
| Клиенты | Production | Профиль, теги, баланс/долг, заметки, источник, тренер, абонементы, платежи, визиты, импорт/экспорт | Нет family/corporate accounts, документов и единой sales timeline |
| Лиды и продажи | **Production v1** | Отдельный Lead Hub: источники, этапы, owner, SLA, next action, trial, loss reason, timeline и атомарная конвертация в клиента | Нет автоматического захвата из форм/каналов, automation sequence, Kanban и глубокой аналитики по менеджеру/источнику |
| Абонементы | Production core | CRUD, архив, лимит визитов, заморозка, продажа и продление через атомарные RPC | Ограничения по дням/часам отображаются, но не применяются при проходе; нет рассрочки и договора |
| Посещения | Production | Ручной, быстрый и динамический QR check-in, защита от replay и списание визитов | Kiosk и сертифицированный hardware flow не завершены |
| Расписание | Partial/Beta | День/неделя/месяц, залы, вместимость, тренеры, запись/отмена, отметка посещения, Mini App booking | Нет зрелых серий, waitlist, availability, ресурсов, no-show fees и постоянной двусторонней синхронизации |
| Платежи участника | Production ledger / online partial | Ручные оплаты, KPI, CSV, ссылки/QR, Payme/Click callbacks и reconciliation | Нет recurring mandate, retries/dunning, refunds, installments и фискализации; сертификация провайдеров не подтверждена |
| Склад и POS | Production core | Товары, SKU/штрихкод, поставка, списание, low stock, движения, POS и связь продажи с клиентом | Нет поставщиков, purchase orders, инвентаризаций, партий/сроков и межфилиальных перемещений |
| Сотрудники и роли | Production | Инвайты, статусы, кастомные роли, permission matrix и DB-защита от эскалации | Нет общего staff app и табеля |
| Зарплата | Partial/Beta | Fixed/percent/mixed настройки и ручная история выплат | Нет автоматического расчета комиссий, смен, занятий и payroll; часть performance-метрик пока нулевая |
| Dashboard и отчеты | Production operational BI | KPI, выручка, посещения, долги, продажи, сотрудники, XLSX | PDF — печать HTML; forecast — run-rate + LLM-текст, не predictive ML; нет сетевых benchmarks |
| Retention | Partial/Beta | Детерминированный risk score, кейсы, касания, outcomes, follow-up и Telegram outreach | Пороги — продуктовые гипотезы, не обученная churn-модель; нет калибровки на cohort data |
| Growth OS | Partial/LAB | Пульс, opportunity radar, what-if, playbooks и lifecycle экспериментов | Нет автоаудиторий, randomization и автоматического causal measurement |
| AI Аналитика | Production read-only | Gemini и детерминированные permission-scoped инструменты над данными клуба | Не автономный агент и не predictive ML; не выполняет workflow после подтверждения |
| Telegram-бот | Production, сильная сторона | Собственный бот клуба, pairing, команды, QR, расписание, рассылки, напоминания, отчет владельцу | Один основной канал; нет полноценной омниканальности |
| Telegram Mini App | Production | Абонемент, визиты, расписание, запись/отмена, QR, Payme/Click renewal, preferences, support и read-only staff workspace | Нет standalone PWA/native/white-label, push, прогресса, workouts и community |
| Inbox | Production Telegram | Диалоги, приоритет, статус, assignee, шаблоны и retry | Нет WhatsApp, Instagram DM, email и SMS в одном inbox |
| Интеграции | Partial | Telegram, Payme/Click, Google Calendar Beta, Instagram foundation, access-control bridge | Нет public API/outbound webhooks; Instagram App Review и постоянный Calendar sync не подтверждены |
| СКУД | Partial/Beta | Bridge/API для Sigur, ZKTeco и Hikvision, heartbeat, anti-passback, credentials и журнал | Не проверено на реальном железе; turnkey/certified интеграцией пока называть нельзя |
| Филиалы | Production core / HQ partial | Создание, квоты и переключение отдельных tenant-клубов | Нет HQ analytics, общих каталогов/штата, сетевых шаблонов и переноса клиента между филиалами |
| Импорт/экспорт | Production client migration | CSV/XLSX до 15 000 строк, mapping, dedupe и операционные экспорты | Нет полного tenant backup/restore и прямых миграторов из других CRM |
| Автоматизация | Partial/Beta | Фиксированные expiry/class reminders, daily report, broadcasts, reconciliation и SaaS renewal reminders | Нет универсального `trigger → conditions → delay → action → outcome` builder |
| Public API | **Absent** | Только integration-specific входящие endpoints и cron | Нет tenant API keys/OAuth, outbound webhooks, SDK и marketplace |

Ключевые источники в коде: `src/app/(app)`, `src/components/telegram/TelegramMiniApp.tsx`,
`src/lib/retention.ts`, `src/lib/growth.ts`, `src/lib/telegram/bot.ts`,
`src/lib/access-control`, `src/lib/import-wizard.ts`, `src/lib/plans.ts` и
`supabase/migrations/0076_align_plan_entitlements.sql`.

## Прямые и региональные конкуренты

| Продукт | Публично подтвержденная сильная сторона | Что это значит для Zalkins |
| --- | --- | --- |
| **FitBase Uzbekistan** | Наиболее широкий локальный набор: CRM-воронка, задачи, automation, booking/waitlist, payroll, loyalty, branded member app, договоры, несколько складов, СКУД, 1С, сайт/виджеты и onboarding | Главный прямой benchmark. По ширине table stakes FitBase сегодня впереди; Zalkins должен выигрывать в measurable revenue workflow, локальном AI и простоте, одновременно закрывая критические пробелы |
| **UZFIT** | Локальная CRM + member app; заявляет полный перенос, настройку и запуск за 1–2 рабочих дня | Даже небольшой продукт конкурирует сервисом внедрения. Self-serve import без сопровождения недостаточен для части локального рынка |
| **LuckyFit** | Lead funnel, задачи, клиентское и staff apps, access control/Face ID, гибкие абонементы, зарплата, склад/POS и сайт | Показывает, что app + sales + hardware уже не enterprise-экзотика; публичные заявления о поддержке любого оборудования требуют hands-on проверки |
| **Mobifitness** | Триггеры, автоматические действия и воронки, loyalty/bonus, web widgets, online payments и приложения iOS/Android/Huawei | Универсальная automation engine и member-facing слой становятся региональным стандартом |
| **1С/БИТ.Фитнес** | Глубокий CRM/back-office: воронка, расписание, зарплата/KPI, склад, бухгалтерия, СКУД и персональные кабинеты | Силен для крупных и бухгалтерски сложных объектов. Zalkins не должен копировать тяжесть 1С, но нужны экспорт/интеграция с учетом и реальный payroll |
| **Umai CRM** | Канбан лидов, WhatsApp/Telegram/Instagram, Kaspi, телефония, AI-анализ разговоров и локальная экосистема | Не fitness-first, но задает хороший benchmark омниканальности, локальных платежей и AI quality control для отдела продаж |
| **YCLIENTS** | Онлайн-запись, абонементы, уведомления, онлайн-платежи и mobile staff flow для спортивных школ | Сильный adjacent competitor для студий и секций; узкая простота иногда важнее глубины gym ERP |

### Наблюдение по региону

Локализация, приложение и Payme/Click уже нельзя считать достаточным уникальным преимуществом:
FitBase также публично заявляет локальные карты/эквайринг, UZS, RU/UZ/EN и клиентское
приложение. Выигрышная разница Zalkins должна быть в доказуемом результате: система сама находит
утечку выручки, предлагает действие, безопасно выполняет его после подтверждения и измеряет исход.

## Международный benchmark

| Продукт | Где особенно силен | Идея, которую стоит перенять |
| --- | --- | --- |
| **Mindbody** | Marketplace, booking, payments, staff, marketing, 100+ integrations, AI Concierge | AI receptionist для пропущенных звонков/сообщений и сетевой acquisition channel — позже, после core revenue loop |
| **ABC Glofox** | Full-lifecycle CRM, behavior workflows, recurring billing/dunning, branded app, access/kiosk и сети | Единая lifecycle-модель участника и payment recovery должны стать фундаментом, а не отдельными отчетами |
| **PushPress** | Прозрачные планы, apps, waitlist/no-show, workout/rank, Member Intel и AI Assistant | `Coach brief` перед занятием: новые лица, дни рождения, milestone, риск и важная заметка |
| **GymMaster** | Нативный 24/7 access, readers/key fobs, tailgating, staff timesheets и multi-site | Сертифицированный access gateway с fail-closed политикой и журналом, без собственного железа |
| **Virtuagym** | Workout/nutrition, wearables, progress, community/challenges и AI Coach | Легкий progress/challenge слой после доказанной активности Mini App; полный coaching suite сейчас распылит фокус |
| **PerfectGym** | Enterprise multi-country, predictive retention, automation, loyalty, AI chatbot и Open API/webhooks | Explainable health score + open ecosystem + HQ templates, но без enterprise feature bloat |
| **Gymdesk** | Простая all-inclusive цена, visual automation, leads, failed-payment recovery, payroll export | Автоматизации и recovery могут быть понятными SMB, без дорогой россыпи обязательных add-on |
| **Zen Planner** | Lead/engagement automations, absentee/milestones, community и расчет payroll | Готовые playbooks и нишевые шаблоны по типу клуба вместо пустого конструктора |
| **Mariana Tek** | Boutique scheduling, smart waitlists, intro-offer optimization, cross-location benchmarks и APIs | Оптимизация пробного предложения и анонимные benchmarks по похожим клубам — потенциальный data moat |

## Сводная матрица: где Zalkins впереди, на уровне и позади

| Возможность | Zalkins сейчас | Лучший региональный benchmark | Лучший глобальный benchmark | Вердикт |
| --- | --- | --- | --- | --- |
| Core CRM, абонементы, визиты | Сильный production core | FitBase, LuckyFit, 1С | Практически все | **Паритет по ядру**, глубину family/contracts нужно усилить |
| Лиды и sales pipeline | Production v1: очередь, SLA, задачи, trial, loss/conversion | FitBase, LuckyFit, Umai | Glofox, PushPress, Mindbody | **Core gap закрыт**, дальше нужны автоматический capture, sequences и funnel analytics |
| Расписание и booking | Работает, но partial | FitBase/LuckyFit: waitlist/resources | PushPress/Mariana: waitlist, no-show, priority | **Отставание по глубине** |
| Member self-service | Сильная Telegram Mini App | FitBase/UZFIT/LuckyFit native apps | Glofox/PushPress/Virtuagym | **Сильный локальный формат**, но нет push/white-label/progress |
| Разовые online payments | Payme/Click links/callbacks | FitBase local acquiring | Все зрелые platforms | **Локальный паритет после сертификации** |
| Recurring billing/dunning | Нет | FitBase заявляет recurring/auto-renewal | Glofox/Gymdesk/PushPress | **Критический пробел выручки** |
| Retention и Next Best Action | Beta, но связный action loop | FitBase LTV/churn/forecast | PerfectGym/Glofox/Mariana | **Потенциальный дифференциатор**, пока не доказан данными |
| Универсальные automation journeys | Только фиксированные сценарии | FitBase/Mobifitness | Glofox/Gymdesk/Zen | **Критический пробел** |
| Telegram-first | Bot + Mini App + inbox + owner report | FitBase имеет Telegram analytics/messaging | Telegram редко является ядром global CRM | **Сильная комбинация**, но не абсолютная уникальность |
| Omnichannel inbox | Только Telegram | Umai/FitBase messenger integrations | Mindbody/Glofox/PushPress | **Отставание** |
| СКУД/24×7 | Техническая Beta-основа | FitBase/LuckyFit/1С integrations | GymMaster/PerfectGym | **Нужно сертифицировать и внедрить на железе** |
| Staff/payroll | Роли сильные; payroll partial | FitBase/LuckyFit/1С | Glofox/Gymdesk/Zen | **Отставание в расчете и staff workflow** |
| Склад/POS | Хороший single-warehouse core | FitBase/LuckyFit/1С глубже | Не у всех является ядром | **Близко к паритету SMB**, gaps в supply chain |
| Отчеты/AI | Operational BI + read-only AI | FitBase analytics/Telegram bot | PushPress AI, PerfectGym predictive | **Сильная база**, не хватает funnel/HQ/causal ROI |
| Филиалы/HQ | Раздельные tenants + switcher | FitBase/1С сети | PerfectGym/Glofox/Mariana | **Мультифилиальность есть, HQ нет** |
| API/webhooks/ecosystem | Нет публичного контура | FitBase open API на старших планах | PerfectGym/Mariana/PushPress | **Критический стратегический пробел** |
| Coaching/community | Нет | Отдельные regional apps частично | Virtuagym/PushPress/Zen | **Осознанный поздний gap**, не P0 |
| Миграция и внедрение | Сильный import wizard | UZFIT 1–2 дня; FitBase assisted migration | Glofox/PushPress assisted onboarding | **Нужен продукт + сервис запуска** |
| Надежность и recovery | Сильная app/security работа, но нет Sentry/staging/restore proof | Публичных данных мало | Glofox заявляет SLA/reliability | **Нельзя называться лидером без operational trust** |

## Что у Zalkins уже лучше или встречается реже

Это не утверждение, что ни у одного конкурента нет отдельных элементов. Преимущество — в их
сочетании и возможности сделать его глубже именно для региона.

1. **Telegram — часть продукта, а не ссылка на чат:** свой бот клуба, Mini App, QR, booking,
   renewal, support inbox, staff pairing, рассылки и ежедневный owner report.
2. **Локальный стек в одной модели:** UZS, RU/UZ/EN, Payme/Click и часовой пояс клуба связаны с
   операциями, коммуникациями и отчетами.
3. **Action-oriented retention:** Retention и Growth OS уже стремятся привести сотрудника от
   риска к действию и outcome, а не только показать красный график.
4. **Human-in-the-loop AI:** архитектурно безопаснее строить AI, который подготавливает действие
   и требует подтверждения, чем непрозрачного автономного рассыльщика.
5. **Проверяемая модель прав:** granular permissions, tenant scope и защита Server Actions/DB
   являются реальной технической силой продукта, хотя это не должно превращаться в маркетинговое
   заявление о превосходстве без внешнего аудита конкурентов.
6. **Компактный единый продукт:** core, retention, AI, склад и Telegram не разбросаны по дорогим
   обязательным add-on. Это преимущество нужно сохранить в тарифах.

## Что есть у других и пока отсутствует у Zalkins

1. Полноценный `lead → trial → paid` pipeline и conversion analytics.
2. Универсальный automation builder с conditions, delays, channels и outcome tracking.
3. Recurring member billing, smart retries, dunning, refunds, installments и promise-to-pay.
4. Waitlists, priority booking, trainer availability, resources, no-show/late-cancel rules.
5. Family/corporate accounts, waivers/contracts, gifting и referral rewards.
6. Реальный автоматический payroll, shifts, timesheets, commissions и бухгалтерский экспорт.
7. WhatsApp/Instagram DM/email/SMS inbox и AI-анализ качества диалогов.
8. Сертифицированные hardware integrations, kiosk и 24/7 access.
9. Public API, outbound webhooks, Zapier/Make connectors и партнерский каталог.
10. HQ analytics, сетевые шаблоны и операции между филиалами.
11. Native/white-label member apps, push, workouts, progress, challenges и community.
12. Assisted migration, настройка, обучение и go-live SLA как упакованная услуга.

## Выигрышная продуктовая ставка

### Рекомендуемый ICP

Гипотеза для проверки интервью: независимые фитнес-клубы и студии Центральной Азии с 200–5 000
активных клиентов и сети до 10 филиалов, где владелец хочет контролировать выручку, а команда и
клиенты уже привыкли к Telegram и локальным платежам.

### North Star

**Дополнительная подтвержденная выручка, сохраненная или возвращенная Zalkins на активный клуб
за месяц.** В нее входят:

- лиды, конвертированные через Zalkins;
- продления после своевременного действия;
- возвращенные просроченные/неуспешные платежи;
- win-back клиентов после периода отсутствия;
- заполненные места из waitlist.

Guardrails: число жалоб/отписок, ошибки платежей, ручное время команды, удержание клубов Zalkins
и отсутствие коммуникаций без согласования/прав.

### Главный продуктовый экран

Развить существующие Retention и Growth OS в **Revenue Command Center**:

`сигнал → денежный потенциал → причина → ответственный → срок → предложенное действие → подтверждение → канал → результат`

В одной очереди должны появляться новые/просроченные лиды, истекающие абонементы, failed
payments, no-show, снижение посещаемости и win-back. Тогда Zalkins продает не CRM-модули, а
ежедневный управленческий результат.

## Приоритетный roadmap

### P0 — доверие и честная основа, 0–6 недель

1. Исправить маркетинговые обещания, которые шире production-факта.
2. Довести error monitoring, production-like staging, регулярный backup и проверенный restore.
3. Завершить provider-certified Payme/Click сценарии, reconciliation и observability.
4. Ввести единую product event taxonomy и outcome ledger для лидов, платежей, automation и
   retention. Без этого невозможно честно доказать ROI.
5. Упаковать assisted migration: импорт, проверка, настройка, обучение и запуск за один рабочий
   день для стандартного клуба.

### P1 — закрыть разрывы выручки, 0–3 месяца

1. **Lead Hub v1 — реализован 2026-08-06:** источник, этап, owner, SLA, next action, timeline,
   loss reason, trial и безопасная conversion. Следующий слой — capture из каналов,
   automation sequences и conversion analytics по менеджеру/источнику.
2. **Automation Studio v1:** общий event/outbox engine и готовые сценарии `new lead`, `trial`,
   `expiry`, `no-show`, `7/14 дней без визита`, `birthday`, `debt`, `win-back`.
3. **Booking completion:** повторяющиеся серии, waitlist, auto-fill, availability, no-show и
   cancellation policy.
4. **Telegram Mini App 2.0:** управляемая заморозка, долг/история оплат, waitlist, family profile,
   referral link и понятный progress. Не строить второй кабинет с нуля.
5. **Unified member timeline:** лид, договор, сообщения, задачи, платежи, визиты, health score и
   support в одной истории.

### P1 — защитить повторную выручку, 3–6 месяцев

1. **Member Billing Engine:** overdue ledger, refunds, installments, обещание оплаты и dunning.
2. Recurring mandate/автосписание только после подтвержденного API и юридической модели
   провайдера; smart retries не симулировать поверх разовых ссылок.
3. **Omnichannel Inbox:** сначала WhatsApp и Instagram DM, затем SMS/email; единый consent,
   templates, SLA и attribution.
4. **Payroll v1:** занятие/смена/продажа → ставка/процент → проверка → выплата → экспорт.
5. Довести Instagram, Google Calendar и первый СКУД-адаптер до проверенного production case.

### P2 — создать moat, 6–12 месяцев

1. **Explainable Health Score:** причины риска, confidence, recommended action и измеренный
   outcome. ML добавлять только после накопления качественных labels.
2. **Action AI copilot:** запрос на естественном языке создает аудиторию/задачу/кампанию, но
   показывает diff, права, стоимость и требует подтверждения отправки.
3. **HQ for networks:** сводная аналитика, общие роли/тарифы/automation templates, сравнение
   филиалов и безопасный transfer клиента.
4. **Public API + outbound webhooks:** стабильные events, tenant keys/OAuth, audit, rate limits и
   партнерские adapters.
5. **Anonymous club benchmarks:** сравнение конверсии, продлений, посещаемости и загрузки только
   по агрегированным группам с достаточной анонимностью.
6. **Local integration gateway:** Payme/Click/Uzum при реальном API, кассы, бухгалтерия и
   сертифицированные СКУД через adapter layer.

### P3 — расширение после доказанной активности

- Challenges, streaks, achievements, referrals и gifting.
- Workout/progress light и партнерские coaching integrations.
- White-label/native app только если Mini App/PWA retention докажет спрос, который нельзя
  закрыть Telegram и web push.
- Marketplace/acquisition network только после достаточного числа активных клубов и участников.

## Крутые идеи из benchmark, адаптированные для Zalkins

1. **Member Intel / «Бриф тренера»:** за час до занятия тренер получает новых участников,
   дни рождения, milestone, ограничения, долг и клиента с риском ухода.
2. **Smart waitlist fill:** освободилось место — система по очереди предлагает его в Telegram,
   фиксирует таймер ответа и автоматически передает следующему.
3. **AI Concierge:** отвечает на типовые вопросы и записывает на пробное занятие 24/7, а сложные
   и коммерчески важные диалоги передает человеку.
4. **Intro-offer optimizer:** показывает, какое пробное предложение и follow-up дают лучшую
   конверсию по каналу и филиалу.
5. **Conversation quality:** AI отмечает пропущенный вопрос, грубость, отсутствие следующего шага
   и просроченный ответ в Telegram/WhatsApp, но не штрафует сотрудника без human review.
6. **Family/corporate wallet:** родитель/компания управляет несколькими участниками, лимитами,
   документами и общей оплатой — особенно полезно секциям и корпоративным клиентам.
7. **Promise-to-pay:** клиент выбирает дату погашения долга; система перестраивает напоминания и
   показывает администратору нарушенное обещание.
8. **Owner weekly ROI:** не «отправлено 400 сообщений», а «12 продлений, 4 возвращенных долга и
   3 клиента win-back; подтвержденная сумма — X UZS».

## Что не стоит копировать сейчас

- Нативные white-label приложения для каждого клуба до доказанного спроса.
- Собственное железо и жесткую привязку к одному контроллеру или платежному провайдеру.
- Полный nutrition/workout/community suite до закрытия lead и revenue gaps.
- Непрозрачный churn score без причин, confidence и следующего действия.
- Еще больше графиков без owner, SLA, CTA и измеряемого результата.
- Дорогую россыпь обязательных add-on: сохранять понятные пакеты и продавать outcome.
- Enterprise feature bloat до появления реальных сетевых клиентов с подтвержденными задачами.

## Маркетинговые несоответствия, которые нужно закрыть до заявления «лучшие на рынке»

1. WhatsApp «из коробки» пока является только `wa.me`-ссылками, а не интеграцией/inbox.
2. Подтвержденных managed daily backups и проверенного restore пока нет.
3. «Журнал всех действий» шире существующего точечного audit trail.
4. Uzum присутствует в визуальном каталоге, но реального online gateway нет.
5. `договор.pdf` в макете клиента не опирается на отдельный document-модуль.
6. «Полная зарплата» — сейчас настройки и ручной журнал, не payroll engine.
7. Ограничения абонемента по дням/часам пока не проверяются при check-in.
8. Payme/Click нельзя называть recurring billing или сертифицированным автосписанием.
9. Public API, white label, SMS, email и push явно выключены в entitlement matrix.
10. Статический текст «все системы работают» не заменяет публичную status page.

Это не только вопрос копирайта. Честный статус `Production / Beta / Planned` повышает доверие и
дает сильнее позиционировать то, что действительно уже работает.

## Как проверить стратегию, а не поверить презентациям

1. Провести 15–20 problem interviews: владельцы, администраторы, тренеры и 2–3 сети.
2. Собрать win/loss интервью у клубов, которые выбирали FitBase, UZFIT, 1С или Excel.
3. Купить/получить trial ключевых конкурентов и пройти одинаковый сценарий:
   `импорт → лид → пробное → продажа → запись → платеж → no-show → долг → возврат`.
4. Сделать mystery shopping onboarding/support и зафиксировать время до первого рабочего дня.
5. До разработки каждой крупной функции зафиксировать baseline и ожидаемую бизнес-метрику;
   после запуска — cohort comparison, а не только клики.

## Официальные источники

### Узбекистан и регион

- FitBase capabilities: https://fitbase.uz/capabilities
- FitBase pricing: https://fitbase.uz/price
- FitBase member app: https://fitbase.uz/app
- FitBase PRO: https://fitbase.uz/pro
- UZFIT CRM: https://uzfit.uz/crm
- LuckyFit: https://lucky-fit.com/ru/
- Mobifitness commercial offer 2026: https://mobifitness.ru/upload/uf/76b/lahnpy3f06p3zokb2sx0a6ht2tym2qdk/KP-2026.pdf
- 1С:Фитнес-клуб / 1C BIT Kazakhstan: https://www.1cbit.kz/1csoft/1s-fitnesklub/
- Umai CRM: https://www.umaicrm.kz/
- Umai integrations: https://www.umaicrm.kz/integrations.php
- YCLIENTS sports schools: https://www.yclients.com/sport_school

### Международные продукты

- Mindbody pricing: https://www.mindbodyonline.com/business/pricing
- Mindbody product updates: https://www.mindbodyonline.com/business/product-updates
- ABC Glofox plans: https://www.glofox.com/plans/
- PushPress pricing and feature matrix: https://www.pushpress.com/pricing
- GymMaster platform: https://www.gymmaster.com/fitness-software/
- GymMaster multi-location: https://www.gymmaster.com/multi-location-gym-software/
- Virtuagym gym platform: https://business.virtuagym.com/gym-software/
- Virtuagym membership automation: https://business.virtuagym.com/membership-management-software/
- PerfectGym platform: https://www.perfectgym.com/en/solutions/gym-management-software
- PerfectGym automation documentation: https://help.perfectgym.com/hc/en-001/articles/39315829095953-Automation-Introduction
- PerfectGym June 2026 release: https://support.perfectgym.com/hc/en-001/articles/47318913986961-Release-June-2026
- PerfectGym Open API: https://presentation.perfectgym.com/Api/Docs/ApiReference/Index.html
- Gymdesk platform and pricing: https://gymdesk.com/ and https://gymdesk.com/pricing
- Zen Planner pricing: https://zenplanner.com/pricing-tiers/
- Zen Planner product: https://zenplanner.com/product/
- Mariana Tek features: https://www.marianatek.com/features/
- Mariana Tek API overview: https://guides.marianatek.com/api-overview

## Связанные материалы

- [[Research/Competitive CRM research 2026-07-19]]
- [[02 Current State]]
- [[03 Current Task]]
