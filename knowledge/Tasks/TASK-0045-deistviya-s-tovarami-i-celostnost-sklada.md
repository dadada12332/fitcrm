---
id: TASK-0045
type: feature
status: completed
priority: P1
module: warehouse
created: 2026-07-22
updated: 2026-07-22
owner: unassigned
tags: [fitcrm, task]
---

# Действия с товарами и целостность склада

## Goal

Добавить действия на уровне строки товара и гарантировать согласованность остатков с журналом движений склада.

## Reason

Товар можно было создать, но нельзя было удалить из интерфейса; поставка и списание требовали повторного выбора товара. При аудите обнаружено, что приход записывался неверным enum-значением и мог отсутствовать в истории.

## Requirements

- Добавить меню `⋯` в последнюю колонку таблицы.
- Открывать поставку и списание с заранее выбранным товаром.
- Удалять товар мягко, сохраняя историю движений.
- Выполнять изменение остатка и запись движения атомарно.
- Соблюдать права `supply` и `writeoff`, desktop/mobile layout и дизайн-систему.

## Acceptance criteria

- [x] Поставка `5 → 7` и списание `7 → 6` записаны в БД одной транзакцией.
- [x] Удалённый товар не виден в складе/POS, движения сохранены.
- [x] Desktop/mobile browser QA прошёл без overflow и console errors.
- [x] Production deployment и smoke подтверждены.

## Files and data

- Files: `InventoryClient.tsx`, `WarehouseSwitcher.tsx`, warehouse actions и inventory types.
- Tables/RPC: `products`, `inventory`, `stock_movements`, `record_stock_supply`, `record_stock_writeoff`.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

Добавлено permission-aware dropdown-меню строки, предвыбор товара в дроверах, confirmation dialog удаления и адаптивная компоновка таблицы. Поставка/списание перенесены в service-only атомарные RPC; исправлен enum прихода `in` и учёт только активных товаров в тарифном лимите.

## Verification

Локально: TypeScript, ESLint, 142 tests и production build прошли. Browser QA проверил полный цикл и mobile overflow 0; RPC probe подтвердил `in`/`writeoff` и итоговый остаток. Миграции 0080–0081 применены к production.

Production deployment `dpl_Bf8BcGRMmRG1VQwkpbMGcY1VLa71` (`9106080`) READY и привязан к `fitcrm-three.vercel.app`. На домене повторно пройден цикл `5 → 7 → 6 → удалён`; soft delete и движения подтверждены прямым чтением БД, desktop/mobile overflow равен 0, тестовые товары удалены.

## Remaining

Нет.

## Blockers

Нет.
