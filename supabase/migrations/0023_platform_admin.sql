-- 0023_platform_admin.sql
-- Platform Admin (admin.fitcrm.uz) — отдельная система управления всем SaaS.
-- Идемпотентно.

-- 1. Роль уровня платформы на профиле пользователя.
--    null = обычный пользователь клуба; 'platform_admin' | 'super_admin' = доступ в Platform.
alter table public.users
  add column if not exists platform_role text
    check (platform_role in ('platform_admin','super_admin'));

-- 2. Служебные поля клуба для Platform Admin (health / статус / заметки).
alter table public.clubs
  add column if not exists status         text not null default 'active'
    check (status in ('active','suspended','deleted')),
  add column if not exists health_score   int,
  add column if not exists admin_notes    text,
  add column if not exists suspended_at   timestamptz;

-- 3. Аудит действий администратора платформы.
create table if not exists public.platform_admin_logs (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.users(id) on delete set null,
  admin_email text,
  action      text not null,          -- login | impersonate | extend_trial | change_plan | suspend | ...
  club_id     uuid references public.clubs(id) on delete set null,
  target_user uuid references public.users(id) on delete set null,
  meta        jsonb not null default '{}',
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_pa_logs_created on public.platform_admin_logs(created_at desc);
create index if not exists idx_pa_logs_club    on public.platform_admin_logs(club_id);

-- RLS: таблица управляется только через service-role (Platform). Обычным ключам — запрет.
alter table public.platform_admin_logs enable row level security;

-- 4. Промокоды платформы (раздел «Промокоды»).
create table if not exists public.platform_promo_codes (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  description   text not null default '',
  discount_pct  int,                  -- скидка в процентах
  free_days     int,                  -- бесплатные дни / месяцы триала
  max_uses      int,
  used_count    int not null default 0,
  expires_at    timestamptz,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.platform_promo_codes enable row level security;

-- 5. Обращения поддержки (раздел «Поддержка»).
create table if not exists public.platform_tickets (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid references public.clubs(id) on delete set null,
  user_id     uuid references public.users(id) on delete set null,
  subject     text not null,
  body        text not null default '',
  status      text not null default 'open' check (status in ('open','pending','closed')),
  priority    text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_tickets_status on public.platform_tickets(status);
alter table public.platform_tickets enable row level security;

-- 6. Назначить владельца проекта супер-администратором платформы.
update public.users
   set platform_role = 'super_admin'
 where email = 'opadasebe@gmail.com';
