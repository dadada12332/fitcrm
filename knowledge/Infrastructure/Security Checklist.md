---
type: checklist
area: security
updated: 2026-07-18
---

# Security Checklist

- [ ] RLS включён и tenant isolation проверен для каждой exposed таблицы.
- [ ] Каждая мутирующая Server Action проверяет `getCurrentClub()` и `can(...)`.
- [ ] Service-role вызовы вручную ограничены `club.clubId`.
- [ ] Поисковые `.or(...ilike...)` используют `sanitizeSearchTerm()`.
- [ ] Webhook подписи, replay/idempotency и rate limits проверены.
- [ ] Auth redirect/cookies и password recovery проверены на production domain.
- [ ] Секреты находятся только в Vercel/Supabase env и не выводятся в логи.
- [ ] Audit logs покрывают административные и финансовые изменения.
- [ ] Backup существует, restore выполнен на изолированном окружении.
- [ ] Platform impersonation имеет аудит и минимальный срок жизни.
- [ ] Миграция не добавляет небезопасный `SECURITY DEFINER` или открытый grant.
