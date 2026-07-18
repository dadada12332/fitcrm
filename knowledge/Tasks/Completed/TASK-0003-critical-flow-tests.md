---
id: TASK-0003
type: security
status: completed
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

## Result

- Добавлены Vitest unit/security проверки: 80 passed, 1 opt-in integration test skipped без отдельной test DB.
- Добавлены Playwright smoke-тесты публичных auth и protected routes: 20/20 desktop + Pixel 7.
- Исправлен реальный redirect-баг `/forgot-password` и открыт recovery route `/reset-password`.
- Live RLS drill выполнен внутри rollback-транзакции без PII и сохранения данных: свой клуб `1`, чужие reads `0`, чужие updates `0`.
- Все 38 production-таблиц `public` подтверждены с RLS.
- Security Advisor обнаружил публичные `SECURITY DEFINER` RPC; миграция `0055_harden_public_rpcs.sql` применена и проверена: `anon_definer_executable = 0`.
- CI workflow намеренно не добавлялся из-за ограничения GitHub token на `.github/workflows/*`.

## Remaining gaps

- Полный data-mutating E2E для client/membership/check-in и эмуляция Click/Payme callbacks требуют отдельного staging/local Supabase.
- Opt-in tenant test запускается после заполнения `E2E_*` переменных и `E2E_ALLOW_REMOTE_TEST_DATABASE=true`.
