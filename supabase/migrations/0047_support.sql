-- ════════════════════════════════════════════════════════════════════════
-- 0047_support.sql — Центр поддержки (раздел «Поддержка»).
-- Единый источник истины для клуба И Platform Admin.
-- Одно обращение → много сообщений → много вложений. Несколько операторов,
-- внутренние заметки, назначение, SLA, приоритет, email, AI-оператор —
-- заложены колонками/enum'ами, но UI пока не строится.
-- ════════════════════════════════════════════════════════════════════════

-- Человекочитаемый номер обращения (#1042).
create sequence if not exists public.support_ticket_no_seq start with 1000;

-- ── Обращения ───────────────────────────────────────────────────────────
create table if not exists public.support_tickets (
  id            uuid primary key default gen_random_uuid(),
  ticket_no     bigint not null default nextval('public.support_ticket_no_seq'),
  club_id       uuid references public.clubs(id) on delete cascade,
  created_by    uuid references public.users(id) on delete set null,

  category      text not null default 'other'
                check (category in ('import','payments','integrations','subscription','error','feature','other')),
  subject       text not null,

  status        text not null default 'new'
                check (status in ('new','in_progress','needs_info','resolved','closed')),
  priority      text not null default 'normal'
                check (priority in ('low','normal','high','urgent')),        -- задел: приоритет
  source        text not null default 'user'
                check (source in ('user','ai_escalation')),                  -- откуда создан
  channel       text not null default 'in_app'
                check (channel in ('in_app','email')),                       -- задел: email

  assignee_id   uuid references public.users(id) on delete set null,         -- задел: назначение оператора

  client_meta   jsonb not null default '{}'::jsonb,                          -- автодиагностика (скрыто от юзера)

  first_response_at timestamptz,                                             -- задел: SLA
  resolved_at   timestamptz,
  closed_at     timestamptz,

  csat_rating   smallint check (csat_rating between 1 and 5),                -- оценка ⭐
  csat_comment  text,

  -- метки прочтения для бейджа непрочитанного
  user_last_read_at  timestamptz not null default now(),
  agent_last_read_at timestamptz,

  last_message_at timestamptz not null default now(),                        -- для сортировки списка
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists idx_support_tickets_no on public.support_tickets(ticket_no);
create index if not exists idx_support_tickets_club   on public.support_tickets(club_id, last_message_at desc);
create index if not exists idx_support_tickets_status on public.support_tickets(status);
create index if not exists idx_support_tickets_assignee on public.support_tickets(assignee_id);

-- ── Сообщения (лента: переписка + системные события статусов) ────────────
create table if not exists public.support_messages (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid not null references public.support_tickets(id) on delete cascade,
  author_type  text not null check (author_type in ('user','agent','ai','system')),
  author_id    uuid references public.users(id) on delete set null,          -- null для ai/system
  body         text not null default '',
  visibility   text not null default 'public'
               check (visibility in ('public','internal')),                  -- задел: внутренние заметки
  meta         jsonb not null default '{}'::jsonb,                           -- задел: шаблон/AI-подсказка/событие
  created_at   timestamptz not null default now()
);

create index if not exists idx_support_messages_ticket on public.support_messages(ticket_id, created_at);

-- ── Вложения ────────────────────────────────────────────────────────────
create table if not exists public.support_attachments (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.support_messages(id) on delete cascade,
  storage_path text not null,
  file_name    text not null,
  mime_type    text,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);

create index if not exists idx_support_attachments_msg on public.support_attachments(message_id);

-- ── Триггер: поддерживать updated_at / last_message_at ───────────────────
create or replace function public.support_touch_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.support_tickets
     set last_message_at = new.created_at,
         updated_at      = now(),
         -- первый ответ поддержки → фиксируем для SLA
         first_response_at = case
           when first_response_at is null and new.author_type in ('agent','ai')
             then new.created_at else first_response_at end,
         -- ответ поддержки помечает тикет непрочитанным для пользователя
         user_last_read_at = case
           when new.author_type = 'user' then now() else user_last_read_at end,
         agent_last_read_at = case
           when new.author_type in ('agent','ai') then new.created_at else agent_last_read_at end
   where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists trg_support_touch on public.support_messages;
create trigger trg_support_touch
  after insert on public.support_messages
  for each row execute function public.support_touch_ticket();

-- ── Перенос данных из старой platform_tickets ───────────────────────────
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'platform_tickets') then
    insert into public.support_tickets (id, club_id, created_by, subject, status, priority, created_at, updated_at, last_message_at)
    select t.id, t.club_id, t.user_id, t.subject,
           case t.status when 'open' then 'new' when 'pending' then 'in_progress' when 'closed' then 'closed' else 'new' end,
           t.priority, t.created_at, t.updated_at, t.updated_at
      from public.platform_tickets t
    on conflict (id) do nothing;

    -- тело старого тикета → первое сообщение пользователя
    insert into public.support_messages (ticket_id, author_type, author_id, body, created_at)
    select t.id, 'user', t.user_id, coalesce(nullif(t.body, ''), t.subject), t.created_at
      from public.platform_tickets t
     where not exists (select 1 from public.support_messages m where m.ticket_id = t.id);

    alter table public.platform_tickets rename to platform_tickets_legacy;
  end if;
end $$;

-- ── RLS (defense-in-depth; серверные экшены ходят service-role, scoped по clubId) ──
alter table public.support_tickets     enable row level security;
alter table public.support_messages     enable row level security;
alter table public.support_attachments  enable row level security;

drop policy if exists support_tickets_club on public.support_tickets;
create policy support_tickets_club on public.support_tickets
  for all using (club_id in (select public.user_club_ids()))
          with check (club_id in (select public.user_club_ids()));

-- сообщения: члены клуба видят публичные сообщения своих тикетов (внутренние — скрыты)
drop policy if exists support_messages_club on public.support_messages;
create policy support_messages_club on public.support_messages
  for select using (
    visibility = 'public'
    and ticket_id in (select id from public.support_tickets where club_id in (select public.user_club_ids()))
  );
drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert on public.support_messages
  for insert with check (
    author_type = 'user'
    and ticket_id in (select id from public.support_tickets where club_id in (select public.user_club_ids()))
  );

drop policy if exists support_attachments_club on public.support_attachments;
create policy support_attachments_club on public.support_attachments
  for select using (
    message_id in (
      select m.id from public.support_messages m
      join public.support_tickets t on t.id = m.ticket_id
      where t.club_id in (select public.user_club_ids()) and m.visibility = 'public'
    )
  );

-- ── Приватный Storage-бакет для вложений (Фаза 3) ───────────────────────
insert into storage.buckets (id, name, public)
values ('support', 'support', false)
on conflict (id) do nothing;
