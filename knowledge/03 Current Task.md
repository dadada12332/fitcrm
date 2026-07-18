---
type: current-task
status: blocked
active_task: TASK-0004
updated: 2026-07-18
tags: [fitcrm, tasks]
---

# TASK-0004 — Провести backup/restore drill

Источник задачи: [[Tasks/TASK-0004-backup-restore-drill]].

## Цель

Восстановить backup в изолированный Supabase target и измерить фактические RPO/RTO.

## Что нельзя сломать

Production Supabase нельзя использовать как restore target; нельзя создавать платную branch без подтверждения стоимости.

## Текущий этап

Заблокировано: Free plan, PITR disabled, backups `0`, branches `0`. Guarded runbook и verifier готовы; нужен recoverable backup и изолированный target.
