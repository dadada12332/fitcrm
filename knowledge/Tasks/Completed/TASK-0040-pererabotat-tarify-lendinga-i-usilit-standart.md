---
id: TASK-0040
type: feature
status: completed
priority: P2
module: marketing
created: 2026-07-22
updated: 2026-07-22
owner: codex
tags: [fitcrm, landing, pricing, conversion, design-system]
---

# Переработать тарифы лендинга и усилить Стандарт

## Goal

Сделать выбор тарифа на лендинге понятнее и превратить «Стандарт» в визуально и содержательно убедительный рекомендуемый вариант.

## Reason

Старый блок выделял Standard только тёмным фоном и угловой лентой, но не объяснял его ценность и использовал нелокализованные названия тарифов.

## Requirements

- Сохранить цены, преимущества и доступность тарифов динамическими из Platform Admin.
- Выделить тариф Standard независимо от порядка карточек, с fallback на рекомендуемый тариф из БД.
- Показать конкретную ценность Standard и явную CTA.
- Сохранить переключение месяц/год и скидку 20%.
- Поддержать RU/EN/UZ и mobile/desktop без overflow.

## Acceptance criteria

- [x] Standard визуально доминирует и объясняет, почему он оптимален для растущего клуба.
- [x] Названия, подписи и CTA локализованы на RU/EN/UZ.
- [x] Месячная и годовая цены переключаются корректно.
- [x] Все CTA ведут в регистрацию.
- [x] TypeScript, lint, tests и production build проходят.

## Files and data

- Files: `src/components/landing/v2/PricingCards.tsx`, `src/lib/i18n/messages.ts`.
- Tables/RPC: чтение существующих тарифов сохранено без изменений.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

- Удалена устаревшая угловая лента; Standard получил спокойный badge, ценностный тезис, proof-блок и синюю CTA.
- Карточки переведены на дизайн-токены и стабильную адаптивную сетку.
- Контейнер расширен до `1760px`: на широких экранах карточки имеют около `402px`, а на ноутбуках сетка перестраивается в `2×2` с карточками около `565px`.
- Добавлены локализованные названия тарифов и пояснения оплаты.

## Verification

- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- `npm test` — 126 passed, 1 skipped.
- `npm run build` — passed, 59 routes.
- Local browser QA: desktop 1440×1000 и mobile 390×844, RU/UZ, month/year switch, 4 registration CTA, horizontal overflow отсутствует.
- Width QA: 1920px — 4 карточки по 402px; 1234px — сетка 2×2 по 565px; overflow `0`.
- Production deployment `dpl_Ahif6zPnihctmqejFhg94kPVkxEs` — Ready; alias `fitcrm-three.vercel.app` назначен, production browser QA and health check passed.

## Remaining

Нет.

## Blockers

Нет.
