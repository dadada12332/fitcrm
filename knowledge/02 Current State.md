---
type: current-state
status: active
updated: 2026-08-04
tags: [zalkins, operations]
---

# Current State

## Git и runtime

<!-- AUTO:START repository-state -->
- Версия package: `0.1.0`.
- Branch: `main`.
- Последний commit: 0551fa5 · 2026-08-04T18:18:27+05:00 · fix: harden subscription renewal lifecycle.
- Working tree: есть незакоммиченные изменения.
- Миграции в Git: 111; последняя `20260804110824_platform_billing_renewal_contract.sql`.
- Последний production deploy: нет доступных подтверждённых данных.
<!-- AUTO:END repository-state -->

## Готовность модулей

Публичный бренд продукта — **Zalkins**. Во всех пользовательских поверхностях используется
единый строчный wordmark `zalkins` без отдельной эмблемы; синяя наклонная точка над `i` служит
единственным цветным акцентом. В favicon и свёрнутом сайдбаре остаётся компактная строчная `z`.
Исторические lowercase технические идентификаторы `fitcrm`, текущий Vercel alias и
интеграционные контракты сохранены для совместимости и не являются видимым названием продукта.

**Работают:** auth и onboarding, dashboard, клиенты, абонементы, посещения, расписание, оплаты, склад, сотрудники, отчёты, настройки, Telegram, Payme/Click, поддержка и полный операционный контур Platform Admin. Platform разделяет `platform_admin` и `super_admin`, управляет доступом команды, тарифами, подписками, промокодами, внутренними CRM-уведомлениями владельцам и регистрацией; legacy-системная плашка удалена, а новости и технические работы доставляются только через центр уведомлений CRM. Мониторинг хранит service checks/Cron history, а аналитика — ежедневные исторические снимки. В существующем разделе интеграций добавлен Beta cloud-контур контроля доступа Sigur, ZKTeco и Hikvision: настройки локального Bridge, привязки карт/браслетов, online decision, журнал, симулятор и атомарное создание посещений. Google Calendar имеет server-side OAuth и управляемый workspace: сотрудник видит календарь/заметки, создаёт события и вручную переносит только выбранные посещения; OAuth credentials, callback и Calendar API настроены в Google Cloud/Vercel. Склад поддерживает создание товара, поставку, списание, продажу и мягкое удаление из строки с сохранением истории; остаток и движение записываются атомарно. Тарифы из Platform Admin реально управляют разделами, функциями и 10 рабочими лимитами CRM; UI, Server Actions и Telegram cron используют одну матрицу Trial/Starter/Standard/Business. При достижении лимита CRM сохраняет данные, блокирует только новую операцию и предлагает следующий подходящий тариф с актуальной ценой. Импорт клиентов принимает CSV/XLSX с гибким mapping и сохраняет неподдержанные поля; CSV/XLSX-экспорты CRM унифицированы, защищены от formula injection и проверены на кириллице. Настройки клуба, финансов, Telegram-уведомлений, интеграций, безопасности, подписки, ролей, филиалов и сотрудников повторно проверены в production. Telegram templates имеют сценарный редактор с live preview, контекстными переменными и двойной валидацией; automation toggles и тексты сохраняются из одного состояния. Брендинг Telegram-бота позволяет установить, заменить и удалить аватар из CRM с серверным приведением к требованиям Bot API. Telegram Mini App и CRM имеют отдельный tenant-scoped inbox клиентских обращений с ответами, ответственными, статусами, шаблонами и retry доставки. Beta-раздел удержания и Growth OS выпущены в production и проверены на синтетическом QA-клубе; Growth-эксперименты сохраняют club-scoped lifecycle и результаты.

Platform Admin объединяет публичные промокоды и адресные компенсации в одном разделе.
Бесплатные дни сразу продлевают срок выбранных клубов, а процентная компенсация автоматически
уменьшает следующую заявку на тариф и погашается атомарно при её подтверждении. Компенсации
видны владельцу в подписке и сопровождаются внутренним CRM-уведомлением.

Новый lifecycle подписки опубликован и проверен в production. Назначенный план и состояние
оплаченного периода разделены: истёкший Business остаётся видимым как
истёкший, получает явное продление того же тарифа и не маскируется статусом «текущий». За 7 дней
CRM показывает постоянный баннер; рубежи 7/3/1/0 дней и overdue обрабатывает идемпотентный Cron
с CRM- и Telegram-уведомлениями. После окончания доступен recovery-контур «Подписка» +
«Поддержка», а данные клуба не удаляются. Pending-заявка имеет отдельное состояние и хранит
неизменяемый коммерческий снимок. Подробный flow и локальные screenshots: [[UX/Subscription Renewal Audit 2026-08-04]].

