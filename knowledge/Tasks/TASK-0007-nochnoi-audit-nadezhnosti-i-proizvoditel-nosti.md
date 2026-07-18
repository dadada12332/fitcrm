---
id: TASK-0007
type: security
status: in-progress
priority: P1
module: platform
created: 2026-07-18
updated: 2026-07-18
owner: Codex
tags: [fitcrm, security, performance, reliability]
---

# Ночной аудит надёжности и производительности

## Goal

Найти и исправить наиболее ценные подтверждённые проблемы после выполнения основного списка и AI redesign, сохраняя атомарный rollback.

## Reason

Пользователь делегировал ночной самостоятельный аудит и разрешил сильные решения при условии лёгкого отката.

## Requirements

- Проверить service-role queries на ручной tenant scope.
- Убрать вводящие в заблуждение operational health states.
- Снизить подтверждённые high-risk dependency advisories без force upgrades.
- Не добавлять крупный модуль без доказанной продуктовой ценности.

## Acceptance criteria

- [ ] Каждое исправление подтверждено кодом или измерением.
- [ ] Security boundaries покрыты тестами или targeted verification.
- [ ] Полный test/build suite проходит.
- [ ] Улучшения разделены на обратимые коммиты и записаны в Vault.

## Files and data

- Files: payment callbacks, monitoring, dependencies и найденные соседние модули.
- Tables/RPC: только существующие схемы; production migrations не планируются.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

Начат code/dependency audit.

## Verification

Не проверено.

## Remaining

Audit, targeted fixes, full verification и deploy.

## Blockers

Нет.
