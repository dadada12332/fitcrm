-- 0037_plans.sql
-- Раздел «Тарифы» (Billing & Plans) для Platform Admin.
-- Нормализованная схема: тарифы + фичи + лимиты + разделы + история изменений.
-- Никакого хардкода тарифов в коде — единственный источник истины здесь.
-- Идемпотентно.

-- ── 1. plans ───────────────────────────────────────────────────
create table if not exists public.plans (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,          -- 'starter' (совпадает со значением enum club_plan)
  name               text not null,
  slug               text not null unique,
  description        text not null default '',
  short_description  text not null default '',
  color              text not null default '#6366f1',
  icon               text not null default 'zap',
  sort_order         int  not null default 0,
  is_popular         boolean not null default false,
  is_recommended     boolean not null default false,
  is_active          boolean not null default true,
  is_archived        boolean not null default false,
  is_trial           boolean not null default false,
  trial_days         int  not null default 0,
  -- стоимость
  price              numeric(12,2) not null default 0,
  old_price          numeric(12,2),
  discount_percent   int,
  currency           text not null default 'USD',
  period             text not null default 'monthly',   -- monthly | quarterly | yearly
  -- лендинг
  landing_subtitle   text not null default '',
  landing_benefits   jsonb not null default '[]',       -- контент-массив (не для фильтрации)
  landing_cta        text not null default 'Начать',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.plan_features (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans(id) on delete cascade,
  feature_key text not null,
  enabled     boolean not null default false,
  unique (plan_id, feature_key)
);
create index if not exists idx_plan_features_plan on public.plan_features(plan_id);

create table if not exists public.plan_limits (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans(id) on delete cascade,
  limit_key   text not null,
  limit_value bigint,                                 -- null = безлимит
  unique (plan_id, limit_key)
);
create index if not exists idx_plan_limits_plan on public.plan_limits(plan_id);

create table if not exists public.plan_sections (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans(id) on delete cascade,
  section_key text not null,
  enabled     boolean not null default false,
  unique (plan_id, section_key)
);
create index if not exists idx_plan_sections_plan on public.plan_sections(plan_id);

create table if not exists public.plan_change_logs (
  id          bigint generated always as identity primary key,
  plan_id     uuid references public.plans(id) on delete cascade,
  admin_id    uuid references public.users(id),
  admin_email text,
  action      text not null,                          -- create | update | archive | duplicate | delete | features | limits | sections
  field       text,
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_plan_change_logs_plan on public.plan_change_logs(plan_id, created_at desc);

-- ── 2. Привязка клуба к тарифу + снапшот цены (задел под версионирование) ──
alter table public.clubs
  add column if not exists plan_id            uuid references public.plans(id),
  add column if not exists plan_price_locked  numeric(12,2),
  add column if not exists plan_currency_locked text,
  add column if not exists plan_period_locked text,
  add column if not exists plan_assigned_at   timestamptz;

-- ── 3. RLS ─────────────────────────────────────────────────────
alter table public.plans          enable row level security;
alter table public.plan_features  enable row level security;
alter table public.plan_limits    enable row level security;
alter table public.plan_sections  enable row level security;
alter table public.plan_change_logs enable row level security;

-- Цены публичны (нужны лендингу и CRM) → SELECT для всех. Запись — только service-role
-- (Platform Admin ходит service-role'ом после проверки platform_role), поэтому write-политик нет.
do $$
declare t text;
begin
  foreach t in array array['plans','plan_features','plan_limits','plan_sections'] loop
    execute format('drop policy if exists %I on public.%I;', t||'_read', t);
    execute format('create policy %I on public.%I for select using (true);', t||'_read', t);
  end loop;
end $$;

-- ── 4. Seed: 4 тарифа из текущих значений (редактируются в Platform Admin) ──
insert into public.plans (code, name, slug, description, short_description, color, icon, sort_order, is_popular, is_recommended, is_active, is_trial, trial_days, price, currency, period, landing_subtitle, landing_cta)
values
  ('trial',    'Trial',    'trial',    'Пробный период — попробуйте FitCRM бесплатно', 'Бесплатно 14 дней', '#94a3b8', 'clock',    0, false, false, true, true,  14, 0,  'USD', 'monthly', 'Для знакомства с системой', 'Попробовать'),
  ('starter',  'Starter',  'starter',  'Для небольших студий',                          'Базовый набор',      '#22c55e', 'zap',      1, false, false, true, false, 0,  29, 'USD', 'monthly', 'Старт для небольшого клуба', 'Выбрать Starter'),
  ('standard', 'Standard', 'standard', 'Для растущих клубов',                           'Оптимальный выбор',  '#6366f1', 'rocket',   2, true,  true,  true, false, 0,  59, 'USD', 'monthly', 'Всё для растущего клуба',    'Выбрать Standard'),
  ('business', 'Business', 'business', 'Для сетей и крупных клубов',                     'Максимум возможностей','#a855f7','crown',   3, false, false, true, false, 0,  99, 'USD', 'monthly', 'Без ограничений',            'Выбрать Business')
on conflict (code) do nothing;

-- 4a. Features (все 18 ключей у каждого тарифа, enabled по набору)
insert into public.plan_features (plan_id, feature_key, enabled)
select p.id, fk, fk = any(e.en)
from public.plans p
cross join unnest(array['ai','telegram','instagram','warehouse','crm','broadcasts','reports','export','import','api','white_label','platform_api','push','sms','email','knowledge','finance','multi_branch']) fk
join lateral (
  select case p.code
    when 'trial'    then array['crm','telegram','reports','import','export','finance','knowledge']
    when 'starter'  then array['crm','telegram','reports','import','export','finance','warehouse']
    when 'standard' then array['crm','telegram','reports','import','export','finance','warehouse','broadcasts','email','multi_branch','ai']
    when 'business' then array['ai','telegram','instagram','warehouse','crm','broadcasts','reports','export','import','api','white_label','platform_api','push','sms','email','knowledge','finance','multi_branch']
    else array[]::text[] end as en
) e on true
on conflict (plan_id, feature_key) do nothing;

-- 4b. Sections (14 разделов CRM)
insert into public.plan_sections (plan_id, section_key, enabled)
select p.id, sk, sk = any(e.en)
from public.plans p
cross join unnest(array['dashboard','clients','visits','payments','warehouse','reports','ai','knowledge','broadcasts','schedule','staff','memberships','integrations','settings']) sk
join lateral (
  select case p.code
    when 'trial'    then array['dashboard','clients','visits','payments','memberships','schedule','reports','settings']
    when 'starter'  then array['dashboard','clients','visits','payments','memberships','schedule','reports','warehouse','settings']
    when 'standard' then array['dashboard','clients','visits','payments','memberships','schedule','reports','warehouse','staff','integrations','broadcasts','settings']
    when 'business' then array['dashboard','clients','visits','payments','warehouse','reports','ai','knowledge','broadcasts','schedule','staff','memberships','integrations','settings']
    else array[]::text[] end as en
) e on true
on conflict (plan_id, section_key) do nothing;

-- 4c. Limits (null = безлимит; business — всё безлимит)
insert into public.plan_limits (plan_id, limit_key, limit_value)
select p.id, v.limit_key, v.val
from public.plans p
join (values
  ('trial','clients',100),('trial','staff',3),('trial','branches',1),('trial','products',50),('trial','ai_requests',20),('trial','telegram_messages',500),('trial','sms',0),('trial','files',100),('trial','storage_mb',500),('trial','integrations',1),('trial','roles',3),('trial','users',3),('trial','imports',3),('trial','exports',10),
  ('starter','clients',500),('starter','staff',5),('starter','branches',1),('starter','products',200),('starter','ai_requests',100),('starter','telegram_messages',2000),('starter','sms',0),('starter','files',500),('starter','storage_mb',2000),('starter','integrations',2),('starter','roles',5),('starter','users',5),('starter','imports',10),('starter','exports',50),
  ('standard','clients',2000),('standard','staff',15),('standard','branches',3),('standard','products',1000),('standard','ai_requests',500),('standard','telegram_messages',10000),('standard','sms',500),('standard','files',2000),('standard','storage_mb',10000),('standard','integrations',5),('standard','roles',10),('standard','users',15),('standard','imports',50),('standard','exports',200)
) v(code, limit_key, val) on v.code = p.code
on conflict (plan_id, limit_key) do nothing;

-- checkins — безлимит у всех перечисленных выше; business — все лимиты безлимитны (вставляем ключи со значением null)
insert into public.plan_limits (plan_id, limit_key, limit_value)
select p.id, lk, null
from public.plans p
cross join unnest(array['clients','staff','branches','products','ai_requests','telegram_messages','sms','files','storage_mb','integrations','roles','users','checkins','imports','exports']) lk
where p.code = 'business'
on conflict (plan_id, limit_key) do nothing;

-- checkins — добавляем ключ (null) остальным тарифам, чтобы он был в наборе
insert into public.plan_limits (plan_id, limit_key, limit_value)
select p.id, 'checkins', null
from public.plans p
where p.code in ('trial','starter','standard')
on conflict (plan_id, limit_key) do nothing;

-- ── 5. Привязать существующие клубы к тарифу по коду (clubs.plan → plans.id) ──
update public.clubs c
set plan_id = p.id
from public.plans p
where c.plan_id is null and p.code = c.plan::text;