Основные настройки клуба сохраняются с подтверждением обновлённой строки и служат единым
источником валюты, часового пояса, контактов и рабочих часов. Telegram-приветствие и контакты
читают тот же профиль. Глобальный переключатель RU/UZ/EN хранит язык на сотруднике и
применяется ко всей CRM: shell, бизнес-модулям, таблицам, динамическим drawer/dialog,
уведомлениям, датам и accessibility labels. Неизвестные пользовательские данные не переводятся;
язык клиентских Telegram-сообщений остаётся отдельной настройкой клуба.

Telegram роли используют разные точки входа: клиенту после подтверждения номера доступен Mini App,
а владелец и сотрудники связывают профиль одноразовой ссылкой из CRM без телефона и получают
рабочее inline-меню. Ежедневная финансово-операционная сводка считается по локальному дню и
валюте клуба, идемпотентно отправляется только активному owner того же tenant.

Dashboard использует общий вертикальный паттерн заголовка и фильтров периода в карточке выручки.
Глобальные интерактивные элементы теперь явно показывают pointer-курсор, а disabled-состояния —
`not-allowed`; поведение проверено на sidebar, быстрых действиях, ссылках и кнопках дашборда.
Desktop login использует облачный split-screen: слева маркетинговый текст и два крупных прозрачных
отзыва без карточечной подложки,
справа сохранённая стеклянная auth-карточка с увеличенным контекстом рабочего пространства
непосредственно над формой, а также увеличенными блоками безопасности и поддержки.

Публичный юридический контур включает оферту, privacy, Cookie Policy, согласие пользователя и
поручение на обработку данных клуба. Регистрация фиксирует версию и дату согласия в Supabase Auth
metadata. Документы остаются предварительными до подстановки полных реквизитов Исполнителя,
проверки механизма трансграничного хранения и заключения узбекского юриста.

FitCRM Bridge контроля доступа теперь поставляется готовым ZIP для Windows, Linux systemd и Docker. CRM выдаёт персональный конфиг и одноразовый ключ; адаптеры Sigur/ZKTeco/Hikvision используют durable queue, provider checkpoints, health/doctor и fail-closed обработку. Аппаратное реле по-прежнему выключено до commissioning конкретного контроллера.

**Частично:** занятия/бронирования и audit trail UI. Telegram automation работает для expiry/class reminders, broadcasts, QR и self-service renewal; recurring auto-charge требует отдельного provider API. AI-аналитика работает как read-only operational workspace с детерминированными KPI и LLM для свободных запросов.

**Не завершено или не подтверждено:** custom SMTP и реальные SMS, системный мониторинг ошибок, проверенный restore, staging-среда и provider-certified Payme/Click flow. Массовый запуск имеет статус NO-GO; controlled beta — GO. См. [[Reports/Launch Readiness 2026-07-20]].

## База данных

- В репозитории последовательные миграции `0001`–`0094` и отдельные timestamped миграции;
  `0087`–`0094` реализуют роли Platform, промокоды, внутренние CRM-уведомления, monitoring
  history, operational settings, ежедневные SaaS-метрики и покрывающие FK-индексы.
- `20260729054204_platform_club_compensations.sql` добавляет service-only адресные компенсации,
  мгновенное продление днями и атомарное погашение скидки при подтверждении биллинга.
- Миграции `20260804103933_platform_billing_renewal_hardening.sql` и
  `20260804110824_platform_billing_renewal_contract.sql` применены в production в порядке
  expand с временной заморозкой approval → совместимый app deployment `READY` → contract.
  Contract снял freeze и включил авторитетные DB lifecycle/quote/capacity gates; повторно
  применять expand после contract нельзя.
- Bot tokens вынесены из публично читаемой `clubs` в service-only `telegram_integrations`; открытых `clubs.tg_token` в production — `0`.
- Supabase Cron обрабатывает scheduled broadcasts каждые 5 минут; Vercel daily cron отвечает за reminders/report.
- Supabase Cron каждые 10 минут повторяет pending/failed ответы клиентского inbox; сообщения остаются сохранёнными даже при временной недоступности Telegram.

См. [[Database/Database State]].

## Окружения

