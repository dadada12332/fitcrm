---
type: changelog
updated: 2026-07-18
tags: [fitcrm, releases]
---

# Changelog

Пользовательски значимые изменения в формате, близком к Keep a Changelog. Полная техническая история находится в Git.

## Unreleased

### Added

- В Telegram-интеграции можно загрузить, заменить и удалить аватар бота прямо из CRM; фото автоматически обрезается до квадрата и синхронизируется с Telegram.

- Импорт клиентов сохраняет все нераспознанные поля внешней CRM и показывает их отдельным блоком в карточке клиента вместе с источником импорта.
- Telegram Mini App и CRM получили клиентские обращения: отдельный inbox, темы, история, ответственные, статусы, быстрые ответы и доставка сообщений через бота клуба с retry.
- Раздел «Удержание» получил контекстного AI-копилота: анализ сегмента, приоритетная очередь, план на 7 дней и персональные разборы с черновиками сообщений.
- Добавлены публичный database-aware `/api/health`, структурированные request-error logs и authenticated Playwright gate для основных CRM-маршрутов.
- Growth OS объединяет ежедневный план, пульс клуба, revenue radar, симулятор, playbooks и каталог контролируемых экспериментов; новый центр удержания показывает клиентов с риском оттока и следующие действия.
- Операционная память проекта в `/knowledge` для команды и AI-агентов.
- Повторяемый Vitest/Playwright test harness для security, auth и responsive smoke.
- Telegram Mini App: абонемент, QR, визиты, расписание, бронирование, настройки reminders и онлайн-продление.
- Фундамент Instagram: безопасный OAuth, posts/reels и Insights, webhook/data deletion и раздельные platform/CRM метрики.

### Changed

- Вкладка «Внимание» в отчётах стала рабочей сводкой: задачи сгруппированы по приоритету, посещаемость отделена от проблем, а desktop/mobile-компоновка приведена к дизайн-системе CRM.

- Экран Telegram-рассылки получил единый рабочий сценарий: получатели, планирование, редактор, тестовая отправка, живой предпросмотр и история теперь адаптивны и соответствуют дизайн-системе CRM.

- KPI Telegram-интеграции и вкладки статистики приведены к общему сегментированному стилю CRM с нейтральными иконками и адаптивной сеткой 2×2/4×1.

- Шаблоны Telegram переработаны в сценарный редактор с подсказками переменных, live preview, сбросом и явным состоянием несохранённых изменений.
- Все CSV/XLSX-выгрузки CRM унифицированы: кириллица, кавычки, переносы строк, формулы, заголовки, фильтры и ширины колонок обрабатываются предсказуемо.
- Настройки клуба теперь показывают только рабочие сценарии: рабочие часы, способы оплаты, Telegram-напоминания, полноценные интеграции, смену пароля и управление сессиями.
- Импорт CSV/XLSX получил устойчивый parser, автоматический поиск строки заголовков, серверную нормализацию телефона/email/дат/денег и безопасное частичное обновление существующих клиентов.
- Growth OS «Эксперименты» теперь ведут сотрудника по этапам настройки, контакта и результата внутри drawer; запуски и выводы сохраняются на уровне клуба, а «Playbooks» переименованы в «Сценарии» с понятной инструкцией по применению текста.
- Регистрация и login теперь корректно возобновляют незавершённый onboarding; шаги сохраняются, а приглашения команды отправляются реально.
- Уведомления загружают полный список только при открытии drawer; badge приходит вместе с sidebar aggregate.
- Landing overview получил плавную смену реальных экранов CRM, progress состояния, паузу при взаимодействии и полноценную mobile/keyboard адаптацию.
- Obsidian Vault получил Dataview, Tasks, Periodic Notes, Templater и Style Settings; Weekly и Templates связаны с существующей структурой заметок.
- Obsidian Kanban и Calendar включены и связаны с task frontmatter, Daily Notes и понедельником как началом недели.
- Platform Admin приведён к общей дизайн-системе.
- AI Аналитика переработана в адаптивное операционное рабочее место с живой сводкой и быстрыми KPI-карточками.
- Основные CRM-сценарии адаптированы для мобильных экранов.
- Быстрые действия на dashboard открываются компактным dropdown.
- Центр уведомлений стал информативнее и шире.

