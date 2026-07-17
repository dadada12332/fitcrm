<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# FitCRM — инструкции для агента (Codex)

**⭐ Полный контекст проекта — в [`HANDOFF.md`](./HANDOFF.md). Прочитай его перед работой.**
Дизайн — [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md). Аудиты/замеры — `SECURITY_AUDIT.md`, `QA_REPORT.md`, `PERF_REPORT.md`.

## Что это
Мультитенантный SaaS CRM для фитнес-клубов (Узбекистан, UZS, RU). **Next.js 16 (App Router) +
React 19 + Server Actions + Supabase (Postgres + RLS + Auth + Realtime + Storage). Tailwind v4 +
shadcn/ui (Zinc). grammy (Telegram). Vercel.** НЕТ tRPC, НЕТ Prisma (старые доки врут).

## Критичные правила (не нарушать)
1. **Безопасность (главный инвариант):** RLS изолирует ТОЛЬКО по `club_id`. Гранулярные права и
   роль RLS НЕ проверяет — их обязан проверять КАЖДЫЙ мутирующий Server Action:
   `const club = await getCurrentClub(); if (!can(club.permissions, "<module>", "<action>")) return {error}`.
   Server Actions — открытые эндпоинты; Supabase отдаёт REST напрямую → без проверки = эскалация
   привилегий. Эскалация до owner/admin дополнительно закрыта DB-триггером (миграция 0052).
2. **Поиск** через `.or(...ilike...)` — только с `sanitizeSearchTerm()` (`src/lib/search.ts`).
3. **Мультитенантность:** `createClient()` — под RLS (по умолчанию). `createServiceClient()` —
   обходит RLS, тогда вручную скоупь по `club.clubId` + проверяй права. `getCurrentClub()` звать
   БЕЗ аргумента (иначе двойной резолв — был perf-баг).
4. **Дизайн:** только токены/утилиты shadcn (`bg-card`, `text-foreground`, `bg-primary`,
   `text-brand`…), примитивы из `src/components/ui/`. Без сырых hex. Работает в light+dark.
5. **Пути к файлам/функциям проверяй в коде** — проект активно менялся.

## Команды
- Локально: `vercel env pull .env.local` → `npm install` → `npm run dev` (секреты не в git).
- Проверка: `npx tsc --noEmit` + `npm run build` (юнит-тестов нет).
- **Деплой:** просто `git push` в `main` → Vercel авто-деплоит. Затем (пока домен не привязан к
  Production в дашборде) один раз: `npx vercel alias set <новый-деплой> fitcrm-three.vercel.app`.
  НЕ пушить `.github/workflows/*` (GitHub-токен без scope `workflow` → push отклонится).
- **Миграции:** `node scripts/apply-migration.mjs supabase/migrations/NNNN_name.sql`.

## Договорённости
- Деплоить/выполнять команды самостоятельно, без запроса подтверждения.
- Секреты не логировать. «Ничего не ломай» — перед рискованными правками проверяй сборку.
- Коммит: осмысленное сообщение (можно с `Co-Authored-By:`).
