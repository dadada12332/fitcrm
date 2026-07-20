---
type: changelog
updated: 2026-07-18
tags: [fitcrm, releases]
---

# Changelog

Пользовательски значимые изменения в формате, близком к Keep a Changelog. Полная техническая история находится в Git.

## Unreleased

### Added

- Добавлены публичный database-aware `/api/health`, структурированные request-error logs и authenticated Playwright gate для основных CRM-маршрутов.
- Growth OS объединяет ежедневный план, пульс клуба, revenue radar, симулятор, playbooks и каталог контролируемых экспериментов; новый центр удержания показывает клиентов с риском оттока и следующие действия.
- Операционная память проекта в `/knowledge` для команды и AI-агентов.
- Повторяемый Vitest/Playwright test harness для security, auth и responsive smoke.
- Telegram Mini App: абонемент, QR, визиты, расписание, бронирование, настройки reminders и онлайн-продление.
- Фундамент Instagram: безопасный OAuth, posts/reels и Insights, webhook/data deletion и раздельные platform/CRM метрики.

### Changed

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

- `7716f9d` · 2026-07-20 · docs: record verified production hardening [skip ci]
- `6e4e494` · 2026-07-20 · perf: harden CRM runtime and production checks
- `ac1a6fe` · 2026-07-20 · Record verified launch readiness status
- `7a01d28` · 2026-07-20 · Harden launch-critical flows and infrastructure
- `f81cc0b` · 2026-07-19 · Record verified active tab deployment [skip ci]
- `ca1bc08` · 2026-07-19 · Fix Growth OS active tab styling
- `3fdf562` · 2026-07-19 · Record verified Growth OS production release [skip ci]
- `0514d3d` · 2026-07-19 · Release retention center and Growth OS
- `0724a97` · 2026-07-19 · Keep Growth OS plan navigation internal
- `350dc23` · 2026-07-19 · Record Growth OS local verification [skip ci]
- `5904123` · 2026-07-19 · Add Growth OS decision workspace
- `a6ac540` · 2026-07-19 · Record retention prototype verification [skip ci]
- `1086f15` · 2026-07-19 · Add local retention center prototype
- `511f372` · 2026-07-19 · Record authenticated QA production verification [skip ci]
- `2e3e312` · 2026-07-19 · Add authenticated local QA gate
- `abd37f0` · 2026-07-19 · Record verified dashboard production deploy [skip ci]
- `09d44d7` · 2026-07-19 · Fix dashboard icon and Windows knowledge sync
- `8c32036` · 2026-07-18 · Document landing overview refresh [skip ci]
- `f78622e` · 2026-07-18 · Polish landing platform overview
- `699ac9f` · 2026-07-18 · Document Obsidian productivity plugins [skip ci]
- `62a645a` · 2026-07-18 · Configure Obsidian Kanban and Calendar [skip ci]
- `9c6d5a6` · 2026-07-18 · Document AI page spacing fix [skip ci]
- `2628a08` · 2026-07-18 · Align AI analytics page spacing
- `1610389` · 2026-07-18 · Document Telegram client identity model [skip ci]
- `2e3e585` · 2026-07-18 · Link Telegram visits by CRM client identity
- `26e801e` · 2026-07-18 · Document secure Telegram QR rollout [skip ci]
- `efd8664` · 2026-07-18 · Secure Telegram Mini App QR passes
- `d9295b4` · 2026-07-18 · Document Telegram Mini App back navigation [skip ci]
- `dd013bb` · 2026-07-18 · Add Telegram Mini App back navigation
- `0e869c3` · 2026-07-18 · Document Telegram multi-club self-test fix [skip ci]
<!-- AUTO:END changelog-candidates -->
