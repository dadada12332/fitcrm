---
id: TASK-0036
type: feature
status: completed
priority: P2
module: integrations
created: 2026-07-22
updated: 2026-07-22
owner: unassigned
tags: [fitcrm, task]
---

# Унифицировать Telegram KPI с дизайн-системой CRM

## Goal

KPI Telegram-интеграции визуально совпадают с сегментированными статистическими блоками клиентов, абонементов, расписания и оплат.

## Reason

Разрозненные центрированные карточки с цветными цифрами выглядели как компонент другой дизайн-системы.

## Requirements

- Использовать общий segmented KPI pattern CRM.
- Убрать случайные акцентные цвета и центрирование.
- Добавить семантические Lucide icons и сохранить responsive 2/4-column layout.
- Унифицировать верхние KPI и вкладку «Статистика».

## Acceptance criteria

- [x] KPI имеют нейтральную типографику, иконки и общие border/card tokens.
- [x] Desktop и mobile layouts не переполняются.
- [x] Light/dark mode используют только дизайн-токены.
- [x] TypeScript, lint, tests и build проходят.

## Files and data

- Files: `src/components/app/IntegrationManage.tsx`.
- Tables/RPC: нет изменений.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

- Добавлен общий `TelegramMetricGrid` с CRM typography, semantic Lucide icons и segmented surface.
- Верхние четыре KPI переведены с отдельных центрированных цветных карточек на общий CRM pattern.
- Вкладка «Статистика» использует тот же компонент; лишняя вложенная card-композиция удалена.

## Verification

- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- `npm test` — 126 passed, 1 skipped.
- `npm run build` — passed, 59 routes.
- Browser QA connected state: desktop 1280x720, mobile 390x844, statistics tab; overflow/clipping не обнаружены.
- `design-qa.md` — final result: passed.
- Временная Telegram-интеграция синтетического QA-клуба удалена, исходные settings восстановлены.
- Production deployment `dpl_31DbH9Cpkm5RSj68CmvBjEAUzSZR` — READY; alias `fitcrm-three.vercel.app` подтверждён.

## Remaining

Нет.

## Blockers

Нет.
