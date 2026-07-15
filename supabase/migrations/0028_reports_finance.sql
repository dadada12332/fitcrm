-- 0028_reports_finance.sql
-- Серверная агрегация вкладки «Финансы» отчётов (Stage 1).
-- Возвращает ровно те агрегаты, что раньше считались в браузере из массива оплат.
-- Идемпотентно.

create or replace function public.reports_finance(
  p_club_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_prev_from timestamptz,
  p_prev_to timestamptz
)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'revenue', coalesce((
      select sum(amount) from public.payments
      where club_id = p_club_id and status = 'paid' and paid_at >= p_from and paid_at <= p_to), 0),
    'count', (
      select count(*) from public.payments
      where club_id = p_club_id and status = 'paid' and paid_at >= p_from and paid_at <= p_to),
    'prevRevenue', coalesce((
      select sum(amount) from public.payments
      where club_id = p_club_id and status = 'paid' and paid_at >= p_prev_from and paid_at < p_prev_to), 0),
    'byProvider', coalesce((
      select jsonb_agg(jsonb_build_object('provider', provider, 'amount', amt) order by amt desc)
      from (
        select provider::text as provider, sum(amount) as amt
        from public.payments
        where club_id = p_club_id and status = 'paid' and paid_at >= p_from and paid_at <= p_to
        group by provider::text
      ) x), '[]'::jsonb),
    'byDay', coalesce((
      select jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'amount', amt) order by d)
      from (
        select gs::date as d, coalesce(sum(p.amount), 0) as amt
        from generate_series(p_from::date, p_to::date, interval '1 day') gs
        left join public.payments p
          on p.club_id = p_club_id and p.status = 'paid'
         and p.paid_at >= p_from and p.paid_at <= p_to
         and p.paid_at::date = gs::date
        group by gs::date
      ) y), '[]'::jsonb)
  );
$$;

grant execute on function public.reports_finance(uuid, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated, service_role;
