---
id: TASK-0006
type: feature
status: completed
priority: P1
module: ai-analytics
created: 2026-07-18
updated: 2026-07-18
owner: Codex
tags: [fitcrm, ai, analytics, ux]
---

# Переработать AI Аналитику по дизайн-системе

## Goal

Превратить `/ai` в полезный, быстрый и адаптивный операционный экран с объяснимыми инсайтами и действиями в дизайн-системе FitCRM.

## Reason

Текущий модуль частичный и визуально не соответствует зрелости остальных CRM-разделов; пользователь дал отдельное поручение на полную переработку.

## Requirements

- Использовать только реальные клубные данные и существующие permission boundaries.
- Исследовать актуальные SaaS/CRM analytics references, не копируя чужой бренд.
- Соблюдать `DESIGN_SYSTEM.md`, light/dark, desktop/mobile и быстрые loading states.
- Любое новое действие должно вести в существующий рабочий сценарий.

## Acceptance criteria

- [x] Экран понятен без инструкций и показывает приоритетные инсайты, тренды и следующие действия.
- [x] Нет horizontal overflow и перекрытий на Pixel 7 и desktop.
- [x] TypeScript, unit/security, Playwright и production build проходят.
- [x] Изменения изолированы отдельным коммитом и описаны в Vault.

## Files and data

- Files: `src/app/(app)/ai/*`, связанные UI-компоненты и design tokens.
- Tables/RPC: проверить по коду до изменений; новые production tables не планируются.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

- Экран перестроен как рабочее место: чат, дневная сводка, фокус внимания и быстрые запросы.
- Типовые KPI-запросы исполняются напрямую через scoped Supabase queries, без задержки и нестабильности LLM.
- AI оставлен read-only: опасные mutating tools удалены до появления отдельного confirmation и permission flow.
- Убраны raw colors, gradients и oversized radii; применены токены FitCRM и shadcn primitives.
- Reference-выводы сохранены в [[../Research/AI Analytics References]].

## Verification

- ESLint для AI-модуля: passed.
- `npx tsc --noEmit`: passed.
- Playwright visual: desktop 1440x1000 и Pixel 7, horizontal overflow отсутствует.
- Живой запрос «выручка за 7 дней» вернул scoped KPI-card; временные QA user/club удалены.

## Remaining

Нет. Полный regression suite и production build прошли в финальном ночном прогоне.

## Blockers

Нет.
