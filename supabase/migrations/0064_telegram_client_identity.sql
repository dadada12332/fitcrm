-- Keep Telegram display identity separate from the canonical CRM client.
-- All business records continue to reference clients.id.

alter table public.clients
  add column if not exists phone_normalized text generated always as (
    case
      when phone is null then null
      when length(regexp_replace(phone, '[^0-9]', '', 'g')) = 12
        and regexp_replace(phone, '[^0-9]', '', 'g') like '998%'
        then right(regexp_replace(phone, '[^0-9]', '', 'g'), 9)
      when length(regexp_replace(phone, '[^0-9]', '', 'g')) = 11
        and left(regexp_replace(phone, '[^0-9]', '', 'g'), 1) in ('7', '8')
        then right(regexp_replace(phone, '[^0-9]', '', 'g'), 10)
      else regexp_replace(phone, '[^0-9]', '', 'g')
    end
  ) stored;

create index if not exists idx_clients_club_phone_normalized
  on public.clients (club_id, phone_normalized)
  where phone_normalized is not null;

alter table public.telegram_users
  add column if not exists telegram_first_name text,
  add column if not exists telegram_last_name text,
  add column if not exists telegram_username text,
  add column if not exists telegram_photo_url text;

-- One Telegram account per client card inside a club. A verified contact can
-- replace the old link explicitly in the bot flow.
create unique index if not exists idx_telegram_users_one_account_per_client
  on public.telegram_users (club_id, client_id)
  where client_id is not null;

-- The legacy FK checked only client_id. This additional invariant prevents a
-- service-role bug from linking a Telegram identity across club boundaries.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.clients'::regclass and conname = 'clients_club_id_id_key'
  ) then
    alter table public.clients
      add constraint clients_club_id_id_key unique (club_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.telegram_users'::regclass
      and conname = 'telegram_users_club_client_identity_fkey'
  ) then
    alter table public.telegram_users
      add constraint telegram_users_club_client_identity_fkey
      foreign key (club_id, client_id)
      references public.clients (club_id, id);
  end if;
end $$;
