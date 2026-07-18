---
id: TASK-0021
type: feature
status: completed
priority: P2
module: landing
created: 2026-07-18
updated: 2026-07-18
owner: codex
tags: [fitcrm, landing, motion, responsive, accessibility]
---

# Polish landing platform overview

## Goal

Пересобрать блок обзора платформы в стиле текущего лендинга, сохранив его композицию, реальные CRM-экраны и мультиязычный контент, но сделать смену сценариев плавной и понятной.

## Reason

Блок уже показывал отчёты, склад, расписание и посещения, но переходы ощущались механическими, автопереключение продолжало работать вне viewport, а табы не имели полной клавиатурной навигации.

## Requirements

- Сохранить визуальный язык всего landing v2 и референсную композицию.
- Использовать реальные скриншоты продукта, а не декоративный мокап.
- Добавить спокойную автосмену, ручной выбор и паузу при взаимодействии.
- Сохранить mobile layout без горизонтального overflow.
- Уважать `prefers-reduced-motion` и доступную tab semantics.

## Acceptance criteria

- [x] Четыре сценария переключаются вручную и автоматически.
- [x] Активное состояние, прогресс и screenshot transition анимированы согласованно.
- [x] Наведение и фокус останавливают автоматическую смену.
- [x] Arrow/Home/End управляют табами с клавиатуры.
- [x] На viewport 390 px отсутствует горизонтальный overflow.
- [x] Production deployment проверен на основном домене.

## Files and data

- Files: `src/components/landing/v2/Stats.tsx`.
- Assets: `public/screens/hero-reports.png`, `hero-warehouse.png`, `hero-warehouse-pos.png`, `hero-schedule.png`, `hero-visits.png`.
- Tables/RPC: не затронуты.

## Must not break

Мультиязычный контент RU/EN/UZ, CTA регистрации, загрузку реальных screenshots, reduced-motion и responsive landing layout.

## Changes

- Активный таб получил общий layout-transition для фона и brand rail.
- Добавлен синхронизированный progress indicator и viewport-aware auto-cycle.
- Переходы screenshots используют мягкие opacity/scale/position transforms и лёгкое движение browser frame.
- Warehouse продолжает отдельно менять table/POS screenshots.
- Компонент переведён на общие design tokens без локальных raw colors.
- Добавлены tab/tabpanel ARIA-связи и клавиатурная навигация.

## Verification

- `npx eslint src/components/landing/v2/Stats.tsx` — passed.
- `npx tsc --noEmit` — passed.
- `npm run build` — passed, 56 static pages generated.
- Local Playwright desktop 1440x900 and mobile 390x844 — all four tabs passed; ArrowDown selected the next tab; mobile viewport/scroll width `390/390`.
- Production Playwright on `https://fitcrm-three.vercel.app/` — HTTP 200, 4 tabs, selected panel linkage passed, viewport/scroll width `390/390`, console errors `0`.

## Deploy

- Commit: `f78622e` (`Polish landing platform overview`).
- Vercel: `dpl_8A9zNNeFR2Uw6bWYeDfNNY6bgFV3`, status Ready.
- Alias: `https://fitcrm-three.vercel.app`.

## Remaining

Нет.

## Blockers

Нет.
