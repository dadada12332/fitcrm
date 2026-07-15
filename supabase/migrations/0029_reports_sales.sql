-- 0029_reports_sales.sql
-- Серверная агрегация вкладки «Продажи» отчётов (Stage 2).
-- Возвращает ровно те агрегаты, что раньше считались в браузере из массива оплат:
--   sold          = число оплаченных платежей за период (payments.length)
--   totalRevenue  = сумма оплат за период
--   byService     = группировка по тарифу (subscriptions→memberships.name; null → «Без абонемента»)
-- Идемпотентно.

create or replace function public.reports_sales(
  p_club_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql stable security definer set search_path = public as $$
  with paid as (
    select pay.amount, coalesce(m.name, 'Без абонемента') as service
    from public.payments pay
    left join public.subscriptions s on s.id = pay.subscription_id
    left join public.memberships m on m.id = s.membership_id
    where pay.club_id = p_club_id and pay.status = 'paid'
      and pay.paid_at >= p_from and pay.paid_at <= p_to
  )
  select jsonb_build_object(
    'sold', (select count(*) from paid),
    'totalRevenue', coalesce((select sum(amount) from paid), 0),
    'byService', coalesce((
      select jsonb_agg(jsonb_build_object('name', service, 'count', cnt, 'revenue', rev) order by rev desc)
      from (
        select service, count(*) as cnt, sum(amount) as rev
        from paid group by service
      ) g), '[]'::jsonb)
  );
$$;

grant execute on function public.reports_sales(uuid, timestamptz, timestamptz) to authenticated, service_role;
