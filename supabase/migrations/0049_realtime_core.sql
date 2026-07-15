-- ════════════════════════════════════════════════════════════════════════
-- 0049_realtime_core.sql — шина мгновенной синхронизации (Instant UI).
-- Ключевые club-scoped таблицы в publication supabase_realtime: любое изменение
-- (ручное, из AI, с другого устройства, из Platform Admin) прилетает во все
-- открытые страницы клуба → RealtimeProvider делает дебаунс-router.refresh().
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  tbls text[] := array['clients','subscriptions','payments','visits','inventory','products','staff','clubs'];
begin
  foreach t in array tbls loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I;', t);
    end if;
  end loop;
end $$;
