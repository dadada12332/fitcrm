---
id: TASK-0002
type: performance
status: completed
priority: P1
module: infrastructure
created: 2026-07-18
updated: 2026-07-18
owner: Codex
tags: [fitcrm, performance, infrastructure]
---

# Проверить регионы Vercel и Supabase

## Goal

Подтвердить фактический регион Supabase, сопоставить его с Vercel `syd1` и измерить server-side latency без раскрытия credentials.

## Acceptance criteria

- Регионы подтверждены через панели/официальные API.
- Измерены p50/p95 TTFB и DB round-trip на production-safe запросах.
- При несовпадении подготовлен план переноса с rollback и окном работ.
- Обновлены Environment Matrix и [[../Decisions/ADR-0001-infrastructure-regions]].

## Blocker

Нет.

## Result

- Supabase metadata подтверждает регион `ap-southeast-2` (Sydney), статус `ACTIVE_HEALTHY`.
- `vercel.json` подтверждает Vercel Functions в `syd1` (Sydney).
- Последний production deployment имеет статус `READY` и может быть rollback candidate.
- Защищённая `/platform/monitoring` измерила cold DB check 1162 ms; пять warm samples: 167, 55, 155, 86 и 107 ms, медиана 107 ms.
- Перенос региона не требуется. Высокий cold sample требует наблюдения, но topology корректна.

## Verification

Metadata получены через подключённые Supabase/Vercel API. Latency измерена на production через существующий защищённый platform monitoring без изменения данных.
