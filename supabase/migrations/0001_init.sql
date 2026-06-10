-- ============================================================
-- FitCRM — начальная схема БД (MVP, 18 таблиц) + RLS
-- Применять в Supabase SQL Editor → Run.
-- PII пока без шифрования (отдельный шаг позже).
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- ENUMS ----------
do $$ begin
  create type club_plan as enum ('starter','standard','business','trial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staff_role as enum ('owner','manager','admin','trainer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_status as enum ('active','frozen','expired','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type visit_method as enum ('manual','qr','telegram');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_provider as enum ('click','payme','uzum','cash');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending','paid','failed','refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type class_status as enum ('scheduled','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type class_booking_status as enum ('booked','attended','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stock_movement_type as enum ('in','sale','writeoff','return');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_channel as enum ('telegram','sms');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_status as enum ('pending','sent','failed');
exception when duplicate_object then null; end $$;

-- ---------- TABLES ----------

-- 1. users (профиль поверх auth.users)
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now()
);

-- 2. clubs
create table if not exists public.clubs (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  city              text,
  owner_id          uuid references auth.users(id),
  settings          jsonb not null default '{}',
  plan              club_plan not null default 'trial',
  trial_expires_at  timestamptz,
  plan_expires_at   timestamptz,
  tg_token          text,           -- шифрование позже (был encrypted_tg_token)
  created_at        timestamptz not null default now()
);

-- 3. staff (членство user→club + роль)
create table if not exists public.staff (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  club_id     uuid not null references public.clubs(id) on delete cascade,
  role        staff_role not null default 'trainer',
  salary      numeric(12,2),        -- шифрование позже (был encrypted_salary)
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (user_id, club_id)
);

-- 4. clients
create table if not exists public.clients (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  full_name    text not null,       -- шифрование позже
  phone        text,                -- шифрование позже
  telegram_id  bigint,
  qr_token     text unique,
  photo_url    text,
  tags         text[] not null default '{}',
  notes        text,
  created_at   timestamptz not null default now()
);

-- 5. memberships (типы абонементов)
create table if not exists public.memberships (
  id                   uuid primary key default gen_random_uuid(),
  club_id              uuid not null references public.clubs(id) on delete cascade,
  name                 text not null,
  price                numeric(12,2) not null default 0,
  duration_days        int not null default 30,
  visits_limit         int,
  freeze_days_allowed  int not null default 0,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now()
);

-- 6. subscriptions (абонементы клиентов)
create table if not exists public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubs(id) on delete cascade,
  client_id          uuid not null references public.clients(id) on delete cascade,
  membership_id      uuid references public.memberships(id),
  starts_at          date not null default current_date,
  expires_at         date,
  visits_total       int,
  visits_used        int not null default 0,
  status             subscription_status not null default 'active',
  frozen_at          timestamptz,
  freeze_days_limit  int,
  freeze_days_used   int not null default 0,
  created_at         timestamptz not null default now()
);

-- 7. visits
create table if not exists public.visits (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  client_id        uuid not null references public.clients(id) on delete cascade,
  subscription_id  uuid references public.subscriptions(id),
  checked_in_at    timestamptz not null default now(),
  checked_in_by    uuid references public.users(id),
  method           visit_method not null default 'manual'
);

-- 8. payments
create table if not exists public.payments (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  client_id        uuid references public.clients(id),
  subscription_id  uuid references public.subscriptions(id),
  amount           numeric(12,2) not null default 0,
  currency         text not null default 'UZS',
  provider         payment_provider not null default 'cash',
  tx_id            text,            -- шифрование позже (был encrypted_tx_id)
  idempotency_key  text unique,
  status           payment_status not null default 'pending',
  paid_at          timestamptz,
  created_at       timestamptz not null default now()
);

-- 9. rooms
create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  name       text not null,
  capacity   int not null default 0,
  is_active  boolean not null default true
);

-- 10. schedules (шаблоны расписания)
create table if not exists public.schedules (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  staff_id     uuid references public.staff(id),
  room_id      uuid references public.rooms(id),
  title        text not null,
  day_of_week  int not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  is_active    boolean not null default true
);

-- 11. classes (конкретные занятия)
create table if not exists public.classes (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  schedule_id   uuid references public.schedules(id),
  staff_id      uuid references public.staff(id),
  room_id       uuid references public.rooms(id),
  date          date not null,
  start_time    time not null,
  seats_total   int not null default 0,
  seats_booked  int not null default 0,
  status        class_status not null default 'scheduled'
);

-- 12. class_bookings
create table if not exists public.class_bookings (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  class_id         uuid not null references public.classes(id) on delete cascade,
  client_id        uuid not null references public.clients(id) on delete cascade,
  subscription_id  uuid references public.subscriptions(id),
  status           class_booking_status not null default 'booked',
  created_at       timestamptz not null default now()
);

-- 13. products (склад)
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null,
  category    text,
  unit        text not null default 'шт',
  sell_price  numeric(12,2) not null default 0,
  buy_price   numeric(12,2) not null default 0,
  sku         text,
  is_active   boolean not null default true
);

