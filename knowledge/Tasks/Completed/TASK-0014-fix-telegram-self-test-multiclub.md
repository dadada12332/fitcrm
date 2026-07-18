---
id: TASK-0014
type: bug
status: done
priority: P1
module: telegram
created: 2026-07-18
updated: 2026-07-18
owner: codex
tags: [fitcrm, telegram, multiclub, self-test]
---

# Fix Telegram self-test for multi-club users

## Symptom

Владелец уже привязал Telegram через deep link, но «Отправить себе» продолжало показывать «Сначала привяжите свой Telegram».

## Root cause

`testBroadcastAction` искал `staff` только по `user_id` через `.single()`. У пользователя две активные membership-записи в разных клубах, поэтому Supabase возвращал multiple rows и `data=null`. Следующий запрос искал Telegram link с пустым `staff_id`.

## Fix

Staff lookup теперь обязательно ограничен текущим `ctx.clubId`, `user_id` и `is_active=true`, использует `maybeSingle()` и явно сообщает об отсутствии staff. Telegram link ищется по найденному staff текущего клуба.

## Verification

- Production state: `activeClubMemberships=2`, `currentClubStaffMatches=1`, `currentClubTelegramLinks=1`.
- Existing Telegram link сохранён; повторная привязка не требуется.
- TypeScript, target ESLint, Vitest (`92 passed`, `1 skipped`) и production build прошли.
- Commit `9cd0b22`, deployment `dpl_F6ByqGEqCspTC6FgNQcCtvQ5DdU4` READY и назначен `fitcrm-three.vercel.app`.
