---
id: TASK-0006
type: feature
status: in-progress
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

- [ ] Экран понятен без инструкций и показывает приоритетные инсайты, тренды и следующие действия.
- [ ] Нет horizontal overflow и перекрытий на Pixel 7 и desktop.
- [ ] TypeScript, unit/security, Playwright и production build проходят.
- [ ] Изменения изолированы отдельным коммитом и описаны в Vault.

## Files and data

- Files: `src/app/(app)/ai/*`, связанные UI-компоненты и design tokens.
- Tables/RPC: проверить по коду до изменений; новые production tables не планируются.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

Начат reference/code audit.

## Verification

Не проверено.

## Remaining

Reference research, реализация, visual verification, docs и deploy.

## Blockers

Нет.