-- 14. inventory (остатки)
create table if not exists public.inventory (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  quantity      numeric(10,2) not null default 0,
  min_quantity  numeric(10,2) not null default 0,
  updated_at    timestamptz not null default now()
);

-- 15. stock_movements (движения склада)
create table if not exists public.stock_movements (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  type        stock_movement_type not null,
  qty         numeric(10,2) not null,
  unit_price  numeric(12,2) not null default 0,
  client_id   uuid references public.clients(id),
  payment_id  uuid references public.payments(id),
  note        text,
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now()
);

-- 16. notification_templates
create table if not exists public.notification_templates (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null,
  channel     notification_channel not null default 'telegram',
  body        text not null default '',
  created_at  timestamptz not null default now()
);

-- 17. notifications
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete cascade,
  channel       notification_channel not null default 'telegram',
  template_id   uuid references public.notification_templates(id),
  payload       jsonb not null default '{}',
  status        notification_status not null default 'pending',
  scheduled_at  timestamptz,
  sent_at       timestamptz
);

-- 18. audit_logs (bigint PK — INSERT-heavy)
create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  club_id     uuid references public.clubs(id) on delete cascade,
  user_id     uuid references public.users(id),
  action      text,
  table_name  text,
  record_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

-- ---------- INDEXES ----------
create index if not exists idx_staff_user           on public.staff(user_id);
create index if not exists idx_staff_club           on public.staff(club_id);
create index if not exists idx_clients_club         on public.clients(club_id);
create index if not exists idx_clients_phone        on public.clients(phone);
create index if not exists idx_memberships_club     on public.memberships(club_id);
create index if not exists idx_subscriptions_club   on public.subscriptions(club_id);
create index if not exists idx_subscriptions_client on public.subscriptions(client_id);
create index if not exists idx_visits_club          on public.visits(club_id);
create index if not exists idx_visits_client        on public.visits(client_id);
create index if not exists idx_payments_club        on public.payments(club_id);
create index if not exists idx_payments_sub         on public.payments(subscription_id);
create index if not exists idx_classes_club         on public.classes(club_id);
create index if not exists idx_bookings_club        on public.class_bookings(club_id);
create index if not exists idx_products_club        on public.products(club_id);
create index if not exists idx_notifications_club   on public.notifications(club_id);

-- ---------- HELPER: клубы текущего пользователя ----------
create or replace function public.user_club_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select club_id from public.staff where user_id = auth.uid();
$$;

grant execute on function public.user_club_ids() to authenticated;

-- ---------- RLS ----------
alter table public.users        enable row level security;
alter table public.clubs        enable row level security;
alter table public.staff        enable row level security;
alter table public.clients      enable row level security;
alter table public.memberships  enable row level security;
alter table public.subscriptions enable row level security;
alter table public.visits       enable row level security;
alter table public.payments     enable row level security;
alter table public.rooms        enable row level security;
alter table public.schedules    enable row level security;
alter table public.classes      enable row level security;
alter table public.class_bookings enable row level security;
alter table public.products     enable row level security;
alter table public.inventory    enable row level security;
alter table public.stock_movements enable row level security;
alter table public.notification_templates enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs   enable row level security;

-- users: только своя строка
drop policy if exists users_self on public.users;
create policy users_self on public.users
  for all using (id = auth.uid()) with check (id = auth.uid());

-- clubs: чтение членам, изменение владельцу (insert — через create_club)
drop policy if exists clubs_select on public.clubs;
create policy clubs_select on public.clubs
  for select using (id in (select public.user_club_ids()));
drop policy if exists clubs_update on public.clubs;
create policy clubs_update on public.clubs
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- staff: чтение членам своего клуба
drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff
  for select using (club_id in (select public.user_club_ids()));

-- club-scoped таблицы: полный доступ членам клуба
do $$
declare t text;
begin
  foreach t in array array[
    'clients','memberships','subscriptions','visits','payments','rooms',
    'schedules','classes','class_bookings','products','inventory',
    'stock_movements','notification_templates','notifications','audit_logs'
  ]
  loop
    execute format('drop policy if exists %I on public.%I;', t||'_club_all', t);
    execute format(
      'create policy %I on public.%I for all
         using (club_id in (select public.user_club_ids()))
         with check (club_id in (select public.user_club_ids()));',
      t||'_club_all', t
    );
  end loop;
end $$;

-- ---------- TRIGGER: профиль при регистрации ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- backfill: профили для уже зарегистрированных пользователей
insert into public.users (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ---------- FUNCTION: создание клуба (онбординг) ----------
create or replace function public.create_club(p_name text, p_city text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_club uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- гарантируем профиль (на случай старых аккаунтов)
  insert into public.users (id, email)
  values (v_uid, (select email from auth.users where id = v_uid))
  on conflict (id) do nothing;

  insert into public.clubs (name, city, owner_id, plan, trial_expires_at)
  values (p_name, p_city, v_uid, 'trial', now() + interval '14 days')
  returning id into v_club;

  insert into public.staff (user_id, club_id, role)
  values (v_uid, v_club, 'owner');

  return v_club;
end;
$$;

grant execute on function public.create_club(text, text) to authenticated;
