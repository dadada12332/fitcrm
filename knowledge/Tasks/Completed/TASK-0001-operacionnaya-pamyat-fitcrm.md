---
id: TASK-0001
type: documentation
status: completed
priority: P2
module: documentation
created: 2026-07-18
updated: 2026-07-18
owner: Codex
tags: [fitcrm, documentation]
---

# TASK-0001 — Операционная память FitCRM

## Цель

Создать внутри репозитория компактный Obsidian Vault, который сохраняет текущее состояние, задачи, решения и handoff между AI-сессиями и компьютерами.

## Причина

Контекст распределён между большими корневыми документами и историей чатов; старые документы частично противоречат коду.

## Требования и acceptance criteria

- Vault читается без плагинов в Obsidian и GitHub.
- Daily, задачи, ADR, incidents и handoff управляются командами.
- Автоматизация идемпотентна и меняет только AUTO-секции.
- Ссылки, frontmatter и ID валидируются.
- Секреты не попадают в Vault.

## Затронуто

- Файлы: `/knowledge`, `AI_WORKFLOW.md`, `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `package.json`, `.githooks/pre-commit`.
- Таблицы/RPC: не изменяются.

## Что нельзя сломать

Production-код, существующую документацию, персональный Obsidian Vault и незакоммиченные изменения пользователя.

## Изменения

<!-- AUTO:START task-progress -->
Vault, операционные документы, lifecycle-команды, validation и AI workflow реализованы. Smoke lifecycle task/ADR/incident успешно проверен.
<!-- AUTO:END task-progress -->

## Проверки

- `npm run docs:sync` — выполнено.
- `npm run docs:weekly` — выполнено.
- Task create/close, ADR create и incident create — выполнены на временных smoke-записях.
- `npm run docs:validate` — пройдено; остаются только ожидаемые предупреждения по историческим документам.

## Осталось

Нет действий в рамках TASK-0001. Следующие самостоятельные работы находятся в Kanban.

## Блокеры

Нет. Регион Supabase фиксируется как неподтверждённый факт.
