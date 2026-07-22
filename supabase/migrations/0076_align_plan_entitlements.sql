-- Real product entitlements controlled from Platform Admin.
-- Idempotent: safe to re-run after editing a plan manually.

update public.plans set
  description = case code
    when 'trial' then 'Полный доступ к основным возможностям FitCRM на 14 дней'
    when 'starter' then 'Операционная CRM для небольшого клуба или студии'
    when 'standard' then 'Автоматизация роста, удержания и коммуникаций клуба'
    when 'business' then 'Расширенный контур для крупных клубов и сетей'
    else description end,
  landing_subtitle = case code
    when 'trial' then 'Проверьте FitCRM на данных своего клуба'
    when 'starter' then 'Клиенты, оплаты и ежедневные операции'
    when 'standard' then 'Главный тариф для растущего клуба'
    when 'business' then 'Больше масштаба, лимитов и интеграций'
    else landing_subtitle end,
  landing_benefits = case code
    when 'trial' then '["14 дней без оплаты","До 100 клиентов","3 сотрудника","AI и Growth OS на пробу","Telegram и база знаний"]'::jsonb
    when 'starter' then '["До 1 000 клиентов","5 сотрудников","Оплаты, склад и отчёты","Telegram-бот и автонапоминания","Импорт и экспорт данных"]'::jsonb
    when 'standard' then '["До 5 000 клиентов","15 сотрудников и 3 филиала","AI Аналитика и Growth OS","Удержание и готовые сценарии","Рассылки и расширенные отчёты"]'::jsonb
    when 'business' then '["До 20 000 клиентов","50 сотрудников и 10 филиалов","Повышенные лимиты AI и Telegram","Instagram и все готовые интеграции","Приоритетная поддержка"]'::jsonb
    else landing_benefits end,
  updated_at = now()
where code in ('trial','starter','standard','business');

with feature_matrix(code, feature_key, enabled) as (
  values
    ('trial','crm',true),('trial','reports',true),('trial','finance',true),('trial','warehouse',true),('trial','telegram',true),('trial','broadcasts',true),('trial','email',false),('trial','sms',false),('trial','push',false),('trial','ai',true),('trial','knowledge',true),('trial','import',true),('trial','export',true),('trial','multi_branch',false),('trial','instagram',false),('trial','api',false),('trial','platform_api',false),('trial','white_label',false),('trial','retention',true),('trial','growth',true),('trial','inbox',true),('trial','telegram_automation',true),('trial','payment_integrations',true),('trial','advanced_reports',true),
    ('starter','crm',true),('starter','reports',true),('starter','finance',true),('starter','warehouse',true),('starter','telegram',true),('starter','broadcasts',false),('starter','email',false),('starter','sms',false),('starter','push',false),('starter','ai',false),('starter','knowledge',true),('starter','import',true),('starter','export',true),('starter','multi_branch',false),('starter','instagram',false),('starter','api',false),('starter','platform_api',false),('starter','white_label',false),('starter','retention',true),('starter','growth',false),('starter','inbox',true),('starter','telegram_automation',true),('starter','payment_integrations',true),('starter','advanced_reports',false),
    ('standard','crm',true),('standard','reports',true),('standard','finance',true),('standard','warehouse',true),('standard','telegram',true),('standard','broadcasts',true),('standard','email',false),('standard','sms',false),('standard','push',false),('standard','ai',true),('standard','knowledge',true),('standard','import',true),('standard','export',true),('standard','multi_branch',true),('standard','instagram',false),('standard','api',false),('standard','platform_api',false),('standard','white_label',false),('standard','retention',true),('standard','growth',true),('standard','inbox',true),('standard','telegram_automation',true),('standard','payment_integrations',true),('standard','advanced_reports',true),
    ('business','crm',true),('business','reports',true),('business','finance',true),('business','warehouse',true),('business','telegram',true),('business','broadcasts',true),('business','email',false),('business','sms',false),('business','push',false),('business','ai',true),('business','knowledge',true),('business','import',true),('business','export',true),('business','multi_branch',true),('business','instagram',true),('business','api',false),('business','platform_api',false),('business','white_label',false),('business','retention',true),('business','growth',true),('business','inbox',true),('business','telegram_automation',true),('business','payment_integrations',true),('business','advanced_reports',true)
)
insert into public.plan_features(plan_id, feature_key, enabled)
select p.id, m.feature_key, m.enabled from feature_matrix m join public.plans p using(code)
on conflict(plan_id, feature_key) do update set enabled = excluded.enabled;

