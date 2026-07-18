---
id: TASK-0015
type: bug
status: done
priority: P1
module: telegram-miniapp
created: 2026-07-18
updated: 2026-07-18
owner: codex
tags: [fitcrm, telegram, miniapp, mobile, navigation]
---

# Telegram Mini App back navigation

## Symptom

После перехода с главной на «Занятия», «Пропуск» или «Профиль» пользователь не видел понятной кнопки возврата и закрывал Mini App целиком.

## Fix

- На внутренних экранах показывается обычная стрелка Back в шапке кабинета.
- Подключён Telegram `WebApp.BackButton`: он показывается вне главной и скрывается на главной.
- Mini App хранит собственный стек вкладок. Browser `history` не используется как источник истины, потому что Telegram iOS может схлопывать записи с одинаковым URL и перескакивать на главный экран.
- Нижняя навигация и быстрые действия используют единый `navigate()`.

## Verification

- Playwright regression `tests/e2e/telegram-miniapp-navigation.spec.ts` проверяет внутреннюю стрелку, нативный Telegram BackButton, путь `Профиль → Пропуск` и mobile overflow.
- Local mobile test passed.
- Remote mobile test на `https://fitcrm-three.vercel.app` passed.
- TypeScript, target ESLint, Vitest (`92 passed`, `1 skipped`) и production build passed.
- Commit `dd013bb`, deployment `dpl_F2vonSzG2RnKVBwiiCrFSSWA8Bzj` READY с production alias.
