-- Access-control integrations for turnstiles and readers (0083).
-- Secrets and raw device payloads are service-role only. Staff access them
-- through permission-checked server code that returns redacted DTOs.

create table if not exists public.access_control_integrations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  provider text not null check (provider in ('sigur', 'zkteco', 'hikvision')),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  mode text not null default 'bridge'
    check (mode in ('bridge', 'web_delegation', 'rest_poll', 'isapi', 'hikcentral', 'zkbio')),
  status text not null default 'draft'
    check (status in ('draft', 'configured', 'connected', 'error', 'disabled')),
  base_url text,
  username text,
  secret_enc text not null,
  webhook_key_hash text not null check (webhook_key_hash ~ '^[a-f0-9]{64}$'),
  config jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  last_event_at timestamptz,
  last_error text,
  connected_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, provider),
  unique (club_id, id),
  unique (club_id, id, provider),
  check (
    (provider = 'sigur' and mode in ('bridge', 'web_delegation', 'rest_poll'))
    or (provider = 'zkteco' and mode in ('bridge', 'zkbio'))
    or (provider = 'hikvision' and mode in ('bridge', 'isapi', 'hikcentral'))
  )
);

create unique index if not exists clients_club_id_id_uidx
  on public.clients (club_id, id);
create unique index if not exists subscriptions_club_id_id_uidx
  on public.subscriptions (club_id, id);
create unique index if not exists visits_club_id_id_uidx
  on public.visits (club_id, id);

create table if not exists public.access_control_credentials (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  integration_id uuid not null,
  client_id uuid not null,
  credential_type text not null default 'card'
    check (credential_type in ('card', 'bracelet', 'qr', 'face')),
  credential_uid text not null check (char_length(btrim(credential_uid)) between 1 and 128),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (integration_id, credential_uid),
  foreign key (club_id, integration_id)
    references public.access_control_integrations(club_id, id) on delete cascade,
  foreign key (club_id, client_id)
    references public.clients(club_id, id) on delete cascade
);

create table if not exists public.access_control_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  integration_id uuid not null,
  provider text not null check (provider in ('sigur', 'zkteco', 'hikvision')),
  external_event_id text not null check (char_length(btrim(external_event_id)) between 1 and 300),
  event_fingerprint text not null check (event_fingerprint ~ '^[a-f0-9]{64}$'),
  event_type text not null default 'passage'
    check (event_type in ('access_request', 'passage', 'denied', 'heartbeat', 'unknown')),
  direction text not null default 'entry'
    check (direction in ('entry', 'exit', 'unknown')),
  credential_uid text,
  client_id uuid,
  subscription_id uuid,
  visit_id uuid,
  decision text not null default 'received'
    check (decision in ('received', 'allowed', 'denied', 'ignored', 'error')),
  reason_code text,
  reason_message text,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (integration_id, event_type, external_event_id),
  foreign key (club_id, integration_id, provider)
    references public.access_control_integrations(club_id, id, provider) on delete cascade,
  foreign key (club_id, client_id)
    references public.clients(club_id, id) on delete set null (client_id),
  foreign key (club_id, subscription_id)
    references public.subscriptions(club_id, id) on delete set null (subscription_id),
  foreign key (club_id, visit_id)
    references public.visits(club_id, id) on delete set null (visit_id)
);

create table if not exists public.access_control_reservations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  integration_id uuid not null,
  external_request_id text not null check (char_length(btrim(external_request_id)) between 1 and 300),
  credential_uid text not null check (char_length(btrim(credential_uid)) between 1 and 128),
  client_id uuid not null,
  subscription_id uuid not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (integration_id, external_request_id),
  foreign key (club_id, integration_id)
    references public.access_control_integrations(club_id, id) on delete cascade,
  foreign key (club_id, client_id)
    references public.clients(club_id, id) on delete cascade,
  foreign key (club_id, subscription_id)
    references public.subscriptions(club_id, id) on delete cascade
);

create index if not exists access_control_credentials_client_idx
  on public.access_control_credentials (club_id, client_id, integration_id);
create index if not exists access_control_credentials_integration_created_idx
  on public.access_control_credentials (club_id, integration_id, created_at desc);
create index if not exists access_control_events_club_time_idx
  on public.access_control_events (club_id, occurred_at desc);
create index if not exists access_control_events_integration_time_idx
  on public.access_control_events (integration_id, occurred_at desc);
create index if not exists access_control_events_client_time_idx
  on public.access_control_events (club_id, client_id, occurred_at desc);
create index if not exists access_control_events_subscription_idx
  on public.access_control_events (club_id, subscription_id)
  where subscription_id is not null;
create index if not exists access_control_events_visit_idx
  on public.access_control_events (club_id, visit_id)
  where visit_id is not null;