with section_matrix(code, section_key, enabled) as (
  select p.code, key, case
    when p.code = 'starter' and key in ('broadcasts','ai','growth') then false
    when p.code in ('trial','starter','standard','business') then true
    else false end
  from public.plans p
  cross join unnest(array['dashboard','clients','visits','payments','memberships','schedule','warehouse','reports','staff','integrations','broadcasts','ai','knowledge','settings','retention','growth','inbox']) key
  where p.code in ('trial','starter','standard','business')
)
insert into public.plan_sections(plan_id, section_key, enabled)
select p.id, m.section_key, m.enabled from section_matrix m join public.plans p using(code)
on conflict(plan_id, section_key) do update set enabled = excluded.enabled;

with limit_matrix(code, limit_key, limit_value) as (
  values
    ('trial','clients',100::bigint),('trial','staff',3),('trial','branches',1),('trial','products',50),('trial','users',3),('trial','roles',3),('trial','integrations',2),('trial','ai_requests',20),('trial','telegram_messages',500),('trial','sms',0),('trial','files',100),('trial','storage_mb',500),('trial','checkins',null),('trial','imports',3),('trial','exports',10),
    ('starter','clients',1000),('starter','staff',5),('starter','branches',1),('starter','products',200),('starter','users',5),('starter','roles',5),('starter','integrations',3),('starter','ai_requests',0),('starter','telegram_messages',2000),('starter','sms',0),('starter','files',500),('starter','storage_mb',2000),('starter','checkins',null),('starter','imports',10),('starter','exports',50),
    ('standard','clients',5000),('standard','staff',15),('standard','branches',3),('standard','products',1000),('standard','users',15),('standard','roles',10),('standard','integrations',5),('standard','ai_requests',500),('standard','telegram_messages',10000),('standard','sms',0),('standard','files',2000),('standard','storage_mb',10000),('standard','checkins',null),('standard','imports',50),('standard','exports',200),
    ('business','clients',20000),('business','staff',50),('business','branches',10),('business','products',10000),('business','users',50),('business','roles',20),('business','integrations',10),('business','ai_requests',2000),('business','telegram_messages',100000),('business','sms',0),('business','files',10000),('business','storage_mb',51200),('business','checkins',null),('business','imports',200),('business','exports',1000)
)
insert into public.plan_limits(plan_id, limit_key, limit_value)
select p.id, m.limit_key, m.limit_value from limit_matrix m join public.plans p using(code)
on conflict(plan_id, limit_key) do update set limit_value = excluded.limit_value;

create table if not exists public.plan_usage (
  club_id uuid not null references public.clubs(id) on delete cascade,
  usage_key text not null,
  period_start date not null,
  used bigint not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (club_id, usage_key, period_start)
);
alter table public.plan_usage enable row level security;

create or replace function public.consume_plan_usage(
  p_club_id uuid,
  p_usage_key text,
  p_amount bigint,
  p_limit bigint
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_period date := date_trunc('month', now())::date;
  v_used bigint;
begin
  if p_amount <= 0 or p_limit is null then return true; end if;
  insert into public.plan_usage(club_id, usage_key, period_start, used)
  values (p_club_id, p_usage_key, v_period, 0)
  on conflict (club_id, usage_key, period_start) do nothing;

  select used into v_used from public.plan_usage
  where club_id = p_club_id and usage_key = p_usage_key and period_start = v_period
  for update;
  if v_used + p_amount > p_limit then return false; end if;

  update public.plan_usage set used = used + p_amount, updated_at = now()
  where club_id = p_club_id and usage_key = p_usage_key and period_start = v_period;
  return true;
end;
$$;
revoke all on function public.consume_plan_usage(uuid,text,bigint,bigint) from public, anon, authenticated;
grant execute on function public.consume_plan_usage(uuid,text,bigint,bigint) to service_role;
