---
id: TASK-0029
type: feature
status: completed
priority: P1
module: growth
created: 2026-07-20
updated: 2026-07-20
owner: codex
tags: [fitcrm, task, growth, ux]
---

# Безопасный выход и понятный flow экспериментов Growth OS

## Goal

Защитить выход из аккаунта от случайного нажатия и превратить Growth OS Experiments из статичных карточек в понятный, сохраняемый рабочий цикл.

## Requirements

- Выход из основного sidebar требует явного подтверждения.
- Эксперимент открывается и ведётся внутри текущей вкладки в drawer.
- Запуск, срок, статус и результат сохраняются на уровне клуба.
- Сотрудник видит аудиторию, текст контакта и следующий шаг без догадок.
- Интерфейс работает на desktop/mobile и соответствует дизайн-системе.

## Acceptance criteria

- [x] Случайный клик по выходу не завершает сессию.
- [x] Эксперимент можно запустить, продолжить и завершить с результатом.
- [x] Кнопка эксперимента больше не переключает пользователя на предыдущий tab.
- [x] Сценарий контакта объясняет, что делать с текстом.
- [x] TypeScript, lint, тесты, build и browser smoke проходят.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

- Sidebar использует подтверждение выхода на базе общего `Dialog`; фактический sign-out происходит только после второго явного действия.
- «Playbooks» переименованы в понятные пользователю «Сценарии», а текст объясняет применение в Telegram или звонке.
- В «Экспериментах» добавлены три этапа, настройка в drawer, запуск, продолжение, переход к аудитории и фиксация результата.
- Жизненный цикл хранится в `growth_experiment_runs` по `club_id`; прямые клиентские записи запрещены, Server Actions проверяют права и tenant scope.
- Добавлены миграции таблицы, RLS/grants и индекса внешнего ключа автора.

## Verification

- `npx tsc --noEmit` — passed.
- `npm run lint` — 0 errors / 0 warnings.
- `npm test` — 111 passed / 1 skipped.
- `npm run build` — passed, 58 страниц.
- Local authenticated browser smoke: logout confirmation; Growth experiments desktop 1280×720 и mobile 390×844; start → active → complete; browser console 0 errors/warnings.
- Supabase: RLS enabled; `authenticated` SELECT granted, writes revoked; service action lifecycle verified; test row removed.
- Production: deployment `dpl_7BiuKA6ZPiHgPj9fxgv9eSbVnU3e` READY; alias `fitcrm-three.vercel.app`; disposable authenticated desktop/mobile smoke passed; QA data removed.

## Remaining

Нет.

## Blockers

Нет.
