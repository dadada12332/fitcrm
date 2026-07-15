-- ════════════════════════════════════════════════════════════════════════
-- 0048_support_realtime.sql — реалтайм для обращений поддержки.
-- Клиент (браузер, authenticated + RLS) подписывается на изменения своих
-- тикетов, чтобы моментально видеть ответы поддержки без перезагрузки.
-- ════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_tickets'
  ) then
    alter publication supabase_realtime add table public.support_tickets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table public.support_messages;
  end if;
end $$;
