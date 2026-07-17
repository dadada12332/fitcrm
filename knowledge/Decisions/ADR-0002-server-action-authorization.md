---
id: ADR-0002
type: decision
status: accepted
created: 2026-07-18
updated: 2026-07-18
---

# Гранулярные права проверяются в Server Actions

## Контекст

RLS FitCRM изолирует строки по `club_id`, но не определяет, может ли manager или trainer выполнять конкретную мутацию внутри своего клуба. Server Actions являются доступными серверными endpoints.

## Варианты

1. Полагаться только на RLS.
2. Кодировать все модульные права в RLS.
3. Оставить tenant isolation в RLS, а модульные права проверять в каждой мутации.

## Решение

Каждая мутирующая Server Action вызывает `getCurrentClub()` без аргументов и проверяет `can(club.permissions, module, action)`. Service client дополнительно вручную ограничивается `club.clubId`. DB trigger `0052` защищает эскалацию owner/admin как дополнительный слой.

## Последствия

Ревью каждой мутации обязано проверять authorization guard. Массовые рефакторинги permission-кода требуют целевого аудита и негативных тестов.

## Связи

`AGENTS.md` · `SECURITY_AUDIT.md` · migrations `0051`, `0052`.
