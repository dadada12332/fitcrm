---
type: research
status: active
updated: 2026-07-19
tags: [fitcrm, research, crm, retention, leads]
---

# Competitive CRM research — 2026-07-19

## Цель

Сравнить FitCRM с доступными fitness CRM и региональными CRM, выделить повторяющиеся продуктовые паттерны и выбрать безопасную для локального прототипа функцию.

## Проверенные официальные источники

| Решение | Наблюдаемый акцент | Ссылка |
| --- | --- | --- |
| Gymdesk | Lead capture, pipeline, follow-up, источники и conversion tracking | https://gymdesk.com/features/lead-management |
| Mindbody | Настраиваемая воронка, задачи, timeline касаний и аналитика | https://www.mindbodyonline.com/en-gb/business/lead-management |
| Glofox | Capture/nurture лидов и связанный fitness lifecycle | https://www.glofox.com/llm-info/ |
| Virtuagym | Lead management, retention tools, community и challenges | https://business.virtuagym.com/ |
| PerfectGym | At-risk members, predictive sales insights и поведенческие сигналы | https://www.perfectgym.com/en/solutions/gym-management-software |
| Zen Planner | Engagement tracking, автоматические коммуникации и churn prevention | https://zenplanner.com/blogs/choosing-the-best-gym-management-software-for-member-retention/ |
| UZFIT | Абонементы, клиенты, посещения, платежи, аналитика и помощь с запуском | https://uzfit.uz/crm |
| FitBase Uzbekistan | Задачи, роли, приложение, формы сайта и мессенджеры | https://fitbase.uz/capabilities |
| FitBase Kazakhstan | Лиды из нескольких каналов, воронка, автозадачи и коммуникации | https://fitbase.kz/ |
| Umai CRM | Kanban лидов, омниканальность и локальные интеграции | https://www.umaicrm.kz/ |
| LuckyFit | Захват лидов, задачи, аналитика и контроль доступа | https://lucky-fit.com/ru/ |

## Выводы

1. Главный стратегический пробел FitCRM — полноценный presale lead pipeline: источник, стадия, ответственный, следующее действие, история касаний, причина потери и conversion analytics.
2. Второй повторяющийся паттерн — не просто отчетность, а actionable retention: система сама выделяет риск, объясняет его и ведет к следующему действию.
3. Региональные продукты продают не только список модулей, но и локальную адаптацию, внедрение, коммуникации и быстрый старт.
4. FitCRM уже имеет достаточно данных для retention MVP без новой схемы: срок абонемента, посещения, долг, заморозка и цена.

## Решение для текущей ветки

Реализовать `Удержание BETA` как schema-free read-only очередь на существующих данных. Это позволяет проверить ценность на localhost без миграции общей Supabase и без риска для production.

Полноценную воронку лидов вынести в отдельную задачу после согласования модели данных. Для нее нужны как минимум сущности lead, stage history, activity/next action, source, loss reason и ownership с tenant-scoped RLS.

## Позиционирование

FitCRM можно продавать как операционную систему клуба для локального рынка: ежедневные действия владельца, Telegram/Instagram-коммуникации, локальные платежи и контроль удержания в одном интерфейсе. Новый центр удержания усиливает обещание `CRM показывает не только что произошло, но и кому нужно уделить внимание сегодня`.

## Ограничения исследования

Проверены публичные продуктовые страницы, а не платные аккаунты конкурентов. Конкретная глубина функций, качество UX и тарифные ограничения требуют отдельного hands-on benchmark.
