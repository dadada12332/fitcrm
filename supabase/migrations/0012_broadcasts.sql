-- ============================================================
-- FitCRM — рассылки в Telegram-боте: таблица broadcasts +
-- storage-бакет для картинок. Применять в SQL Editor → Run.
-- Идемпотентно.
-- ============================================================

create table if not exists public.broadcasts (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade,
  message         text,
  image_url       text,
  audience        text not null default 'all',   -- all | active | expiring | membership:<id> | manual
  audience_label  text,
  recipient_ids   bigint[],                       -- снапшот tg_id (для manual/scheduled)
  status          text not null default 'sent',   -- scheduled | sent | failed
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  total           int not null default 0,
  delivered       int not null default 0,
  failed          int not null default 0,
  created_by      uuid references public.users(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_broadcasts_club on public.broadcasts(club_id);
create index if not exists idx_broadcasts_status on public.broadcasts(status, scheduled_at);

-- RLS: доступ членам клуба (как остальные club-scoped таблицы)
alter table public.broadcasts enable row level security;
drop policy if exists broadcasts_club_all on public.broadcasts;
create policy broadcasts_club_all on public.broadcasts
  for all
  using (club_id in (select public.user_club_ids()))
  with check (club_id in (select public.user_club_ids()));

-- ── Storage bucket для картинок рассылок (Telegram шлём по public URL) ──
insert into storage.buckets (id, name, public)
values ('broadcasts', 'broadcasts', true)
on conflict (id) do nothing;

-- Политики storage: публичное чтение + загрузка/удаление для authenticated
drop policy if exists "broadcasts_read" on storage.objects;
create policy "broadcasts_read" on storage.objects
  for select using (bucket_id = 'broadcasts');

drop policy if exists "broadcasts_write" on storage.objects;
create policy "broadcasts_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'broadcasts');

drop policy if exists "broadcasts_delete" on storage.objects;
create policy "broadcasts_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'broadcasts');
