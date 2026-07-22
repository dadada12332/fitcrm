---
id: TASK-0039
type: feature
status: completed
priority: P2
module: marketing
created: 2026-07-22
updated: 2026-07-22
owner: codex
tags: [fitcrm, landing, growth-os, retention, design-system]
---

# Добавить Growth OS и удержание на лендинг

## Goal

Добавить на главный лендинг полноценную адаптивную секцию, которая объясняет связку «Удержание → Growth OS» и ведёт к регистрации.

## Reason

Growth OS и удержание стали важными продуктовыми отличиями, но лендинг пока не объясняет их ценность и общий рабочий сценарий.

## Requirements

- Секция должна продолжать визуальный язык текущего лендинга и располагаться перед тарифами.
- Показать путь от сигнала риска до готового действия и измеримого результата.
- Добавить плавную анимацию, ручной выбор сценария и поддержку reduced motion.
- Поддержать русский, английский и узбекский языки.
- Проверить desktop/mobile и отсутствие layout overflow.

## Acceptance criteria

- [x] Growth OS и удержание объясняются как единый продуктовый сценарий.
- [x] Все три сценария переключаются вручную и автоматически.
- [x] Секция корректно работает на desktop и mobile.
- [x] RU/EN/UZ словари полные и типобезопасные.
- [x] TypeScript, lint, tests и production build проходят.

## Files and data

- Files: `src/components/landing/v2/GrowthRetention.tsx`, `src/app/(marketing)/page.tsx`, `src/lib/i18n/messages.ts`.
- Tables/RPC: не затрагиваются.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

- На лендинг перед тарифами добавлена самостоятельная секция «Growth OS + Удержание».
- Три сигнала риска переключаются вручную и автоматически, синхронно меняя AI-рекомендацию, следующий шаг и ожидаемый результат.
- AI-рекомендация явно показывает, что сотрудник получает готовый скрипт звонка и текст SMS для контакта с клиентом.
- Добавлены адаптивная desktop/mobile-компоновка, плавные переходы и поддержка `prefers-reduced-motion`.
- Контент локализован на русский, английский и узбекский языки.

## Verification

- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- `npm test` — 126 passed, 1 skipped.
- `npm run build` — passed, 59 routes.
- Local browser QA: desktop 1440×1000, mobile 390×844, RU/UZ, ручное переключение сценария, horizontal overflow отсутствует.
- Outreach copy QA: desktop/mobile, готовые форматы звонка и SMS видимы без переполнения; TypeScript, lint, tests и build повторно passed.
- Outreach copy deployment `dpl_F13ZoPetzgNNkrG8djNFDYS6mimj` — Ready; production содержит оба формата, health check passed.
- Production deployment `dpl_97fEZU87rLX2s8eQCjMhptHBepFC` — Ready; desktop/mobile browser QA passed, `/api/health` returned `status: ok` and `database: reachable`.

## Remaining

Нет.

## Blockers

Нет.
