---
type: current-task
status: review
active_task: TASK-0022
updated: 2026-07-19
tags: [fitcrm, tasks]
---

# TASK-0022 — Центр удержания клиентов

Источник задачи: [[Tasks/TASK-0022-centr-uderzhaniya-klientov-i-predotvrascheniya-ottoka]].

## Цель

Проверить на localhost новый раздел удержания, который превращает существующие сигналы абонементов, посещений и долгов в рабочую очередь.

## Что нельзя сломать

Tenant isolation, permissions, карточку клиента, существующие отчеты и production. До одобрения владельца deploy запрещен.

## Текущий этап

Реализация, локальная UI-проверка, TypeScript, unit, e2e и build завершены. Ветка готова к продуктовой проверке владельцем; production не изменен.

## Следующий шаг

Владелец проверяет `/retention` на localhost и решает: калибровать правила, одобрить deploy или вернуть задачу в работу.
