---
id: TASK-0004
type: infrastructure
status: blocked
priority: P1
module: database
created: 2026-07-18
updated: 2026-07-18
owner: Codex
tags: [fitcrm, database, reliability]
---

# Провести backup/restore drill

## Goal

Подтвердить доступность резервной копии и восстановить её в изолированное окружение без воздействия на production.

## Acceptance criteria

- Зафиксированы фактические RPO/RTO и ответственный.
- Restore проверен на схеме, auth-связях, storage metadata и критических выборках.
- Секреты и пользовательские данные не попали в документацию.
- Создана операционная инструкция и rollback checklist.

## Result

- Management API проверен: Free plan, PITR disabled, available backups `0`, branches `0`.
- Безопасный count-only baseline снят для schema/Auth/Storage и критических доменов, PII не извлекалась.
- Созданы [[../Infrastructure/Backup and Restore Runbook]] и `scripts/verify-restore.mjs`, который отказывается работать с configured production URL.
- RPO фактически не ограничен, RTO не измерен. Ответственный: platform owner.

## Blocker

Acceptance criteria restore drill не может быть честно закрыт без recoverable backup и изолированного target. Платную Supabase branch/project нельзя создавать без отдельного cost confirmation; in-place restore production запрещён как тест. После upgrade/подтверждения стоимости выполнить runbook и перевести task обратно в progress.
