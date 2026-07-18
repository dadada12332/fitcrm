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

### Changed

- Platform Admin приведён к общей дизайн-системе.
- Основные CRM-сценарии адаптированы для мобильных экранов.
- Быстрые действия на dashboard открываются компактным dropdown.
- Центр уведомлений стал информативнее и шире.

### Fixed

- Исправлен переход между шагами onboarding.
- Исправлены мобильные sidebar, фильтры, расписание, отчёты и карточка клиента.
- Ссылка восстановления пароля выровнена с опцией запоминания.
- Маршруты восстановления пароля больше не перенаправляют анонимного пользователя обратно на login.

### Performance

- Сокращены повторные auth/club round trips и задержки загрузки разделов CRM.

### Security

- Миграция `0055` закрыла anonymous/cross-tenant вызов публичных `SECURITY DEFINER` RPC; production проверен через Advisor и rollback RLS drill.
- Неизвестные/повреждённые role keys теперь получают deny-by-default permissions.

### Deprecated

- Корневые `FITCRM_*` документы считаются историческими снимками, если расходятся с кодом и Vault.

### Removed

- Нет пользовательски значимых удалений.

## Автоматические кандидаты

<!-- AUTO:START changelog-candidates -->
Кандидаты для ручного отбора; не все commits должны попасть в пользовательский changelog.

- `50e3ef4` · 2026-07-18 · Document test baseline and RPC security incident
- `32f4975` · 2026-07-18 · Add security regression tests and harden public RPCs
- `cb792ac` · 2026-07-18 · Document verified Sydney infrastructure topology
- `abedb02` · 2026-07-18 · Add operational Obsidian knowledge vault
- `dcea7c6` · 2026-07-18 · Keep support diagnostics visible on mobile
- `58ffb23` · 2026-07-18 · Fix platform support mobile header
- `edd49e7` · 2026-07-18 · Fix platform connections mobile actions
- `1cf7e0a` · 2026-07-18 · Fix platform dashboard mobile grid
- `f4543f3` · 2026-07-18 · Unify platform admin design system
- `44e8945` · 2026-07-17 · Hide breadcrumbs on mobile top bar
- `5172f4f` · 2026-07-17 · Filter expired notifications by end date
- `bca4ed1` · 2026-07-17 · Redesign notification center
- `9c5ec17` · 2026-07-17 · Align password recovery link with remember option
- `7cf1ffc` · 2026-07-17 · Optimize CRM data loading
- `51430e3` · 2026-07-17 · Use dropdown for quick actions
- `20e2835` · 2026-07-17 · Adapt client profile for mobile
- `d3a2f0a` · 2026-07-17 · Fix reports mobile controls
- `778283f` · 2026-07-17 · Improve schedule mobile toolbar
- `597e658` · 2026-07-17 · Improve visits mobile filters
- `53f99c8` · 2026-07-17 · Improve memberships mobile toolbar
- `3922eac` · 2026-07-17 · Stack revenue period filters on mobile
- `aaa88d0` · 2026-07-17 · Fix mobile sidebar drawer
- `d081868` · 2026-07-17 · Fix CRM mobile layouts and navigation flows
- `969916c` · 2026-07-17 · Fix onboarding first-step redirect
- `883f584` · 2026-07-17 · Improve auth and onboarding responsiveness
- `38f646c` · 2026-07-17 · docs: убрал коллизию про деплой в CLAUDE.md (git push авто-деплоит; alias вручную) — как заметил Codex
- `60c566e` · 2026-07-17 · docs: HANDOFF.md — полная передача проекта для нового AI (Codex) + AGENTS.md как точка входа
- `63e9b2c` · 2026-07-17 · style(telegram): рассылка на дизайн-систему приложения
- `a8cdb61` · 2026-07-17 · style(telegram): страница рассылки — контролы и радиусы к единому стилю (rounded-lg карточки, rounded-md h-9 контролы), превью TG не трогал
- `a2ce9ff` · 2026-07-17 · fix(telegram): утечка отчётов по всем клубам + понятная подсказка рассылки
<!-- AUTO:END changelog-candidates -->
