---
id: TASK-0044
type: feature
status: in-progress
priority: P1
module: pricing
created: 2026-07-22
updated: 2026-07-22
owner: unassigned
tags: [fitcrm, task]
---

# Проверить тарифные лимиты и добавить предложение апгрейда

## Goal

Проверить фактическое применение всех тарифных лимитов и показывать единое предложение следующего тарифа при блокировке операции.

## Reason

После включения entitlement-матрицы сервер блокировал часть операций обычной ошибкой, а некоторые месячные расходы учитывались неполно или неоднозначно. Пользователь должен понимать причину блокировки и иметь безопасный путь к апгрейду без потери данных.

## Requirements

- Оставить в Platform Admin только лимиты, которые реально применяются продуктом.
- Проверить record limits и monthly usage во всех связанных Server Actions и cron-сценариях.
- Не учитывать системные роли в лимите пользовательских ролей.
- Считать один пакетный импорт одной операцией независимо от количества batch-запросов.
- Показать адаптивный upgrade dialog с актуальным следующим тарифом и ценой из БД.

## Acceptance criteria

- [x] Все 10 лимитов имеют server-side enforcement и boundary tests.
- [x] Повтор одного import reservation не расходует лимит повторно.
- [x] Ошибка лимита открывает единый upgrade dialog на desktop и mobile.
- [ ] Production deployment и browser smoke подтверждены.

## Files and data

- Files: `src/lib/plan-limits.ts`, `src/lib/plan-enforcement.ts`, `src/components/app/PlanLimitUpgradeDialog.tsx`, CRM actions/routes.
- Tables/RPC: `plan_limits`, `plan_usage`, `plan_usage_reservations`, `consume_plan_usage_once`.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

Исправлено покрытие экспортов, Telegram self-test, филиалов, пользовательских ролей и batch-импорта. Добавлены структурированные ошибки лимита, клиентский dispatcher и единый dialog с database-aware рекомендацией только более высокого тарифа.

## Verification

Локально: TypeScript и ESLint без ошибок; 141 test passed, 1 skipped; production build собрал 59 страниц; browser QA desktop/mobile показал dialog без overflow и console errors. Production RPC проверен на атомарность и идемпотентность; QA-данные удалены.

## Remaining

Commit, deploy и production smoke.

## Blockers

Нет.
