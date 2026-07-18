---
type: research
status: accepted
date: 2026-07-18
module: ai-analytics
tags: [fitcrm, research, ai, analytics, ux]
---

# AI Analytics References

## Источники

- [Command AI — Chat Analytics](https://command.ai/docs/copilot/analytics/chat-analytics/): иерархия от общего результата к сессиям и источникам.
- [Intercom — Measure customer service with AI Insights](https://www.intercom.com/help/en/articles/10576273-measure-customer-service-with-ai-insights-built-for-the-ai-agent-era): proactive insights, тренды и recommendations рядом с метриками.
- [Fin Insights](https://fin.ai/updates/fin-insights): автоматическое выявление тем и переход от наблюдения к действию.
- [Fin Analyze](https://fin.ai/analyze): единое рабочее место для анализа качества и операционных показателей.

## Принятые принципы

1. Сначала показывать живую операционную сводку, затем разговорный интерфейс и детализацию.
2. Каждый insight должен вести к проверяемым данным или существующему CRM-разделу.
3. Частые запросы должны быть детерминированными и быстрыми; LLM нужен для свободного языка, а не для вычисления KPI.
4. Источник и период результата должны быть видны рядом с карточкой.
5. AI не должен выполнять необратимые действия без отдельного permission и confirmation flow.

## Что не копировали

Визуальный язык чужих продуктов не переносился. Компоновка реализована токенами FitCRM, shadcn primitives и текущими CRM-паттернами.
