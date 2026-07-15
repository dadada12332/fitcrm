-- 0036_platform_clubs_metrics.sql
-- Метрики клубов для списка Platform Admin — серверные агрегаты вместо вытягивания строк.
-- Старый код тянул все строки clients/visits через .in(club_id, ids) и упирался в лимит
-- PostgREST 1000 строк → у крупных клубов «Клиентов» = 0, «Активность» = «—».
-- RPC считает count/max агрегатами (быстро по индексам club_id), без лимита.
-- Идемпотентно.

create or replace function public.platform_clubs_metrics(p_ids uuid[])
returns table(
  club_id uuid,
  clients_count bigint,
  staff_count bigint,
  visits_30 bigint,
  last_activity timestamptz,
  last_payment timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    (select count(*) from public.clients cl where cl.club_id = c.id),
    (select count(*) from public.staff st where st.club_id = c.id and st.is_active),
    (select count(*) from public.visits v where v.club_id = c.id and v.checked_in_at >= now() - interval '30 days'),
    (select max(v.checked_in_at) from public.visits v where v.club_id = c.id),
    (select max(p.created_at) from public.payments p where p.club_id = c.id and p.status = 'paid')
  from public.clubs c
  where c.id = any(p_ids);
$$;

grant execute on function public.platform_clubs_metrics(uuid[]) to authenticated, service_role;