См. [[Infrastructure/Environment Matrix]]. Vercel `syd1` и Supabase `ap-southeast-2` подтверждены как Sydney-регионы. Внутренние CRM-уведомления Platform опубликованы в deployment `dpl_BjphKBXRiwTp5aQf6gTJnRhiqHFp` для commit `7c3a1b4`; alias `fitcrm-three.vercel.app`, HTTP smoke, runtime error scan и end-to-end delivery/read QA подтверждены. Полная локализация CRM ранее опубликована в deployment `dpl_H4E9ZW9JoWAb6Xh33Q2aPm9Qz7Ho`. Юридические маршруты и `/register` ранее прошли HTTP smoke. Google Calendar workspace и переход к Google account chooser проверены в production без browser/server errors. Тарифная блокировка и upgrade dialog проверены на production mobile flow без overflow и browser errors. Актуализированный FAQ доступен на домене; Telegram KPI redesign, bot avatar release и binary preview repair также доступны в production. Template editor, импорт/экспорт и settings tabs ранее прошли production gate. Клиентский inbox проверен на localhost desktop/mobile и production delivery через реального клубного бота; `/growth` ранее проверен в синтетическом QA-клубе. Renewal lifecycle опубликован commit `0551fa5` в production deployment `dpl_DS1d4bbectKbM2hrWJNWDEDQqHpr`; основной alias, обе миграции, DB contract probes, expired/pending/approve recovery-flow, desktop/mobile overflow и Vercel error scan подтверждены.

## Риски и долг

- Warm Supabase health-check составляет 55–167 ms, но зафиксирован cold sample 1162 ms; требуется наблюдение за cold path.
- Основные CRM-таблицы используют tenant-scoped гранулярные RLS permissions; Server Actions
  сохраняют обязательную дополнительную проверку прав. Service-only контуры всё ещё требуют
  явного `club_id` scope при каждом запросе.
- Зарплаты и salary history, клиентские balance/debt, закупочные цены и финансовые aggregate RPC
  недоступны роли `authenticated` напрямую; разрешённые server-side чтения проходят через
  permission-check и tenant-scoped service query.
- Прямые Data API mutation для subscriptions/payments/staff закрыты; приглашения сотрудников
  service-only, а check-in и продажа абонемента защищены атомарными RPC и серверной ценой.
- `npm audit --omit=dev` фиксирует 5 high, 6 moderate и 2 low advisory в основном в транзитивных зависимостях Next/shadcn/ExcelJS; предлагаемый автоматический fix требует несовместимых major-изменений и не применён без отдельной проверки.
- В коде остаётся lint-долг (`any`, unused vars, impure `Date.now()`).
- Пороги retention scoring пока являются детерминированными продуктовыми гипотезами и требуют калибровки на обезличенной статистике после проверки владельцем.
- Growth health score, recovery rates и expected impact являются прозрачными сценарными assumptions, а не ML-прогнозом или обещанием результата.
- На диске `E:` Next.js/Playwright зафиксировал slow filesystem benchmark 288 ms; функциональные тесты прошли, но dev feedback loop может быть медленнее.
- Нет автоматического CI, error monitoring и production-like staging.
- Telegram reminder delivery имеет остаточную Low-вероятность повторной отправки: если Telegram
  уже принял сообщение, а фиксация результата в БД завершилась ошибкой, lease может быть
  подобран повторно. Текущая семантика at-least-once приемлема; для строгого exactly-once нужен
  отдельный outbox/статус `delivery_unknown`.
- Supabase Free не даёт managed daily backups и leaked-password protection; custom SMTP/CAPTCHA не настроены.
- Full ESLint baseline: 122 errors и 45 warnings; TypeScript, build и runtime tests проходят.
- Sigur/ZKTeco/Hikvision не проверены на реальном контроллере: автоматическое открытие нельзя включать до vendor-specific contract-теста; cloud-контур явно помечен Beta.
- Google Calendar OAuth опубликован без verification: controlled beta работает, но до проверки Google
  действует user cap 100 и может показываться экран «непроверенное приложение».
- Юридические страницы не могут считаться финальной публичной офертой до указания фирменного
  наименования, ОПФ, СТИР, юридического адреса и контактов Исполнителя. Также не подтверждены
  регистрация базы персональных данных и механизм зарубежного хранения по статье 27¹.
- Старые документы дают противоречивую картину реализации.

## Производительность

В июле 2026 устранены повторные auth/club round trips, добавлены индексы `0053`, repair RPC `0054`, lazy loading тяжёлых графиков и оптимистичные UI-обновления. Последний зафиксированный TTFB в `PERF_REPORT.md`: медиана около 127 мс после оптимизации; повторный production-замер после последних коммитов не выполнен.