### Fixed

- Счётчик «Внимание» теперь учитывает все истекающие абонементы, клиентов в зоне риска и задолженности, а не только часть событий.

- Ссылка на подключённого Telegram-бота теперь использует его username; client/server validation не позволяет отправить неподдерживаемое изображение или текст сверх лимитов Telegram.

- Предпросмотр аватара Telegram-бота больше не повреждается при записи бинарного JPEG в Supabase Storage; существующий production-файл восстановлен.

- Сохранение Telegram-автоматизации больше не возвращает старые тексты шаблонов; неизвестные переменные и сообщения вне лимита Telegram отклоняются до отправки.
- Экспорт абонементов возвращён в актуальный карточный экран; отчёты теперь скачиваются одним читаемым XLSX, а экспорт оплат проверяет серверное право.
- Удалены настройки-заглушки и кнопки-фильтры без действия; рабочие часы и Telegram-параметры теперь реально влияют на связанные сценарии.
- Импорт больше не теряет неизвестные колонки, не затирает заполненные поля отсутствующими значениями, не создаёт скрытые дубли из-за форматирования телефона и не отменяет весь пакет из-за одной ошибочной строки.
- Выход из аккаунта теперь требует подтверждения и защищён от случайного нажатия в sidebar.
- Исправлена повторная поломка «Ролей и прав» после security hardening, theme hydration mismatch и частичное создание клиента при ошибке абонемента.
- Создание клиента из ручного посещения теперь открывает client drawer; неработающее Telegram-действие в долгах скрыто до реализации.
- Активная вкладка Growth OS теперь визуально выделяется общей для CRM плашкой и нейтральным текстом во всех четырёх разделах и обеих темах.
- Стрелки ежедневного плана Growth OS теперь открывают соответствующий внутренний playbook или эксперимент и не уводят пользователя из `/growth`.
- Email login and post-login routing no longer require a service-role key when the authenticated user reads their own club memberships.
- The expiring-membership clock on the dashboard now uses the same neutral icon color as the other KPI tiles.
- AI Аналитика использует стандартные отступы AppShell без дополнительного внутреннего padding; desktop и mobile теперь совпадают с остальными CRM-разделами.
- Telegram и CRM больше не сопоставляют посещения по отображаемым именам: точная связь хранится через внутренний `client_id`, первичный поиск телефона стал exact и защищён от дублей/cross-club связей.
- Telegram Mini App показывает имя текущего Telegram-пользователя; QR-пропуск обновляется каждые 30 секунд, одноразовый и больше не выходит за рамку на мобильном экране.
- В Telegram Mini App появились внутренняя и нативная кнопки Back с корректным возвратом между экранами.
- «Отправить себе» в Telegram теперь корректно использует связь сотрудника текущего клуба, даже если владелец состоит в нескольких клубах.
- Вкладка «Роли и права» больше не зависает на бесконечном skeleton; ошибки загрузки теперь показываются с возможностью повтора.
- Оплата из карточки клиента теперь жёстко привязана к открытому клиенту без повторного поиска; сервер дополнительно проверяет принадлежность клиента и абонемента клубу.
- Исправлен переход между шагами onboarding.
- Исправлены мобильные sidebar, фильтры, расписание, отчёты и карточка клиента.
- Ссылка восстановления пароля выровнена с опцией запоминания.
- Маршруты восстановления пароля больше не перенаправляют анонимного пользователя обратно на login.
- Vercel Cron для scheduled broadcasts больше не перехватывается CRM auth redirect и доходит до собственной Bearer-проверки.

### Performance

- Settings загружает независимые данные параллельно; staff использует один tenant-scoped aggregate RPC вместо серии клиентских подсчётов.
- Графики получили стабильные initial dimensions, а штатные прерывания навигации больше не засоряют production error logs.
- Сокращены повторные auth/club round trips и задержки загрузки разделов CRM.
- Типовые запросы AI Аналитики обходят LLM и получают scoped KPI напрямую из Supabase.

### Security

