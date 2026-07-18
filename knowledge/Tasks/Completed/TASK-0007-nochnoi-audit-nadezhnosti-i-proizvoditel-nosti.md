---
id: TASK-0007
type: security
status: completed
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

- [x] Каждое исправление подтверждено кодом или измерением.
- [x] Security boundaries покрыты тестами или targeted verification.
- [x] Полный test/build suite проходит.
- [x] Улучшения разделены на обратимые коммиты и записаны в Vault.

## Files and data

- Files: payment callbacks, monitoring, dependencies и найденные соседние модули.
- Tables/RPC: только существующие схемы; production migrations не планируются.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

- Click/Payme/post-payment/reconciliation service-role queries получили явный `club_id` scope.
- Telegram callback проверки не позволяют отметить посещение для клиента другого клуба; scheduled broadcasts scoped по клубу.
- Platform Monitoring больше не выдаёт непроверенные сервисы за healthy и различает live check/configured/not configured/error.
- Публичные security claims синхронизированы с подтверждённым Sydney topology.
- Уязвимый `xlsx` удалён; импорт XLSX и генерация шаблона переведены на уже используемый ExcelJS.
- `npm audit`: high `2 -> 0`, critical `0`; Hono обновлён безопасным non-breaking fix.

## Verification

- Vitest: 85 passed, 1 opt-in integration skipped без isolated test DB.
- Playwright baseline: 20/20 desktop/mobile auth и routing checks passed; после cron fix suite расширен до 26/26.
- `npx tsc --noEmit`: passed на чистом `.next`.
- Next.js production build: passed, 53 страницы сгенерированы, exit 0.
- Documentation validation: 38 notes, 10 unique IDs, passed.
- `npm audit`: 0 high, 0 critical, 4 moderate transitive advisories.

## Remaining

Commit/push и production deploy verification.

## Blockers

Нет.
