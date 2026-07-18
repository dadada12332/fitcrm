-- Bot tokens must never live on the club row: every club member can SELECT
-- that row through RLS/REST. Keep credentials in a service-role-only table.
create table if not exists public.telegram_integrations (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  bot_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_integrations enable row level security;
revoke all on public.telegram_integrations from anon, authenticated;
grant all on public.telegram_integrations to service_role;

insert into public.telegram_integrations (club_id, bot_token)
select id, tg_token
from public.clubs
where tg_token is not null and length(tg_token) > 0
on conflict (club_id) do update
set bot_token = excluded.bot_token, updated_at = now();

update public.clubs set tg_token = null where tg_token is not null;
