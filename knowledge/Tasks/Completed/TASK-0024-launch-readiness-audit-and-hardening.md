---
id: TASK-0024
type: feature
status: completed
priority: P0
module: platform
created: 2026-07-20
updated: 2026-07-20
owner: codex
tags: [fitcrm, task]
---

# Launch readiness audit and hardening

## Goal

Проверить готовность FitCRM к массовому запуску, устранить безопасно исправимые блокеры и зафиксировать подтверждённые требования до релиза.

## Reason

Владелец готовит продукт к публичному запуску и запросил полный аудит CRM без остановки на промежуточных вопросах.

## Requirements

- Проверить инфраструктуру, auth, onboarding, tenant isolation и ключевые CRM-сценарии.
- Проверить desktop/mobile, light/dark, ошибки браузера и согласованность operational drawer-паттерна.
- Запустить тесты, TypeScript, lint и production build.
- Исправить подтверждённые дефекты с контролируемым риском.
- Подготовить launch checklist с блокерами, владельцами и проверками.

## Acceptance criteria

- [x] Критические пользовательские сценарии пройдены на синтетическом QA-клубе.
- [x] Подтверждённые P0/P1 дефекты исправлены или явно отмечены как внешние блокеры.
- [x] Проверки проекта проходят, production deployment проверен.
- [x] Knowledge и Obsidian синхронизированы.

## Files and data

- Files: не определено.
- Tables/RPC: не определено.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

- Исправлены auth/onboarding resume, terms consent и локализация auth errors.
- Усилены Storage/RPC policies, upload limits и FK indexes (`0065`–`0067`).
- Устранены partial client creation, dead actions, roles RPC regression и theme hydration mismatch.
- Notification count объединён с sidebar aggregate, тяжёлый drawer payload загружается лениво.
- Operational create flows ролей и поддержки приведены к drawer pattern.

## Verification

`npx tsc --noEmit`, `npm test`, `npm run build`, `npm run test:e2e`; authenticated desktop/mobile traversal; two-tenant production RLS probe; Supabase advisors and cron HTTP responses.

## Remaining

Внешние launch blockers вынесены в checklist; продолжать через отдельные задачи.

## Blockers

Mass-launch external blockers are recorded in [[Reports/Launch Readiness 2026-07-20]].