- Клиентские обращения связываются только через подтверждённый `client_id`; прямые authenticated-записи в inbox-таблицы запрещены, а действия сотрудников защищены модульными permissions.
- Retention AI повторно загружает клиентов по `club_id`, проверяет права и не доверяет ID/данным из браузера; AI не выполняет скрытых мутаций и не может добавить клиента вне server-scoped результата.
- Миграции `0065`–`0067` закрыли broad Storage listing, ограничили upload MIME/size, отозвали лишние RPC grants и добавили недостающие FK indexes.
- Production two-club RLS probe подтвердил отсутствие cross-tenant read/write доступа.
- Миграция `0055` закрыла anonymous/cross-tenant вызов публичных `SECURITY DEFINER` RPC; production проверен через Advisor и rollback RLS drill.
- Неизвестные/повреждённые role keys теперь получают deny-by-default permissions.
- AI Аналитика переведена в read-only режим: mutating tools исключены до реализации явного подтверждения и модульных permission checks.
- Service-role callbacks Click, Payme, Telegram и scheduled broadcasts получили явный tenant scope; Telegram отклоняет client ID другого клуба.

### Deprecated

- Корневые `FITCRM_*` документы считаются историческими снимками, если расходятся с кодом и Vault.

### Removed

- Удалён уязвимый пакет `xlsx`; импорт `.xlsx` работает через ExcelJS, legacy `.xls` больше не принимается.

## Автоматические кандидаты

<!-- AUTO:START changelog-candidates -->
Кандидаты для ручного отбора; не все commits должны попасть в пользовательский changelog.

- `50bb457` · 2026-07-22 · feat: redesign reports attention workspace
- `62ee8aa` · 2026-07-22 · docs: record Telegram broadcast release [skip ci]
- `5526a88` · 2026-07-22 · feat: redesign Telegram broadcast workspace
- `481c70e` · 2026-07-22 · docs: record Telegram KPI redesign [skip ci]
- `440ba3d` · 2026-07-22 · style: align Telegram metrics with CRM
- `b8de7bd` · 2026-07-22 · docs: record Telegram avatar repair [skip ci]
- `260df15` · 2026-07-22 · fix: preserve Telegram avatar preview bytes
- `8d41ce0` · 2026-07-22 · docs: record Telegram bot avatar release [skip ci]
- `e30e513` · 2026-07-22 · feat: manage Telegram bot avatar
- `f677b06` · 2026-07-22 · docs: record Telegram templates redesign [skip ci]
- `50a9690` · 2026-07-22 · feat: redesign Telegram message templates
- `970660e` · 2026-07-22 · docs: record data exchange and settings audit [skip ci]
- `6083b4c` · 2026-07-21 · fix: restore memberships export
- `6c34951` · 2026-07-21 · feat: harden CRM data exchange and settings
- `99fef54` · 2026-07-21 · docs: record resilient import release
- `35a0164` · 2026-07-21 · feat: make client imports lossless and resilient
- `745d121` · 2026-07-21 · docs: record client inbox production verification
- `9709769` · 2026-07-21 · fix: schedule inbox retries via Supabase
- `a7be5a8` · 2026-07-21 · feat: add Telegram client support inbox
- `cd25340` · 2026-07-20 · docs: record verified growth workflow release [skip ci]
- `47c01be` · 2026-07-20 · feat: add guided growth experiments and safe sign out
- `70f17dd` · 2026-07-20 · docs: record product onboarding release [skip ci]
- `de36532` · 2026-07-20 · feat: add first-run product onboarding
- `def494f` · 2026-07-20 · docs: record retention outreach release [skip ci]
- `b60cc07` · 2026-07-20 · feat: complete retention outreach workflow
- `99cf665` · 2026-07-20 · docs: record verified retention AI release [skip ci]
- `63d1989` · 2026-07-20 · feat: add retention AI copilot
- `bc10d6d` · 2026-07-20 · docs: retire resolved launch issues [skip ci]
- `7716f9d` · 2026-07-20 · docs: record verified production hardening [skip ci]
- `6e4e494` · 2026-07-20 · perf: harden CRM runtime and production checks
<!-- AUTO:END changelog-candidates -->
