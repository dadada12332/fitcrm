---
id: TASK-0003
type: security
status: in-progress
priority: P1
module: quality
created: 2026-07-18
updated: 2026-07-18
owner: Codex
tags: [fitcrm, testing, security]
---

# Автоматизировать критические пользовательские сценарии

## Goal

Создать повторяемые проверки auth/onboarding, tenant isolation, клиента, абонемента, check-in и платежного callback.

## Acceptance criteria

- Тесты не используют production PII и очищают созданные данные.
- Минимум один негативный тест доказывает изоляцию двух клубов.
- Локальная команда документирована; CI добавляется только при наличии безопасных GitHub permissions.
- Testing Matrix обновлена фактическими результатами.
