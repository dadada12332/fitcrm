---
id: TASK-0028
type: documentation
status: completed
priority: P1
module: onboarding
updated: 2026-07-20
owner: codex
tags: [fitcrm, task, onboarding]
---

# Первый запуск: продуктовый тур и предложение подписки

## Goal

Показать новому владельцу клуба короткий интерактивный тур после онбординга и мягкое предложение актуального платного тарифа для trial-клуба.

## Reason

Снизить время до первого полезного действия, количество вопросов о навигации и мягко конвертировать trial в подписку без навязчивых повторов.

## Requirements

- Тур запускается только владельцу после завершённого онбординга на `/dashboard`.
- Подсказки выделяют реальные элементы CRM и работают на desktop/mobile.
- Состояние хранится в Supabase на уровне сотрудника и клуба.
- Предложение подписки показывается через 10 секунд после тура и не чаще одного раза в 3 дня.
- Цена, преимущества и скидка берутся из Platform Admin plans.
- Анимации плавные и учитывают `prefers-reduced-motion`.

## Acceptance criteria

- [x] Тур можно завершить или пропустить, после чего он не повторяется на другом устройстве.
- [x] На мобильном sidebar автоматически открывается для целевых шагов.
- [x] Trial-оффер ведёт в настройки подписки и не содержит выдуманной скидки.
- [x] TypeScript, lint, тесты, build и браузерный smoke проходят.

## Files and data

- Files: `src/components/app/ProductOnboarding.tsx`, `src/components/app/AppShell.tsx`, `src/components/app/Sidebar.tsx`, `src/app/(app)/layout.tsx`.
- Tables/RPC: поля `product_tour_completed_at` и `trial_offer_last_seen_at` в `public.staff`; миграции `0071` и `0072`.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

- Реализован анимированный welcome + 4 контекстных шага по живым элементам CRM.
- Добавлена мобильная оркестрация sidebar и адаптивное позиционирование подсказок.
- Добавлена trial-модалка с актуальным рекомендованным тарифом и cooldown 3 дня.
- Состояние синхронизируется между устройствами и защищено отдельным DB-триггером.

## Verification

- `npx tsc --noEmit` — passed.
- `npm run lint -- --max-warnings=0` — passed.
- `npm run test` — 111 passed, 1 skipped.
- `npm run build` — passed.
- Localhost desktop/mobile — tour, sidebar spotlight, 10-second offer and persistence verified.
- Supabase migration columns and post-trigger Server Action persistence verified.
- Production deployment `dpl_GU2gupDAf9SPY3wifMVuQgnd5xyt` — Ready; alias `fitcrm-three.vercel.app` active.
- Production authenticated smoke — dashboard loaded, all four tour markers present, Next.js error overlay absent.

## Remaining

Нет.

## Blockers

Нет.
