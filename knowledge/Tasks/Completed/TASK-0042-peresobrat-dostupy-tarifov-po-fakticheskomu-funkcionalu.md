---
id: TASK-0042
type: feature
status: completed
priority: P3
module: pricing
created: 2026-07-22
updated: 2026-07-22
owner: unassigned
tags: [fitcrm, task]
---

# Пересобрать доступы тарифов по фактическому функционалу

## Goal

Сформировать честную и технически реализуемую матрицу доступов Trial, Starter, Standard и Business на основе фактического функционала FitCRM.

## Reason

Production-конфигурация тарифов расходится с лендингом и зрелостью модулей, а тарифные ограничения ещё не применяются в CRM.

## Requirements

- Проверить production-значения тарифов, features, sections и limits.
- Сопоставить их с рабочими и частично готовыми модулями CRM.
- Предложить продуктовую матрицу и безопасный порядок внедрения enforcement.

## Acceptance criteria

- [x] Зафиксированы расхождения production и лендинга.
- [x] Составлена матрица доступа для четырёх тарифов.
- [x] Неподтверждённые возможности отделены от готовых.
- [x] Описан технический порядок внедрения без блокировки текущих клубов.

## Files and data

- Files: `knowledge/Reports/Plan Access Matrix 2026-07-22.md`.
- Tables: read-only проверка `plans`, `plan_features`, `plan_limits`, `plan_sections`, `clubs`.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

Создан продуктово-технический аудит тарифных доступов с рекомендуемой матрицей и rollout-планом.

## Verification

Production-конфигурация прочитана напрямую через Supabase; использование entitlement-хелперов проверено поиском по коду.

## Remaining

После подтверждения владельцем реализовать новые entitlement-ключи, resolver, server-side gating и лимиты.

## Blockers

Нет.
