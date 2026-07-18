---
type: changelog
updated: 2026-07-18
tags: [fitcrm, releases]
---

# Changelog

Пользовательски значимые изменения в формате, близком к Keep a Changelog. Полная техническая история находится в Git.

## Unreleased

### Added

- Операционная память проекта в `/knowledge` для команды и AI-агентов.
- Повторяемый Vitest/Playwright test harness для security, auth и responsive smoke.
- Telegram Mini App: абонемент, QR, визиты, расписание, бронирование, настройки reminders и онлайн-продление.
- Фундамент Instagram: безопасный OAuth, posts/reels и Insights, webhook/data deletion и раздельные platform/CRM метрики.

### Changed

- Platform Admin приведён к общей дизайн-системе.
- AI Аналитика переработана в адаптивное операционное рабочее место с живой сводкой и быстрыми KPI-карточками.
- Основные CRM-сценарии адаптированы для мобильных экранов.
- Быстрые действия на dashboard открываются компактным dropdown.
- Центр уведомлений стал информативнее и шире.

### Fixed

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

- Сокращены повторные auth/club round trips и задержки загрузки разделов CRM.
- Типовые запросы AI Аналитики обходят LLM и получают scoped KPI напрямую из Supabase.

### Security

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

- `2e3e585` · 2026-07-18 · Link Telegram visits by CRM client identity
- `26e801e` · 2026-07-18 · Document secure Telegram QR rollout [skip ci]
- `efd8664` · 2026-07-18 · Secure Telegram Mini App QR passes
- `d9295b4` · 2026-07-18 · Document Telegram Mini App back navigation [skip ci]
- `dd013bb` · 2026-07-18 · Add Telegram Mini App back navigation
- `0e869c3` · 2026-07-18 · Document Telegram multi-club self-test fix [skip ci]
- `9cd0b22` · 2026-07-18 · Scope Telegram self-test to current club
- `e7ea58e` · 2026-07-18 · Document Telegram Mini App and Instagram rollout [skip ci]
- `b2dc9f2` · 2026-07-18 · Harden Instagram deletion callback
- `d2c603e` · 2026-07-18 · Refine Instagram setup layout
- `7e64c47` · 2026-07-18 · Add Instagram integration foundation
- `580b9e8` · 2026-07-18 · Add Telegram client Mini App
- `e9e64ae` · 2026-07-18 · Document Telegram self-test fix [skip ci]
- `7a7ce7c` · 2026-07-18 · Fix Telegram self-test pairing
- `56bcd9c` · 2026-07-18 · Document verified Telegram production rollout [skip ci]
- `7cc3f87` · 2026-07-18 · Enforce one club per Telegram bot
- `e3af97f` · 2026-07-18 · Rebuild Telegram integration around club bots
- `249ee65` · 2026-07-18 · Document roles loading fix [skip ci]
- `28efccd` · 2026-07-18 · Fix roles settings loading loop
- `ec911ad` · 2026-07-18 · Document client payment binding [skip ci]
- `119d7f7` · 2026-07-18 · Bind client profile payments to client
- `cffeb1c` · 2026-07-18 · Record verified production deployment
- `55d0577` · 2026-07-18 · Allow authenticated cron callbacks through middleware
- `5032589` · 2026-07-18 · Refresh project handoff after audit
- `13dd7c2` · 2026-07-18 · Document overnight reliability audit
- `63a6670` · 2026-07-18 · Harden Telegram tenant boundaries
- `dc9b926` · 2026-07-18 · Replace vulnerable spreadsheet parser
- `6ded6e4` · 2026-07-18 · Report infrastructure health truthfully
- `686869d` · 2026-07-18 · Scope payment service queries by club
- `470bf62` · 2026-07-18 · Redesign AI analytics workspace
<!-- AUTO:END changelog-candidates -->
