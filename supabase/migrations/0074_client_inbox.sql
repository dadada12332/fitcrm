-- Client inbox: Telegram Mini App clients communicate with club staff.
-- This is intentionally separate from support_* (club -> FitCRM support).

create sequence if not exists public.client_conversation_no_seq start with 1000;

create table if not exists public.client_conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_no bigint not null default nextval('public.client_conversation_no_seq'),
  club_id uuid not null references public.clubs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  channel text not null default 'telegram'
    check (channel in ('telegram', 'instagram', 'web')),
  category text not null default 'other'
    check (category in ('membership', 'payment', 'schedule', 'freeze', 'visit_qr', 'other')),
  status text not null default 'new'
    check (status in ('new', 'open', 'waiting_client', 'resolved', 'closed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  assignee_id uuid references public.staff(id) on delete set null,
  subject text not null default '',
  last_message_preview text not null default '',
  last_message_at timestamptz not null default now(),
  last_client_message_at timestamptz,
  last_staff_message_at timestamptz,
  client_last_read_at timestamptz not null default now(),
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_client_conversations_no
  on public.client_conversations(conversation_no);
create index if not exists idx_client_conversations_club_activity
  on public.client_conversations(club_id, last_message_at desc);
create index if not exists idx_client_conversations_client_activity
  on public.client_conversations(club_id, client_id, last_message_at desc);
create index if not exists idx_client_conversations_assignee
  on public.client_conversations(club_id, assignee_id, status, last_message_at desc);
create unique index if not exists idx_client_conversations_one_active
  on public.client_conversations(club_id, client_id, channel)
  where status in ('new', 'open', 'waiting_client', 'resolved');

create table if not exists public.client_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.client_conversations(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  sender_type text not null check (sender_type in ('client', 'staff', 'system')),
  sender_client_id uuid references public.clients(id) on delete set null,
  sender_staff_id uuid references public.staff(id) on delete set null,
  body text not null,
  visibility text not null default 'public' check (visibility in ('public', 'internal')),
  channel text not null default 'telegram' check (channel in ('telegram', 'instagram', 'web')),
  external_message_id text,
  idempotency_key text,
  delivery_status text not null default 'received'
    check (delivery_status in ('received', 'pending', 'sent', 'failed', 'not_applicable')),
  delivery_attempts integer not null default 0 check (delivery_attempts >= 0),
  next_delivery_at timestamptz,
  delivery_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint client_message_sender_check check (
    (sender_type = 'client' and sender_client_id is not null and sender_staff_id is null)
    or (sender_type = 'staff' and sender_staff_id is not null and sender_client_id is null)
    or (sender_type = 'system' and sender_client_id is null and sender_staff_id is null)
  )
);

create index if not exists idx_client_messages_conversation
  on public.client_conversation_messages(conversation_id, created_at);
create index if not exists idx_client_messages_delivery
  on public.client_conversation_messages(next_delivery_at, created_at)
  where delivery_status in ('pending', 'failed') and sender_type = 'staff';
create unique index if not exists idx_client_messages_idempotency
  on public.client_conversation_messages(club_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.client_conversation_reads (
  conversation_id uuid not null references public.client_conversations(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, staff_id)
);

create index if not exists idx_client_conversation_reads_staff
  on public.client_conversation_reads(club_id, staff_id, last_read_at);

create table if not exists public.client_reply_templates (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'other'
    check (category in ('membership', 'payment', 'schedule', 'freeze', 'visit_qr', 'other')),
  shortcut text,
  position integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_reply_templates_club
  on public.client_reply_templates(club_id, is_active, position, title);
create unique index if not exists idx_client_reply_templates_shortcut
  on public.client_reply_templates(club_id, lower(shortcut))
  where shortcut is not null and shortcut <> '';

create or replace function public.touch_client_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.client_conversations
     set last_message_at = new.created_at,
         last_message_preview = left(regexp_replace(new.body, '[[:space:]]+', ' ', 'g'), 180),
         updated_at = now(),
         last_client_message_at = case
           when new.sender_type = 'client' then new.created_at else last_client_message_at end,
         last_staff_message_at = case
           when new.sender_type = 'staff' then new.created_at else last_staff_message_at end,
         first_response_at = case
           when first_response_at is null and new.sender_type = 'staff' then new.created_at
           else first_response_at end,
         status = case
           when new.sender_type = 'client' then
             case when status = 'new' then 'new' else 'open' end
           when new.sender_type = 'staff' and new.visibility = 'public' then 'waiting_client'
           else status end,
         resolved_at = case when new.sender_type = 'client' then null else resolved_at end
   where id = new.conversation_id and club_id = new.club_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_client_conversation on public.client_conversation_messages;
create trigger trg_touch_client_conversation
  after insert on public.client_conversation_messages
  for each row execute function public.touch_client_conversation();

alter table public.client_conversations enable row level security;
alter table public.client_conversation_messages enable row level security;
alter table public.client_conversation_reads enable row level security;
alter table public.client_reply_templates enable row level security;

drop policy if exists client_conversations_staff_read on public.client_conversations;
create policy client_conversations_staff_read on public.client_conversations
  for select to authenticated using (club_id in (select public.user_club_ids()));

drop policy if exists client_messages_staff_read on public.client_conversation_messages;
create policy client_messages_staff_read on public.client_conversation_messages
  for select to authenticated using (club_id in (select public.user_club_ids()));

drop policy if exists client_reads_staff_read on public.client_conversation_reads;
create policy client_reads_staff_read on public.client_conversation_reads
  for select to authenticated using (club_id in (select public.user_club_ids()));

drop policy if exists client_templates_staff_read on public.client_reply_templates;
create policy client_templates_staff_read on public.client_reply_templates
  for select to authenticated using (club_id in (select public.user_club_ids()));

revoke all on function public.touch_client_conversation() from public, anon, authenticated;

-- Authenticated users can only read. All writes pass through permission-checked
-- Server Actions or validated Telegram Mini App API routes using service-role.
revoke insert, update, delete on public.client_conversations from authenticated;
revoke insert, update, delete on public.client_conversation_messages from authenticated;
revoke insert, update, delete on public.client_conversation_reads from authenticated;
revoke insert, update, delete on public.client_reply_templates from authenticated;
grant select on public.client_conversations to authenticated;
grant select on public.client_conversation_messages to authenticated;
grant select on public.client_conversation_reads to authenticated;
grant select on public.client_reply_templates to authenticated;

create or replace function public.get_client_inbox_list(p_club_id uuid, p_staff_id uuid)
returns json
language sql
security invoker
set search_path = ''
stable
as $$
  select coalesce(json_agg(row_to_json(items) order by items.last_message_at desc), '[]'::json)
  from (
    select
      c.id,
      c.conversation_no,
      c.client_id,
      cl.full_name as client_name,
      c.category,
      c.status,
      c.priority,
      c.channel,
      c.assignee_id,
      coalesce(assignee.full_name, assignee.email) as assignee_name,
      c.last_message_preview,
      c.last_message_at,
      c.last_client_message_at is not null
        and c.last_client_message_at > coalesce(reads.last_read_at, '-infinity'::timestamptz) as unread
    from public.client_conversations c
    join public.clients cl on cl.id = c.client_id and cl.club_id = c.club_id
    left join public.staff assigned_staff on assigned_staff.id = c.assignee_id and assigned_staff.club_id = c.club_id
    left join public.users assignee on assignee.id = assigned_staff.user_id
    left join public.client_conversation_reads reads
      on reads.conversation_id = c.id and reads.staff_id = p_staff_id and reads.club_id = c.club_id
    where c.club_id = p_club_id
    order by c.last_message_at desc
    limit 250
  ) items;
$$;

create or replace function public.get_client_inbox_detail(p_club_id uuid, p_conversation_id uuid)
returns json
language sql
security invoker
set search_path = ''
stable
as $$
  select json_build_object(
    'id', c.id,
    'conversation_no', c.conversation_no,
    'category', c.category,
    'status', c.status,
    'priority', c.priority,
    'channel', c.channel,
    'assignee_id', c.assignee_id,
    'client', json_build_object(
      'id', cl.id,
      'name', cl.full_name,
      'phone', cl.phone,
      'balance', coalesce(cl.balance, 0),
      'debt', coalesce(cl.debt, 0),
      'telegram_username', (
        select tu.telegram_username
        from public.telegram_users tu
        where tu.club_id = c.club_id and tu.client_id = c.client_id and tu.role = 'client'
        limit 1
      ),
      'membership_name', (
        select m.name
        from public.subscriptions sub
        left join public.memberships m on m.id = sub.membership_id and m.club_id = sub.club_id
        where sub.club_id = c.club_id and sub.client_id = c.client_id
        order by (sub.status = 'active') desc, sub.expires_at desc nulls last
        limit 1
      ),
      'membership_expires_at', (
        select sub.expires_at
        from public.subscriptions sub
        where sub.club_id = c.club_id and sub.client_id = c.client_id
        order by (sub.status = 'active') desc, sub.expires_at desc nulls last
        limit 1
      ),
      'last_visit_at', (
        select v.checked_in_at
        from public.visits v
        where v.club_id = c.club_id and v.client_id = c.client_id
        order by v.checked_in_at desc
        limit 1
      )
    ),
    'messages', coalesce((
      select json_agg(json_build_object(
        'id', msg.id,
        'sender_type', msg.sender_type,
        'sender_name', coalesce(sender.full_name, sender.email),
        'body', msg.body,
        'delivery_status', msg.delivery_status,
        'delivery_error', msg.delivery_error,
        'created_at', msg.created_at
      ) order by msg.created_at)
      from public.client_conversation_messages msg
      left join public.staff sender_staff on sender_staff.id = msg.sender_staff_id and sender_staff.club_id = msg.club_id
      left join public.users sender on sender.id = sender_staff.user_id
      where msg.conversation_id = c.id and msg.club_id = c.club_id and msg.visibility = 'public'
    ), '[]'::json)
  )
  from public.client_conversations c
  join public.clients cl on cl.id = c.client_id and cl.club_id = c.club_id
  where c.id = p_conversation_id and c.club_id = p_club_id
  limit 1;
$$;

revoke all on function public.get_client_inbox_list(uuid, uuid) from public, anon;
revoke all on function public.get_client_inbox_detail(uuid, uuid) from public, anon;
grant execute on function public.get_client_inbox_list(uuid, uuid) to authenticated;
grant execute on function public.get_client_inbox_detail(uuid, uuid) to authenticated;
grant execute on function public.get_client_inbox_list(uuid, uuid) to service_role;
grant execute on function public.get_client_inbox_detail(uuid, uuid) to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_conversations'
  ) then
    alter publication supabase_realtime add table public.client_conversations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_conversation_messages'
  ) then
    alter publication supabase_realtime add table public.client_conversation_messages;
  end if;
end $$;

-- Existing roles predate the inbox module. Persist conservative defaults so
-- custom role JSON remains explicit and editable in Roles & Permissions.
update public.club_roles
set permissions = jsonb_set(
  coalesce(permissions, '{}'::jsonb),
  '{inbox}',
  case key
    when 'owner' then '{"view":true,"reply":true,"assign":true,"manage_templates":true}'::jsonb
    when 'admin' then '{"view":true,"reply":true,"assign":true,"manage_templates":true}'::jsonb
    when 'manager' then '{"view":true,"reply":true,"assign":true,"manage_templates":true}'::jsonb
    when 'cashier' then '{"view":true,"reply":true,"assign":false,"manage_templates":false}'::jsonb
    else '{"view":false,"reply":false,"assign":false,"manage_templates":false}'::jsonb
  end,
  true
)
where not (coalesce(permissions, '{}'::jsonb) ? 'inbox');

create or replace function public.get_sidebar_stats(p_club_id uuid)
returns json
language sql
security invoker
set search_path = ''
stable
as $$
  select json_build_object(
    'clientCount', (select count(*) from public.clients where club_id = p_club_id),
    'activeMembershipCount', (select count(*) from public.subscriptions where club_id = p_club_id and status = 'active'),
    'todayVisits', (select count(*) from public.visits where club_id = p_club_id and checked_in_at >= current_date),
    'lowStockCount', (select count(*) from public.inventory where club_id = p_club_id and min_quantity > 0 and quantity <= min_quantity),
    'userName', coalesce((select full_name from public.users where id = (select auth.uid())), 'Пользователь'),
    'userRole', coalesce((
      select case role::text
        when 'owner' then 'Владелец'
        when 'manager' then 'Менеджер'
        when 'admin' then 'Администратор'
        when 'trainer' then 'Тренер'
        when 'accountant' then 'Бухгалтер'
        when 'cashier' then 'Кассир'
        else 'Сотрудник'
      end
      from public.staff
      where club_id = p_club_id and user_id = (select auth.uid()) and is_active
      limit 1
    ), 'Сотрудник'),
    'staffId', (select id from public.staff where club_id = p_club_id and user_id = (select auth.uid()) and is_active limit 1),
    'supportUnread', (
      select count(*) from public.support_tickets
      where club_id = p_club_id
        and agent_last_read_at is not null
        and agent_last_read_at > coalesce(user_last_read_at, '-infinity'::timestamptz)
    ),
    'inboxUnread', (
      select count(*)
      from public.client_conversations c
      where c.club_id = p_club_id
        and c.status in ('new', 'open', 'waiting_client')
        and c.last_client_message_at is not null
        and c.last_client_message_at > coalesce((
          select r.last_read_at
          from public.client_conversation_reads r
          where r.conversation_id = c.id
            and r.staff_id = (
              select s.id from public.staff s
              where s.club_id = p_club_id and s.user_id = (select auth.uid()) and s.is_active
              limit 1
            )
        ), '-infinity'::timestamptz)
    ),
    'notificationCount',
      least((select count(*) from public.subscriptions where club_id = p_club_id and status = 'active' and expires_at between current_date and current_date + 7), 10)
      + least((select count(*) from public.subscriptions where club_id = p_club_id and status = 'expired' and expires_at between current_date - 7 and current_date), 10)
      + least((select count(*) from public.payments where club_id = p_club_id and status = 'pending'), 10)
  );
$$;

revoke all on function public.get_sidebar_stats(uuid) from public, anon;
grant execute on function public.get_sidebar_stats(uuid) to authenticated;