create index if not exists access_control_reservations_active_idx
  on public.access_control_reservations (club_id, subscription_id, expires_at)
  where consumed_at is null;

alter table public.access_control_integrations enable row level security;
alter table public.access_control_credentials enable row level security;
alter table public.access_control_events enable row level security;
alter table public.access_control_reservations enable row level security;

-- Keep the project-wide club_id RLS invariant even though direct authenticated
-- table privileges remain revoked below. Server code uses service_role and
-- performs the same club_id scope explicitly.
drop policy if exists access_control_integrations_club_all
  on public.access_control_integrations;
create policy access_control_integrations_club_all
  on public.access_control_integrations for all to authenticated
  using (club_id in (select public.user_club_ids()))
  with check (club_id in (select public.user_club_ids()));

drop policy if exists access_control_credentials_club_all
  on public.access_control_credentials;
create policy access_control_credentials_club_all
  on public.access_control_credentials for all to authenticated
  using (club_id in (select public.user_club_ids()))
  with check (club_id in (select public.user_club_ids()));

drop policy if exists access_control_events_club_all
  on public.access_control_events;
create policy access_control_events_club_all
  on public.access_control_events for all to authenticated
  using (club_id in (select public.user_club_ids()))
  with check (club_id in (select public.user_club_ids()));

drop policy if exists access_control_reservations_club_all
  on public.access_control_reservations;
create policy access_control_reservations_club_all
  on public.access_control_reservations for all to authenticated
  using (club_id in (select public.user_club_ids()))
  with check (club_id in (select public.user_club_ids()));

-- Policies preserve tenant semantics, while credentials, connection secrets
-- and raw payloads remain unavailable directly because privileges are revoked.
revoke all on public.access_control_integrations,
  public.access_control_credentials,
  public.access_control_events,
  public.access_control_reservations
from public, anon, authenticated;

grant select, insert, update, delete on public.access_control_integrations,
  public.access_control_credentials,
  public.access_control_events,
  public.access_control_reservations
to service_role;

