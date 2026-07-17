---
id: TASK-0002
type: performance
status: ready
priority: P1
module: infrastructure
created: 2026-07-18
updated: 2026-07-18
owner: unassigned
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

Требуется доступ к metadata Supabase project или панели владельца.
