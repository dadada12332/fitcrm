-- ============================================================
-- Supabase → SQL Editor → Run (проект bqnhslauxvukejtquavp)
-- Серверная пагинация «Оплаты» + «Посещения». Идемпотентно.
-- ============================================================

create index if not exists idx_payments_club_created on public.payments(club_id, created_at desc);
create index if not exists idx_visits_club_checkedin on public.visits(club_id, checked_in_at desc);

create or replace function public.payments_page(
  p_club_id uuid, p_search text default null, p_from timestamptz default null,
  p_provider text default null, p_status text default null,
  p_sort text default null, p_limit int default 50, p_offset int default 0
)
returns table (
  id uuid, client_id uuid, client_name text, client_phone text, service_name text,
  amount numeric, provider text, status text, paid_at timestamptz, created_at timestamptz,
  total_count bigint, total_amount numeric
)
language sql stable security definer set search_path = public as $$
  with base as (
    select p.id, p.client_id, cl.full_name as client_name, cl.phone as client_phone,
      m.name as service_name, p.amount, p.provider::text as provider, p.status::text as status,
      p.paid_at, p.created_at
    from public.payments p
    left join public.clients cl on cl.id = p.client_id
    left join public.subscriptions sub on sub.id = p.subscription_id
    left join public.memberships m on m.id = sub.membership_id
    where p.club_id = p_club_id
      and (p_from is null or coalesce(p.paid_at, p.created_at) >= p_from)
      and (p_provider is null or p_provider = '' or p.provider::text = p_provider)
      and (p_status is null or p_status = '' or p.status::text = p_status)
      and (p_search is null or p_search = '' or cl.full_name ilike '%' || p_search || '%' or m.name ilike '%' || p_search || '%')
  )
  select b.id, b.client_id, b.client_name, b.client_phone, b.service_name,
    b.amount, b.provider, b.status, b.paid_at, b.created_at,
    count(*) over () as total_count, coalesce(sum(b.amount) over (), 0) as total_amount
  from base b
  order by
    case when p_sort = 'amount_desc' then b.amount end desc,
    case when p_sort = 'amount_asc' then b.amount end asc,
    case when p_sort = 'created_asc' then b.created_at end asc,
    b.created_at desc
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
$$;
grant execute on function public.payments_page(uuid, text, timestamptz, text, text, text, int, int) to authenticated, service_role;

create or replace function public.visits_page(
  p_club_id uuid, p_search text default null,
  p_from timestamptz default null, p_to timestamptz default null,
  p_status text default null, p_sort text default null, p_limit int default 50, p_offset int default 0
)
returns table (
  id uuid, client_id uuid, client_name text, client_phone text, checked_in_at timestamptz,
  membership_name text, sub_status text, days_left int, visits_left int, total_count bigint
)
language sql stable security definer set search_path = public as $$
  with base as (
    select v.id, v.client_id, cl.full_name as client_name, cl.phone as client_phone, v.checked_in_at,
      m.name as membership_name, sub.status::text as sub_status,
      case when sub.expires_at is not null then (sub.expires_at - current_date)::int end as days_left,
      case when sub.visits_total is not null then sub.visits_total - sub.visits_used end as visits_left
    from public.visits v
    left join public.clients cl on cl.id = v.client_id
    left join public.subscriptions sub on sub.id = v.subscription_id
    left join public.memberships m on m.id = sub.membership_id
    where v.club_id = p_club_id
      and (p_from is null or v.checked_in_at >= p_from)
      and (p_to is null or v.checked_in_at <= p_to)
      and (p_search is null or p_search = '' or cl.full_name ilike '%' || p_search || '%')
  ),
  bucketed as (
    select *, case
      when sub_status is null or sub_status = 'expired' then 'expired'
      when (days_left is not null and days_left <= 5) or (visits_left is not null and visits_left <= 3) then 'ending'
      else 'active' end as status_bucket
    from base
  )
  select id, client_id, client_name, client_phone, checked_in_at, membership_name, sub_status,
    days_left, visits_left, count(*) over () as total_count
  from bucketed
  where (p_status is null or p_status = '' or p_status = 'all' or status_bucket = p_status)
  order by
    case when p_sort = 'checked_asc' then checked_in_at end asc,
    checked_in_at desc
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
$$;
grant execute on function public.visits_page(uuid, text, timestamptz, timestamptz, text, text, int, int) to authenticated, service_role;
