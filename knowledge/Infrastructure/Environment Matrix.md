---
type: environment-matrix
updated: 2026-07-18
---

# Environment Matrix

| Environment | URL | Supabase project/region | Vercel region | Назначение | Deploy | Интеграции |
|---|---|---|---|---|---|---|
| local | `http://localhost:3000` | Из `.env.local`; не сохраняется / не проверено | local | Разработка | `npm run dev` | Зависит от локальных env |
| preview | Vercel-generated URL | Не проверено | `syd1` по `vercel.json` | Проверка веток/deploy | Vercel preview | Не проверено |
| staging | Нет подтверждённого URL | Не настроено или не проверено | Не проверено | Отдельная staging-среда отсутствует | Не проверено | Не проверено |
| production | `https://fitcrm-three.vercel.app` | Project/region не фиксируются в Vault; регион не проверен | `syd1` | Рабочая CRM | push `main`, затем alias при необходимости | Supabase, Telegram, Payme, Click; SMS/email не подтверждены |

Секретные project IDs, ключи и credentials намеренно не приводятся. Решение о регионах: [[../Decisions/ADR-0001-infrastructure-regions]].
