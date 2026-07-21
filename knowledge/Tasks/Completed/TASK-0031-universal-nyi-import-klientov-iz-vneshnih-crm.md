---
id: TASK-0031
type: feature
status: completed
priority: P1
module: clients-import
created: 2026-07-21
updated: 2026-07-21
owner: codex
tags: [fitcrm, task]
---

# Универсальный импорт клиентов из внешних CRM

## Goal

Импортировать CSV/XLSX из разных CRM без потери неизвестных полей, опасного затирания карточек и дублей из-за различного форматирования телефона.

## Reason

Старый мастер доверял client-side списку дублей, сравнивал сырой телефон, терял неизвестные колонки и при обновлении заменял отсутствующие значения на `null`/`0`.

## Requirements

- Поддерживать CSV с запятыми, точкой с запятой, tab/pipe, escaped quotes и многострочными ячейками.
- Находить строку заголовков после служебной шапки выгрузки и различать повторяющиеся имена колонок.
- Нормализовать телефон, email, даты, денежные форматы и целые значения повторно на сервере.
- Определять дубль по нормализованному телефону или email и отклонять конфликт двух разных карточек.
- При update изменять только присутствующие в импорте поля.
- Сохранять непустые нераспознанные значения в `clients.import_data` и показывать их в карточке.
- Изолировать ошибки отдельных строк и явно показывать ошибки связанных сущностей.

## Acceptance criteria

- [x] Некорректная строка не отменяет импорт корректных строк пакета.
- [x] Повторный update не очищает отсутствующие email, даты, заметки, баланс и долг.
- [x] Телефоны разных форматов и email разного регистра сопоставляются с одной карточкой.
- [x] Неизвестные поля сохраняются структурированно и видны в карточке клиента.
- [x] Запросы и мутации явно ограничены `club_id`, action проверяет create/edit permissions.
- [x] TypeScript, lint, unit/security tests и production build проходят.

## Files and data

- Files: `src/lib/client-import.ts`, `src/lib/import-wizard.ts`, `src/components/app/ImportWizard.tsx`, `src/app/(app)/clients/import-actions.ts`, `src/lib/client-profile.ts`, `src/components/app/ClientProfileCard.tsx`.
- Tables/RPC: `clients.import_data`, generated `clients.email_normalized`, index `idx_clients_club_email_normalized`.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

- Добавлен устойчивый CSV parser и распознавание header row.
- Дедупликация и валидация перенесены на сервер; входные подсказки браузера больше не определяют мутацию.
- Bulk insert рекурсивно изолирует ошибочные строки и сопоставляет `RETURNING` через уникальный import key.
- Partial update сохраняет существующие значения, если соответствующей колонки нет в файле.
- Дубликаты внутри файла объединяются для update или пропускаются для skip.
- Тренеры связываются только по точному нормализованному имени; неоднозначный fuzzy match удалён.
- Остаток посещений при обновлении переводится в `visits_total = visits_used + remaining`.
- Повторный last visit сравнивается по timestamp, а не блокируется наличием любой истории.

## Verification

- `npx tsc --noEmit` — passed.
- `npm run lint -- --max-warnings=0` — passed.
- `npm test` — 118 passed, 1 skipped.
- `npm run build` — passed.
- Миграция `0075_client_import_data.sql` применена в Supabase.

## Remaining

Production browser QA и deploy фиксируются после push.

## Blockers

Нет.
