---
id: TASK-0004
type: infrastructure
status: backlog
priority: P1
module: database
created: 2026-07-18
updated: 2026-07-18
owner: unassigned
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