-- Reserve the remaining visit during an online access decision. This prevents
-- two near-simultaneous readers from authorizing the last available visit.
create or replace function public.reserve_access_control_entry(
  p_integration_id uuid,
  p_club_id uuid,
  p_provider text,
  p_external_event_id text,
  p_credential_uid text,
  p_client_id uuid,
  p_occurred_at timestamptz,
  p_event_fingerprint text,
  p_access_request_id text default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event public.access_control_events%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_reservation public.access_control_reservations%rowtype;
  v_reserved_count integer;
  v_local_date date;
begin
  if p_event_fingerprint !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('allowed', false, 'reasonCode', 'invalid_event_fingerprint');
  end if;

  if p_occurred_at < now() - interval '2 minutes'
     or p_occurred_at > now() + interval '2 minutes' then
    return jsonb_build_object('allowed', false, 'reasonCode', 'stale_access_request');
  end if;

  if not exists (
    select 1 from public.access_control_integrations
     where id = p_integration_id and club_id = p_club_id and provider = p_provider
       and status <> 'disabled'
  ) or not exists (
    select 1 from public.clients where id = p_client_id and club_id = p_club_id
  ) then
    return jsonb_build_object('allowed', false, 'reasonCode', 'invalid_tenant_reference');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_club_id::text || ':' || p_client_id::text, 0));

  insert into public.access_control_events (
    club_id, integration_id, provider, external_event_id, event_fingerprint, event_type, direction,
    credential_uid, client_id, decision, occurred_at, payload
  ) values (
    p_club_id, p_integration_id, p_provider, p_external_event_id, p_event_fingerprint, 'access_request', 'entry',
    p_credential_uid, p_client_id, 'received', p_occurred_at, coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (integration_id, event_type, external_event_id) do nothing
  returning * into v_event;

  if not found then
    select *
      into v_event
      from public.access_control_events
     where integration_id = p_integration_id
       and event_type = 'access_request'
       and external_event_id = p_external_event_id;

    if v_event.event_fingerprint <> p_event_fingerprint then
      return jsonb_build_object('allowed', false, 'reasonCode', 'idempotency_conflict');
    end if;

    if v_event.decision = 'allowed' and not exists (
      select 1
        from public.access_control_reservations
       where integration_id = p_integration_id
         and external_request_id = p_external_event_id
         and consumed_at is null
         and expires_at > now()
    ) then
      return jsonb_build_object('allowed', false, 'reasonCode', 'expired_access_decision');
    end if;

    return jsonb_build_object(
      'allowed', v_event.decision = 'allowed',
      'reasonCode', coalesce(v_event.reason_code, 'already_processed'),
      'subscriptionId', v_event.subscription_id
    );
  end if;

  v_local_date := (now() at time zone 'Asia/Tashkent')::date;

  select s.*
    into v_subscription
    from public.subscriptions s
   where s.club_id = p_club_id
     and s.client_id = p_client_id
     and s.status = 'active'
     and s.starts_at <= v_local_date
     and (s.expires_at is null or s.expires_at >= v_local_date)
   order by s.expires_at desc nulls first, s.created_at desc
   limit 1
   for update;

  if not found then
    update public.access_control_events
       set decision = 'denied',
           reason_code = 'no_active_subscription',
           reason_message = 'Нет активного абонемента',
           processed_at = now()
     where id = v_event.id;
    return jsonb_build_object('allowed', false, 'reasonCode', 'no_active_subscription');
  end if;

  select count(*)::integer
    into v_reserved_count
    from public.access_control_reservations
   where club_id = p_club_id
     and subscription_id = v_subscription.id
     and consumed_at is null
     and expires_at > now();

  if v_subscription.visits_total is not null
     and v_subscription.visits_used + v_reserved_count >= v_subscription.visits_total then
    update public.access_control_events
       set subscription_id = v_subscription.id,
           decision = 'denied',
           reason_code = 'visit_limit_exhausted',
           reason_message = 'Лимит посещений исчерпан',
           processed_at = now()
     where id = v_event.id;
    return jsonb_build_object('allowed', false, 'reasonCode', 'visit_limit_exhausted');
  end if;

  insert into public.access_control_reservations (
    club_id, integration_id, external_request_id, credential_uid,
    client_id, subscription_id, expires_at
  ) values (
    p_club_id, p_integration_id, p_external_event_id, p_credential_uid,
    p_client_id, v_subscription.id, now() + interval '20 seconds'
  )
  on conflict (integration_id, external_request_id)
  do update set external_request_id = excluded.external_request_id
  returning * into v_reservation;

  update public.access_control_events
     set subscription_id = v_subscription.id,
         decision = 'allowed',
         reason_code = 'active_subscription',
         reason_message = 'Проход разрешён',
         processed_at = now()
   where id = v_event.id;

  return jsonb_build_object(
    'allowed', true,
    'reasonCode', 'active_subscription',
    'subscriptionId', v_subscription.id,
    'reservationId', v_reservation.id,
    'reservationExpiresAt', v_reservation.expires_at
  );
exception
  when others then
    return jsonb_build_object('allowed', false, 'reasonCode', 'processing_error');
end;
$$;

-- Insert the confirmed passage event and create the visit in the same
-- transaction. Advisory locking serializes the client's quota across readers.
create or replace function public.process_access_control_entry(
  p_integration_id uuid,
  p_club_id uuid,
  p_provider text,
  p_external_event_id text,
  p_credential_uid text,
  p_client_id uuid,
  p_occurred_at timestamptz,
  p_event_fingerprint text,
  p_access_request_id text default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event public.access_control_events%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_reservation public.access_control_reservations%rowtype;
  v_visit_id uuid;
  v_reserved_count integer;
  v_local_date date;
begin
  if p_event_fingerprint !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('allowed', false, 'reasonCode', 'invalid_event_fingerprint');
  end if;

  if not exists (
    select 1 from public.access_control_integrations
     where id = p_integration_id and club_id = p_club_id and provider = p_provider
       and status <> 'disabled'
  ) or not exists (
    select 1 from public.clients where id = p_client_id and club_id = p_club_id
  ) then
    return jsonb_build_object('allowed', false, 'reasonCode', 'invalid_tenant_reference');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_club_id::text || ':' || p_client_id::text, 0));

  insert into public.access_control_events (
    club_id, integration_id, provider, external_event_id, event_fingerprint, event_type, direction,
    credential_uid, client_id, decision, occurred_at, payload
  ) values (
    p_club_id, p_integration_id, p_provider, p_external_event_id, p_event_fingerprint, 'passage', 'entry',
    p_credential_uid, p_client_id, 'received', p_occurred_at, coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (integration_id, event_type, external_event_id) do nothing
  returning * into v_event;

  if not found then
    select *
      into v_event
      from public.access_control_events
     where integration_id = p_integration_id
       and event_type = 'passage'
       and external_event_id = p_external_event_id;

    if v_event.event_fingerprint <> p_event_fingerprint then
      return jsonb_build_object('allowed', false, 'reasonCode', 'idempotency_conflict');
    end if;

    return jsonb_build_object(
      'allowed', v_event.decision = 'allowed',
      'reasonCode', coalesce(v_event.reason_code, 'already_processed'),
      'visitId', v_event.visit_id,
      'subscriptionId', v_event.subscription_id
    );
  end if;

  if p_occurred_at < now() - interval '15 minutes'
     or p_occurred_at > now() + interval '2 minutes' then
    update public.access_control_events
       set decision = 'ignored',
           reason_code = 'stale_passage',
           reason_message = 'Событие вне допустимого временного окна',
           processed_at = now()
     where id = v_event.id;
    return jsonb_build_object('allowed', false, 'reasonCode', 'stale_passage');
  end if;

  if exists (
    select 1 from public.access_control_events e
     where e.integration_id = p_integration_id
       and e.credential_uid = p_credential_uid
       and e.event_type = 'passage'
       and e.direction = 'entry'
       and e.decision = 'allowed'
       and e.id <> v_event.id
       and e.occurred_at between p_occurred_at - interval '30 seconds'
                             and p_occurred_at + interval '30 seconds'
  ) then
    update public.access_control_events
       set decision = 'ignored',
           reason_code = 'anti_passback',
           reason_message = 'Повторный проход в течение 30 секунд',
           processed_at = now()
     where id = v_event.id;
    return jsonb_build_object('allowed', false, 'reasonCode', 'anti_passback');
  end if;

  v_local_date := (now() at time zone 'Asia/Tashkent')::date;

  select s.*
    into v_subscription
    from public.subscriptions s
   where s.club_id = p_club_id
     and s.client_id = p_client_id
     and s.status = 'active'
     and s.starts_at <= v_local_date
     and (s.expires_at is null or s.expires_at >= v_local_date)
   order by s.expires_at desc nulls first, s.created_at desc
   limit 1
   for update;

  if not found then
    update public.access_control_events
       set decision = 'denied',
           reason_code = 'no_active_subscription',
           reason_message = 'Нет активного абонемента',
           processed_at = now()
     where id = v_event.id;
    return jsonb_build_object('allowed', false, 'reasonCode', 'no_active_subscription');
  end if;

  select *
    into v_reservation
    from public.access_control_reservations
   where club_id = p_club_id
     and integration_id = p_integration_id
     and p_access_request_id is not null
     and external_request_id = p_access_request_id
     and credential_uid = p_credential_uid
     and client_id = p_client_id
     and subscription_id = v_subscription.id
     and consumed_at is null
     and expires_at > now()
   order by created_at desc
   limit 1
   for update;

  select count(*)::integer
    into v_reserved_count
    from public.access_control_reservations
   where club_id = p_club_id
     and subscription_id = v_subscription.id
     and consumed_at is null
     and expires_at > now()
     and (v_reservation.id is null or id <> v_reservation.id);

  if v_subscription.visits_total is not null
     and v_subscription.visits_used + v_reserved_count >= v_subscription.visits_total then
    update public.access_control_events
       set subscription_id = v_subscription.id,
           decision = 'denied',
           reason_code = 'visit_limit_exhausted',
           reason_message = 'Лимит посещений исчерпан',
           processed_at = now()
     where id = v_event.id;
    return jsonb_build_object('allowed', false, 'reasonCode', 'visit_limit_exhausted');
  end if;

  insert into public.visits (
    club_id, client_id, subscription_id, checked_in_at, method
  ) values (
    p_club_id, p_client_id, v_subscription.id, p_occurred_at, 'turnstile'
  )
  returning id into v_visit_id;

  if v_subscription.visits_total is not null then
    update public.subscriptions
       set visits_used = visits_used + 1
     where id = v_subscription.id
       and club_id = p_club_id;
  end if;

  if v_reservation.id is not null then
    update public.access_control_reservations
       set consumed_at = now()
     where id = v_reservation.id and club_id = p_club_id;
  end if;

  update public.access_control_events
     set subscription_id = v_subscription.id,
         visit_id = v_visit_id,
         decision = 'allowed',
         reason_code = 'active_subscription',
         reason_message = 'Проход разрешён',
         processed_at = now()
   where id = v_event.id;

  return jsonb_build_object(
    'allowed', true,
    'reasonCode', 'active_subscription',
    'visitId', v_visit_id,
    'subscriptionId', v_subscription.id
  );
exception
  when others then
    return jsonb_build_object('allowed', false, 'reasonCode', 'processing_error');
end;
$$;

revoke all on function public.reserve_access_control_entry(uuid, uuid, text, text, text, uuid, timestamptz, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.reserve_access_control_entry(uuid, uuid, text, text, text, uuid, timestamptz, text, text, jsonb)
  to service_role;

revoke all on function public.process_access_control_entry(uuid, uuid, text, text, text, uuid, timestamptz, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_access_control_entry(uuid, uuid, text, text, text, uuid, timestamptz, text, text, jsonb)
  to service_role;
