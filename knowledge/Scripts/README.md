# Knowledge automation

Все команды запускаются из корня репозитория.

| Команда | Назначение |
|---|---|
| `npm run docs:daily` | Создать или обновить Daily за сегодня |
| `npm run docs:weekly` | Создать или обновить Weekly Review |
| `npm run docs:task -- "Название"` | Создать task-файл со следующим ID |
| `npm run docs:close-task -- TASK-0001` | Закрыть и архивировать задачу |
| `npm run docs:adr -- "Название"` | Создать ADR и обновить индекс |
| `npm run docs:incident -- "Название"` | Создать postmortem |
| `npm run docs:changelog` | Обновить список commit-кандидатов |
| `npm run docs:handoff` | Обновить краткий AI Handoff |
| `npm run docs:index` | Обновить индекс всех заметок Vault |
| `npm run docs:validate` | Проверить структуру, ссылки, frontmatter, ID и секреты |
| `npm run docs:sync` | Обновить Daily, state, Kanban, changelog, handoff и индексы |
| `npm run docs:hooks` | Один раз подключить безопасный pre-commit hook |

Скрипты идемпотентны. Существующие заметки не пересоздаются, а автоматизация изменяет только секции с маркерами `AUTO:START` и `AUTO:END`.

Daily не создаётся без признаков работы в Git: commits за день или изменённые файлы. Для принудительного создания используется `npm run docs:daily -- --force`.
