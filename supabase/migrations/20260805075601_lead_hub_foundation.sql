-- Lead Hub foundation.
--
-- The Data API is read-only for authenticated users. Every mutation is exposed
-- through a service-role-only RPC and is expected to be called by a Server
-- Action after getCurrentClub() + can(...). RPCs still enforce tenant identity,
-- active staff references, optimistic versions and platform subscription state.

create schema if not exists private;

-- Composite tenant keys make it impossible for a service-role bug to connect a
-- lead record to a staff member or client from another club.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.staff'::regclass
       and conname = 'staff_club_id_id_key'
  ) then
    alter table public.staff
      add constraint staff_club_id_id_key unique (club_id, id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.clients'::regclass
       and conname = 'clients_club_id_id_key'
  ) then
    alter table public.clients
      add constraint clients_club_id_id_key unique (club_id, id);
  end if;
end
$$;

create table if not exists public.lead_settings (
  club_id                    uuid primary key references public.clubs(id) on delete cascade,
  duplicate_lookback_days    integer not null default 90
    check (duplicate_lookback_days between 1 and 3650),
  stale_after_days           integer not null default 7
    check (stale_after_days between 1 and 365),
  first_response_sla_minutes integer not null default 15
    check (first_response_sla_minutes between 1 and 10080),
  require_loss_reason        boolean not null default true,
  default_assignee_staff_id  uuid,
  updated_by_staff_id        uuid,
  version                    bigint not null default 1 check (version > 0),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint lead_settings_default_assignee_tenant_fkey
    foreign key (club_id, default_assignee_staff_id)
    references public.staff (club_id, id)
    on delete set null (default_assignee_staff_id),
  constraint lead_settings_updated_by_tenant_fkey
    foreign key (club_id, updated_by_staff_id)
    references public.staff (club_id, id)
    on delete set null (updated_by_staff_id)
);

create table if not exists public.lead_sources (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  key          text not null check (key ~ '^[a-z][a-z0-9_]{0,63}$'),
  name         text not null check (char_length(btrim(name)) between 1 and 100),
  category     text not null default 'other'
    check (category in ('offline', 'digital', 'referral', 'partner', 'import', 'other')),
  icon_key     text,
  color_token  text,
  position     integer not null default 0,
  is_system    boolean not null default false,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint lead_sources_club_key_key unique (club_id, key),
  constraint lead_sources_club_id_id_key unique (club_id, id)
);

create table if not exists public.lead_pipeline_stages (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  key          text not null check (key ~ '^[a-z][a-z0-9_]{0,63}$'),
  name         text not null check (char_length(btrim(name)) between 1 and 100),
  kind         text not null default 'open' check (kind in ('open', 'won', 'lost')),
  tone         text not null default 'neutral'
    check (tone in ('neutral', 'brand', 'warning', 'success', 'destructive')),
  probability  smallint not null default 0 check (probability between 0 and 100),
  position     integer not null default 0,
  is_system    boolean not null default false,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint lead_pipeline_stages_club_key_key unique (club_id, key),
  constraint lead_pipeline_stages_club_id_id_key unique (club_id, id)
);

create index if not exists lead_sources_order_idx
  on public.lead_sources (club_id, is_active desc, position, id);

create unique index if not exists lead_pipeline_stages_one_won_idx
  on public.lead_pipeline_stages (club_id)
  where kind = 'won';

create unique index if not exists lead_pipeline_stages_one_lost_idx
  on public.lead_pipeline_stages (club_id)
  where kind = 'lost';

create index if not exists lead_pipeline_stages_order_idx
  on public.lead_pipeline_stages (club_id, is_active desc, position, id);

create table if not exists public.lead_loss_reasons (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  key         text not null check (key ~ '^[a-z][a-z0-9_]{0,63}$'),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  position    integer not null default 0,
  is_system   boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint lead_loss_reasons_club_key_key unique (club_id, key),
  constraint lead_loss_reasons_club_id_id_key unique (club_id, id)
);

create index if not exists lead_loss_reasons_order_idx
  on public.lead_loss_reasons (club_id, is_active desc, position, id);

create table if not exists public.leads (
  id                    uuid primary key default gen_random_uuid(),
  lead_no               bigint generated always as identity,
  club_id               uuid not null references public.clubs(id) on delete cascade,
  full_name             text not null
    check (char_length(btrim(full_name)) between 1 and 200),
  phone                 text,
  phone_normalized      text generated always as (
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
  ) stored,
  email                 text,
  email_normalized      text generated always as (nullif(lower(btrim(email)), '')) stored,
  telegram_username     text,
  source_id             uuid not null,
  source_detail         text,
  stage_id              uuid not null,
  state                 text not null default 'open' check (state in ('open', 'won', 'lost')),
  loss_reason_id        uuid,
  loss_note             text,
  assigned_staff_id     uuid,
  created_by_staff_id   uuid,
  converted_client_id   uuid,
  archived_by_staff_id  uuid,
  external_ref          text,
  interest              text,
  estimated_value       numeric(14,2) check (estimated_value is null or estimated_value >= 0),
  currency              text not null default 'UZS' check (currency = 'UZS'),
  notes                 text,
  tags                  text[] not null default '{}',
  priority              text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  preferred_channel     text
    check (preferred_channel is null or preferred_channel in
      ('phone', 'telegram', 'whatsapp', 'instagram', 'email', 'other')),
  last_activity_at      timestamptz not null default now(),
  last_contacted_at     timestamptz,
  first_response_due_at timestamptz not null default (now() + interval '15 minutes'),
  first_response_at     timestamptz,
  next_action_at        timestamptz,
  won_at                timestamptz,
  lost_at               timestamptz,
  closed_at             timestamptz,
  converted_at          timestamptz,
  archived_at           timestamptz,
  archived_reason       text,
  version               bigint not null default 1 check (version > 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint leads_club_id_id_key unique (club_id, id),
  constraint leads_club_lead_no_key unique (club_id, lead_no),
  constraint leads_source_tenant_fkey
    foreign key (club_id, source_id)
    references public.lead_sources (club_id, id),
  constraint leads_stage_tenant_fkey
    foreign key (club_id, stage_id)
    references public.lead_pipeline_stages (club_id, id),
  constraint leads_loss_reason_tenant_fkey
    foreign key (club_id, loss_reason_id)
    references public.lead_loss_reasons (club_id, id),
  constraint leads_assigned_staff_tenant_fkey
    foreign key (club_id, assigned_staff_id)
    references public.staff (club_id, id)
    on delete set null (assigned_staff_id),
  constraint leads_created_by_staff_tenant_fkey
    foreign key (club_id, created_by_staff_id)
    references public.staff (club_id, id)
    on delete set null (created_by_staff_id),
  constraint leads_archived_by_staff_tenant_fkey
    foreign key (club_id, archived_by_staff_id)
    references public.staff (club_id, id)
    on delete set null (archived_by_staff_id),
  constraint leads_converted_client_tenant_fkey
    foreign key (club_id, converted_client_id)
    references public.clients (club_id, id)
    on delete set null (converted_client_id),
  constraint leads_contact_required_check check (
    nullif(btrim(phone), '') is not null
    or nullif(btrim(email), '') is not null
    or nullif(btrim(telegram_username), '') is not null
  ),
  constraint leads_state_lifecycle_check check (
    (state = 'open'
      and won_at is null and lost_at is null and closed_at is null
      and converted_at is null and converted_client_id is null)
    or (state = 'lost'
      and won_at is null and lost_at is not null and closed_at is not null
      and converted_at is null and converted_client_id is null)
    or (state = 'won'
      and won_at is not null and lost_at is null and closed_at is not null
      and converted_at is not null)
  )
);

create unique index if not exists leads_club_external_ref_key
  on public.leads (club_id, external_ref)
  where external_ref is not null;

create index if not exists leads_club_active_created_idx
  on public.leads (club_id, created_at desc, id desc)
  where archived_at is null;

create index if not exists leads_club_stage_active_idx
  on public.leads (club_id, stage_id, updated_at desc, id desc)
  where archived_at is null;

create index if not exists leads_club_assignee_queue_idx
  on public.leads (club_id, assigned_staff_id, next_action_at, id)
  where archived_at is null;

create index if not exists leads_club_next_action_idx
  on public.leads (club_id, next_action_at, id)
  where archived_at is null and next_action_at is not null;

create index if not exists leads_club_source_created_idx
  on public.leads (club_id, source_id, created_at desc);

create index if not exists leads_club_phone_normalized_idx
  on public.leads (club_id, phone_normalized)
  where phone_normalized is not null;

create index if not exists leads_club_email_normalized_idx
  on public.leads (club_id, email_normalized)
  where email_normalized is not null;

create index if not exists leads_full_name_trgm_idx
  on public.leads using gin (full_name gin_trgm_ops);

create table if not exists public.lead_tasks (
  id                     uuid primary key default gen_random_uuid(),
  club_id                uuid not null references public.clubs(id) on delete cascade,
  lead_id                uuid not null,
  type                   text not null check (type ~ '^[a-z][a-z0-9_]{0,63}$'),
  title                  text not null check (char_length(btrim(title)) between 1 and 200),
  note                   text,
  due_at                 timestamptz not null,
  assigned_staff_id      uuid,
  created_by_staff_id    uuid,
  completed_by_staff_id  uuid,
  cancelled_by_staff_id  uuid,
  priority               text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status                 text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled')),
  outcome                text,
  completed_at           timestamptz,
  cancelled_at           timestamptz,
  version                bigint not null default 1 check (version > 0),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint lead_tasks_club_id_id_key unique (club_id, id),
  constraint lead_tasks_lead_tenant_fkey
    foreign key (club_id, lead_id)
    references public.leads (club_id, id) on delete cascade,
  constraint lead_tasks_assigned_staff_tenant_fkey
    foreign key (club_id, assigned_staff_id)
    references public.staff (club_id, id)
    on delete set null (assigned_staff_id),
  constraint lead_tasks_created_by_staff_tenant_fkey
    foreign key (club_id, created_by_staff_id)
    references public.staff (club_id, id)
    on delete set null (created_by_staff_id),
  constraint lead_tasks_completed_by_staff_tenant_fkey
    foreign key (club_id, completed_by_staff_id)
    references public.staff (club_id, id)
    on delete set null (completed_by_staff_id),
  constraint lead_tasks_cancelled_by_staff_tenant_fkey
    foreign key (club_id, cancelled_by_staff_id)
    references public.staff (club_id, id)
    on delete set null (cancelled_by_staff_id),
  constraint lead_tasks_resolution_check check (
    (status = 'pending' and completed_at is null and cancelled_at is null)
    or (status = 'completed' and completed_at is not null and cancelled_at is null)
    or (status = 'cancelled' and completed_at is null and cancelled_at is not null)
  )
);

create index if not exists lead_tasks_assignee_open_due_idx
  on public.lead_tasks (club_id, assigned_staff_id, due_at, id)
  where status = 'pending';

create index if not exists lead_tasks_lead_timeline_idx
  on public.lead_tasks (club_id, lead_id, created_at desc, id desc);

create table if not exists public.lead_activities (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade,
  lead_id         uuid not null,
  created_by_staff_id uuid,
  kind            text not null check (kind ~ '^[a-z][a-z0-9_]{0,63}$'),
  channel         text check (channel is null or channel ~ '^[a-z][a-z0-9_]{0,63}$'),
  direction       text check (direction is null or direction in ('inbound', 'outbound', 'internal')),
  outcome         text,
  body            text,
  metadata        jsonb not null default '{}',
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint lead_activities_club_id_id_key unique (club_id, id),
  constraint lead_activities_lead_tenant_fkey
    foreign key (club_id, lead_id)
    references public.leads (club_id, id) on delete cascade,
  constraint lead_activities_created_by_staff_tenant_fkey
    foreign key (club_id, created_by_staff_id)
    references public.staff (club_id, id)
    on delete set null (created_by_staff_id)
);

create index if not exists lead_activities_lead_timeline_idx
  on public.lead_activities (club_id, lead_id, occurred_at desc, id desc);

create index if not exists lead_activities_club_kind_idx
  on public.lead_activities (club_id, kind, occurred_at desc);

create table if not exists public.lead_stage_history (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid not null references public.clubs(id) on delete cascade,
  lead_id           uuid not null,
  from_stage_id     uuid,
  to_stage_id       uuid not null,
  loss_reason_id    uuid,
  note              text,
  changed_by_staff_id uuid,
  lead_version      bigint not null check (lead_version > 0),
  changed_at        timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  constraint lead_stage_history_club_id_id_key unique (club_id, id),
  constraint lead_stage_history_lead_tenant_fkey
    foreign key (club_id, lead_id)
    references public.leads (club_id, id) on delete cascade,
  constraint lead_stage_history_from_stage_tenant_fkey
    foreign key (club_id, from_stage_id)
    references public.lead_pipeline_stages (club_id, id),
  constraint lead_stage_history_to_stage_tenant_fkey
    foreign key (club_id, to_stage_id)
    references public.lead_pipeline_stages (club_id, id),
  constraint lead_stage_history_loss_reason_tenant_fkey
    foreign key (club_id, loss_reason_id)
    references public.lead_loss_reasons (club_id, id),
  constraint lead_stage_history_changed_by_staff_tenant_fkey
    foreign key (club_id, changed_by_staff_id)
    references public.staff (club_id, id)
    on delete set null (changed_by_staff_id)
);

create index if not exists lead_stage_history_lead_timeline_idx
  on public.lead_stage_history (club_id, lead_id, changed_at desc, id desc);

create index if not exists lead_stage_history_stage_analytics_idx
  on public.lead_stage_history (club_id, to_stage_id, changed_at desc);

create table if not exists public.lead_trials (
  id                     uuid primary key default gen_random_uuid(),
  club_id                uuid not null references public.clubs(id) on delete cascade,
  lead_id                uuid not null,
  title                  text not null default 'Пробная тренировка'
    check (char_length(btrim(title)) between 1 and 200),
  scheduled_at           timestamptz not null,
  duration_minutes       integer not null default 60
    check (duration_minutes between 15 and 480),
  trainer_staff_id       uuid,
  scheduled_by_staff_id  uuid,
  resolved_by_staff_id   uuid,
  status                 text not null default 'scheduled'
    check (status in ('scheduled', 'attended', 'no_show', 'cancelled')),
  notes                  text,
  outcome_notes          text,
  attended_at            timestamptz,
  version                bigint not null default 1 check (version > 0),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint lead_trials_club_id_id_key unique (club_id, id),
  constraint lead_trials_lead_tenant_fkey
    foreign key (club_id, lead_id)
    references public.leads (club_id, id) on delete cascade,
  constraint lead_trials_trainer_staff_tenant_fkey
    foreign key (club_id, trainer_staff_id)
    references public.staff (club_id, id)
    on delete set null (trainer_staff_id),
  constraint lead_trials_scheduled_by_staff_tenant_fkey
    foreign key (club_id, scheduled_by_staff_id)
    references public.staff (club_id, id)
    on delete set null (scheduled_by_staff_id),
  constraint lead_trials_resolved_by_staff_tenant_fkey
    foreign key (club_id, resolved_by_staff_id)
    references public.staff (club_id, id)
    on delete set null (resolved_by_staff_id),
  constraint lead_trials_resolution_check check (
    (status = 'attended' and attended_at is not null)
    or (status <> 'attended' and attended_at is null)
  )
);

create index if not exists lead_trials_scheduled_queue_idx
  on public.lead_trials (club_id, scheduled_at, id)
  where status = 'scheduled';

create index if not exists lead_trials_lead_timeline_idx
  on public.lead_trials (club_id, lead_id, scheduled_at desc, id desc);

create table if not exists public.lead_conversions (
  id                     uuid primary key default gen_random_uuid(),
  club_id                uuid not null references public.clubs(id) on delete cascade,
  lead_id                uuid not null,
  client_id              uuid,
  converted_by_staff_id  uuid,
  idempotency_key        text not null check (char_length(btrim(idempotency_key)) between 1 and 240),
  conversion_type        text not null check (conversion_type in ('new_client', 'existing_client')),
  lead_snapshot          jsonb not null default '{}',
  converted_at           timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  constraint lead_conversions_club_id_id_key unique (club_id, id),
  constraint lead_conversions_club_lead_key unique (club_id, lead_id),
  constraint lead_conversions_club_idempotency_key unique (club_id, idempotency_key),
  constraint lead_conversions_lead_tenant_fkey
    foreign key (club_id, lead_id)
    references public.leads (club_id, id) on delete cascade,
  constraint lead_conversions_client_tenant_fkey
    foreign key (club_id, client_id)
    references public.clients (club_id, id)
    on delete set null (client_id),
  constraint lead_conversions_staff_tenant_fkey
    foreign key (club_id, converted_by_staff_id)
    references public.staff (club_id, id)
    on delete set null (converted_by_staff_id)
);

create index if not exists lead_conversions_client_idx
  on public.lead_conversions (club_id, client_id, converted_at desc);

-- Mutable lead records keep updated_at reliable even when a future service-side
-- administrative action writes a catalog row directly.
create or replace function private.set_lead_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

revoke all on function private.set_lead_updated_at() from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'lead_settings', 'lead_sources', 'lead_pipeline_stages', 'lead_loss_reasons',
    'leads', 'lead_tasks', 'lead_trials'
  ] loop
    execute format('drop trigger if exists set_lead_updated_at on public.%I', v_table);
    execute format(
      'create trigger set_lead_updated_at before update on public.%I for each row execute function private.set_lead_updated_at()',
      v_table
    );
  end loop;
end
$$;

create or replace function public.create_lead(
  p_club_id uuid,
  p_actor_staff_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_source_key text,
  p_assigned_staff_id uuid,
  p_interest text,
  p_estimated_value numeric,
  p_notes text,
  p_allow_duplicate boolean,
  p_external_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_source_id uuid;
  v_stage_id uuid;
  v_assignee_id uuid := p_assigned_staff_id;
  v_full_name text := nullif(btrim(p_full_name), '');
  v_phone text := nullif(btrim(p_phone), '');
  v_email text := nullif(btrim(p_email), '');
  v_external_ref text := nullif(btrim(p_external_ref), '');
  v_phone_normalized text;
  v_email_normalized text;
  v_candidates jsonb := '[]'::jsonb;
  v_lookback_days integer := 90;
  v_sla_minutes integer := 15;
begin
  perform private.require_lead_actor(p_club_id, p_actor_staff_id);

  if v_full_name is null or char_length(v_full_name) > 200 then
    raise exception 'lead_full_name_invalid';
  end if;
  if p_estimated_value is not null and p_estimated_value < 0 then
    raise exception 'lead_estimated_value_invalid';
  end if;

  select s.duplicate_lookback_days, s.first_response_sla_minutes,
         s.default_assignee_staff_id
    into v_lookback_days, v_sla_minutes, v_assignee_id
    from public.lead_settings s
   where s.club_id = p_club_id
     and p_assigned_staff_id is null;

  if p_assigned_staff_id is not null then
    v_assignee_id := p_assigned_staff_id;
  end if;
  v_lookback_days := coalesce(v_lookback_days, 90);
  v_sla_minutes := coalesce(v_sla_minutes, 15);
  perform private.require_active_lead_staff(
    p_club_id, v_assignee_id, 'lead_assignee_not_active_in_club'
  );

  select src.id
    into v_source_id
    from public.lead_sources src
   where src.club_id = p_club_id
     and src.key = coalesce(nullif(btrim(p_source_key), ''), 'manual')
     and src.is_active = true
   limit 1;
  if v_source_id is null then raise exception 'lead_source_not_found'; end if;

  select st.id
    into v_stage_id
    from public.lead_pipeline_stages st
   where st.club_id = p_club_id
     and st.key = 'new'
     and st.kind = 'open'
     and st.is_active = true
   limit 1;
  if v_stage_id is null then raise exception 'lead_initial_stage_not_found'; end if;

  v_phone_normalized := private.normalize_lead_phone(v_phone);
  v_email_normalized := nullif(lower(btrim(v_email)), '');

  -- external_ref is an import/upstream identity and is never duplicated, even
  -- when a manager explicitly allows a contact duplicate.
  if v_external_ref is not null then
    perform pg_advisory_xact_lock(
      hashtextextended('lead-external:' || p_club_id::text || ':' || v_external_ref, 0)
    );
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', d.id, 'name', d.full_name, 'type', 'lead',
             'phone', d.phone, 'email', d.email, 'match', 'external_ref'
           ) order by d.created_at desc), '[]'::jsonb)
      into v_candidates
      from (
        select l.id, l.full_name, l.phone, l.email, l.created_at
          from public.leads l
         where l.club_id = p_club_id
           and l.external_ref = v_external_ref
         order by l.created_at desc
         limit 20
      ) d;
    if jsonb_array_length(v_candidates) > 0 then
      return jsonb_build_object(
        'status', 'duplicate', 'lead_id', null, 'version', null,
        'duplicates', v_candidates
      );
    end if;
  end if;

  if not coalesce(p_allow_duplicate, false)
     and (v_phone_normalized is not null or v_email_normalized is not null)
  then
    -- Fixed phone-then-email lock order prevents a burst of the same automatic
    -- source from passing duplicate detection concurrently.
    if v_phone_normalized is not null then
      perform pg_advisory_xact_lock(hashtextextended(
        'lead-contact:' || p_club_id::text || ':phone:' || v_phone_normalized, 0
      ));
    end if;
    if v_email_normalized is not null then
      perform pg_advisory_xact_lock(hashtextextended(
        'lead-contact:' || p_club_id::text || ':email:' || v_email_normalized, 0
      ));
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
             'id', d.id,
             'name', d.full_name,
             'type', d.entity_type,
             'phone', d.phone,
             'email', d.email,
             'match', case
               when d.phone_match and d.email_match then 'phone_email'
               when d.phone_match then 'phone'
               else 'email'
             end
           ) order by d.created_at desc), '[]'::jsonb)
      into v_candidates
      from (
        select matches.*
          from (
            select 'lead'::text as entity_type,
                   l.id, l.full_name, l.phone, l.email, l.created_at,
                   v_phone_normalized is not null
                     and l.phone_normalized = v_phone_normalized as phone_match,
                   v_email_normalized is not null
                     and l.email_normalized = v_email_normalized as email_match
              from public.leads l
             where l.club_id = p_club_id
               and l.archived_at is null
               and l.created_at >= now() - make_interval(days => v_lookback_days)
               and (
                 (v_phone_normalized is not null and l.phone_normalized = v_phone_normalized)
                 or (v_email_normalized is not null and l.email_normalized = v_email_normalized)
               )
            union all
            select 'client'::text as entity_type,
                   c.id, c.full_name, c.phone, c.email, c.created_at,
                   v_phone_normalized is not null
                     and c.phone_normalized = v_phone_normalized as phone_match,
                   v_email_normalized is not null
                     and c.email_normalized = v_email_normalized as email_match
              from public.clients c
             where c.club_id = p_club_id
               and (
                 (v_phone_normalized is not null and c.phone_normalized = v_phone_normalized)
                 or (v_email_normalized is not null and c.email_normalized = v_email_normalized)
               )
          ) matches
         order by matches.created_at desc
         limit 20
      ) d;

    if jsonb_array_length(v_candidates) > 0 then
      return jsonb_build_object(
        'status', 'duplicate', 'lead_id', null, 'version', null,
        'duplicates', v_candidates
      );
    end if;
  end if;

  insert into public.leads (
    club_id, full_name, phone, email, source_id, stage_id, state,
    assigned_staff_id, created_by_staff_id, external_ref, interest,
    estimated_value, notes, preferred_channel, first_response_due_at
  ) values (
    p_club_id, v_full_name, v_phone, v_email, v_source_id, v_stage_id, 'open',
    v_assignee_id, p_actor_staff_id, v_external_ref, nullif(btrim(p_interest), ''),
    p_estimated_value, nullif(btrim(p_notes), ''),
    case when v_phone is not null then 'phone'
         when v_email is not null then 'email'
         else null end,
    now() + make_interval(mins => v_sla_minutes)
  )
  returning id into v_lead_id;

  insert into public.lead_stage_history (
    club_id, lead_id, from_stage_id, to_stage_id,
    changed_by_staff_id, lead_version
  ) values (
    p_club_id, v_lead_id, null, v_stage_id, p_actor_staff_id, 1
  );

  insert into public.lead_activities (
    club_id, lead_id, created_by_staff_id, kind, direction, body, metadata
  ) values (
    p_club_id, v_lead_id, p_actor_staff_id, 'created', 'internal',
    nullif(btrim(p_notes), ''),
    jsonb_build_object('source_key', coalesce(nullif(btrim(p_source_key), ''), 'manual'))
  );

  return jsonb_build_object(
    'status', 'created', 'lead_id', v_lead_id, 'version', 1,
    'duplicates', '[]'::jsonb
  );
end
$$;

create or replace function public.update_lead_details(
  p_club_id uuid,
  p_lead_id uuid,
  p_actor_staff_id uuid,
  p_expected_version bigint,
  p_full_name text,
  p_phone text,
  p_email text,
  p_source_key text,
  p_interest text,
  p_estimated_value numeric,
  p_notes text,
  p_tags text[],
  p_priority text,
  p_preferred_channel text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
  v_source_id uuid;
  v_new_version bigint;
  v_full_name text := nullif(btrim(p_full_name), '');
begin
  perform private.require_lead_actor(p_club_id, p_actor_staff_id);

  if v_full_name is null or char_length(v_full_name) > 200 then
    raise exception 'lead_full_name_invalid';
  end if;
  if p_estimated_value is not null and p_estimated_value < 0 then
    raise exception 'lead_estimated_value_invalid';
  end if;
  if coalesce(p_priority, '') not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'lead_priority_invalid';
  end if;
  if p_preferred_channel is not null
     and p_preferred_channel not in
       ('phone', 'telegram', 'whatsapp', 'instagram', 'email', 'other')
  then
    raise exception 'lead_preferred_channel_invalid';
  end if;

  select src.id
    into v_source_id
    from public.lead_sources src
   where src.club_id = p_club_id
     and src.key = coalesce(nullif(btrim(p_source_key), ''), 'other')
     and src.is_active = true
   limit 1;
  if v_source_id is null then raise exception 'lead_source_not_found'; end if;

  select l.* into v_lead
    from public.leads l
   where l.club_id = p_club_id and l.id = p_lead_id
   for update;
  if not found then raise exception 'lead_not_found'; end if;
  if v_lead.archived_at is not null then raise exception 'lead_archived'; end if;
  if v_lead.state = 'won' then raise exception 'lead_won_immutable'; end if;
  if p_expected_version is distinct from v_lead.version then
    raise exception 'lead_version_conflict';
  end if;

  update public.leads
     set full_name = v_full_name,
         phone = nullif(btrim(p_phone), ''),
         email = nullif(btrim(p_email), ''),
         source_id = v_source_id,
         interest = nullif(btrim(p_interest), ''),
         estimated_value = p_estimated_value,
         notes = nullif(btrim(p_notes), ''),
         tags = coalesce(p_tags, '{}'::text[]),
         priority = p_priority,
         preferred_channel = p_preferred_channel,
         last_activity_at = now(),
         version = version + 1
   where club_id = p_club_id and id = p_lead_id
  returning version into v_new_version;

  insert into public.lead_activities (
    club_id, lead_id, created_by_staff_id, kind, direction, metadata
  ) values (
    p_club_id, p_lead_id, p_actor_staff_id, 'details_updated', 'internal',
    jsonb_build_object('version', v_new_version)
  );

  return jsonb_build_object(
    'status', 'updated', 'lead_id', p_lead_id, 'version', v_new_version
  );
end
$$;

create or replace function public.assign_lead(
  p_club_id uuid,
  p_lead_id uuid,
  p_actor_staff_id uuid,
  p_assignee_staff_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
  v_new_version bigint;
begin
  perform private.require_lead_actor(p_club_id, p_actor_staff_id);
  perform private.require_active_lead_staff(
    p_club_id, p_assignee_staff_id, 'lead_assignee_not_active_in_club'
  );

  select l.* into v_lead
    from public.leads l
   where l.club_id = p_club_id and l.id = p_lead_id
   for update;
  if not found then raise exception 'lead_not_found'; end if;
  if v_lead.archived_at is not null then raise exception 'lead_archived'; end if;
  if v_lead.state = 'won' then raise exception 'lead_won_immutable'; end if;
  if p_expected_version is distinct from v_lead.version then
    raise exception 'lead_version_conflict';
  end if;
  if v_lead.assigned_staff_id is not distinct from p_assignee_staff_id then
    return jsonb_build_object(
      'status', 'unchanged', 'lead_id', p_lead_id, 'version', v_lead.version
    );
  end if;

  update public.leads
     set assigned_staff_id = p_assignee_staff_id,
         last_activity_at = now(),
         version = version + 1
   where club_id = p_club_id and id = p_lead_id
  returning version into v_new_version;

  insert into public.lead_activities (
    club_id, lead_id, created_by_staff_id, kind, direction, metadata
  ) values (
    p_club_id, p_lead_id, p_actor_staff_id, 'assigned', 'internal',
    jsonb_build_object(
      'from_staff_id', v_lead.assigned_staff_id,
      'to_staff_id', p_assignee_staff_id
    )
  );

  return jsonb_build_object(
    'status', 'assigned', 'lead_id', p_lead_id, 'version', v_new_version
  );
end
$$;

create or replace function public.move_lead_stage(
  p_club_id uuid,
  p_lead_id uuid,
  p_actor_staff_id uuid,
  p_stage_key text,
  p_loss_reason_key text,
  p_loss_note text,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
  v_target public.lead_pipeline_stages%rowtype;
  v_loss_reason_id uuid;
  v_require_loss_reason boolean := true;
  v_new_version bigint;
  v_activity_kind text := 'stage_changed';
begin
  perform private.require_lead_actor(p_club_id, p_actor_staff_id);

  select st.* into v_target
    from public.lead_pipeline_stages st
   where st.club_id = p_club_id
     and st.key = nullif(btrim(p_stage_key), '')
     and st.is_active = true
   limit 1;
  if not found then raise exception 'lead_stage_not_found'; end if;
  if v_target.kind = 'won' then raise exception 'lead_won_requires_conversion'; end if;

  select l.* into v_lead
    from public.leads l
   where l.club_id = p_club_id and l.id = p_lead_id
   for update;
  if not found then raise exception 'lead_not_found'; end if;
  if v_lead.archived_at is not null then raise exception 'lead_archived'; end if;
  if v_lead.state = 'won' then raise exception 'converted_lead_cannot_be_reopened'; end if;
  if p_expected_version is distinct from v_lead.version then
    raise exception 'lead_version_conflict';
  end if;
  if v_lead.stage_id = v_target.id then
    return jsonb_build_object(
      'status', 'unchanged', 'lead_id', p_lead_id, 'version', v_lead.version,
      'state', v_lead.state
    );
  end if;
  if v_lead.state = 'lost' and v_target.key not in ('contacted', 'qualified') then
    raise exception 'lead_reopen_stage_invalid';
  end if;
  if v_target.key = 'qualified' and nullif(btrim(v_lead.interest), '') is null then
    raise exception 'lead_interest_required';
  end if;
  if v_target.key = 'trial_booked' and not exists (
    select 1
      from public.lead_trials tr
     where tr.club_id = p_club_id and tr.lead_id = p_lead_id
       and tr.status in ('scheduled', 'attended')
  ) then
    raise exception 'lead_trial_required';
  end if;
  if v_target.key = 'trial_completed' and not exists (
    select 1
      from public.lead_trials tr
     where tr.club_id = p_club_id and tr.lead_id = p_lead_id
       and tr.status = 'attended'
  ) then
    raise exception 'lead_trial_attendance_required';
  end if;

  if v_target.kind = 'lost' then
    select coalesce(s.require_loss_reason, true)
      into v_require_loss_reason
      from public.lead_settings s
     where s.club_id = p_club_id;

    if nullif(btrim(p_loss_reason_key), '') is not null then
      select r.id into v_loss_reason_id
        from public.lead_loss_reasons r
       where r.club_id = p_club_id
         and r.key = btrim(p_loss_reason_key)
         and r.is_active = true
       limit 1;
      if v_loss_reason_id is null then raise exception 'lead_loss_reason_not_found'; end if;
    elsif v_require_loss_reason then
      raise exception 'lead_loss_reason_required';
    end if;

    update public.lead_tasks
       set status = 'cancelled', cancelled_at = now(),
           cancelled_by_staff_id = p_actor_staff_id, version = version + 1
     where club_id = p_club_id and lead_id = p_lead_id and status = 'pending';
    update public.lead_trials
       set status = 'cancelled', resolved_by_staff_id = p_actor_staff_id,
           version = version + 1
     where club_id = p_club_id and lead_id = p_lead_id and status = 'scheduled';

    update public.leads
       set stage_id = v_target.id,
           state = 'lost',
           loss_reason_id = v_loss_reason_id,
           loss_note = nullif(btrim(p_loss_note), ''),
           lost_at = now(), won_at = null, closed_at = now(),
           next_action_at = null,
           first_response_at = coalesce(first_response_at, now()),
           last_activity_at = now(),
           version = version + 1
     where club_id = p_club_id and id = p_lead_id
    returning version into v_new_version;
  else
    if nullif(btrim(p_loss_reason_key), '') is not null
       or nullif(btrim(p_loss_note), '') is not null
    then
      raise exception 'loss_details_only_allowed_for_lost_stage';
    end if;
    if v_lead.state = 'lost' then v_activity_kind := 'reopened'; end if;

    update public.leads
       set stage_id = v_target.id,
           state = 'open',
           loss_reason_id = null,
           loss_note = null,
           lost_at = null,
           closed_at = null,
           next_action_at = private.lead_next_action_at(p_club_id, p_lead_id),
           first_response_at = case
             when v_target.key <> 'new' then coalesce(first_response_at, now())
             else first_response_at
           end,
           last_activity_at = now(),
           version = version + 1
     where club_id = p_club_id and id = p_lead_id
    returning version into v_new_version;
  end if;

  insert into public.lead_stage_history (
    club_id, lead_id, from_stage_id, to_stage_id, loss_reason_id,
    note, changed_by_staff_id, lead_version
  ) values (
    p_club_id, p_lead_id, v_lead.stage_id, v_target.id, v_loss_reason_id,
    nullif(btrim(p_loss_note), ''), p_actor_staff_id, v_new_version
  );

  insert into public.lead_activities (
    club_id, lead_id, created_by_staff_id, kind, direction, body, metadata
  ) values (
    p_club_id, p_lead_id, p_actor_staff_id, v_activity_kind, 'internal',
    nullif(btrim(p_loss_note), ''),
    jsonb_build_object(
      'from_stage_id', v_lead.stage_id,
      'to_stage_id', v_target.id,
      'to_stage_key', v_target.key,
      'loss_reason_id', v_loss_reason_id
    )
  );

  return jsonb_build_object(
    'status', case when v_activity_kind = 'reopened' then 'reopened' else 'moved' end,
    'lead_id', p_lead_id,
    'version', v_new_version,
    'state', v_target.kind
  );
end
$$;

create or replace function public.create_lead_task(
  p_club_id uuid,
  p_lead_id uuid,
  p_actor_staff_id uuid,
  p_type text,
  p_title text,
  p_note text,
  p_due_at timestamptz,
  p_assigned_staff_id uuid,
  p_priority text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
  v_task_id uuid;
  v_assignee_id uuid;
  v_new_version bigint;
begin
  perform private.require_lead_actor(p_club_id, p_actor_staff_id);
  if nullif(btrim(p_type), '') is null
     or btrim(p_type) !~ '^[a-z][a-z0-9_]{0,63}$'
  then raise exception 'lead_task_type_invalid'; end if;
  if nullif(btrim(p_title), '') is null or char_length(btrim(p_title)) > 200 then
    raise exception 'lead_task_title_invalid';
  end if;
  if p_due_at is null or p_due_at <= now() then raise exception 'lead_task_due_at_invalid'; end if;
  if coalesce(p_priority, '') not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'lead_priority_invalid';
  end if;

  select l.* into v_lead
    from public.leads l
   where l.club_id = p_club_id and l.id = p_lead_id
   for update;
  if not found then raise exception 'lead_not_found'; end if;
  if v_lead.archived_at is not null then raise exception 'lead_archived'; end if;
  if v_lead.state <> 'open' then raise exception 'lead_not_open'; end if;

  v_assignee_id := coalesce(p_assigned_staff_id, v_lead.assigned_staff_id, p_actor_staff_id);
  perform private.require_active_lead_staff(
    p_club_id, v_assignee_id, 'lead_task_assignee_not_active_in_club'
  );

  insert into public.lead_tasks (
    club_id, lead_id, type, title, note, due_at, assigned_staff_id,
    created_by_staff_id, priority, status
  ) values (
    p_club_id, p_lead_id, btrim(p_type), btrim(p_title), nullif(btrim(p_note), ''),
    p_due_at, v_assignee_id, p_actor_staff_id, p_priority, 'pending'
  ) returning id into v_task_id;

  update public.leads
     set next_action_at = private.lead_next_action_at(p_club_id, p_lead_id),
         last_activity_at = now(),
         version = version + 1
   where club_id = p_club_id and id = p_lead_id
  returning version into v_new_version;

  insert into public.lead_activities (
    club_id, lead_id, created_by_staff_id, kind, direction, body, metadata
  ) values (
    p_club_id, p_lead_id, p_actor_staff_id, 'task_created', 'internal',
    nullif(btrim(p_note), ''),
    jsonb_build_object('task_id', v_task_id, 'type', btrim(p_type), 'due_at', p_due_at)
  );

  return jsonb_build_object(
    'status', 'created', 'lead_id', p_lead_id, 'task_id', v_task_id,
    'version', v_new_version
  );
end
$$;

create or replace function public.complete_lead_task(
  p_club_id uuid,
  p_lead_id uuid,
  p_task_id uuid,
  p_actor_staff_id uuid,
  p_outcome text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
  v_task public.lead_tasks%rowtype;
  v_new_version bigint;
begin
  perform private.require_lead_actor(p_club_id, p_actor_staff_id);

  select l.* into v_lead
    from public.leads l
   where l.club_id = p_club_id and l.id = p_lead_id
   for update;
  if not found then raise exception 'lead_not_found'; end if;
  if v_lead.archived_at is not null then raise exception 'lead_archived'; end if;

  select t.* into v_task
    from public.lead_tasks t
   where t.club_id = p_club_id and t.lead_id = p_lead_id and t.id = p_task_id
   for update;
  if not found then raise exception 'lead_task_not_found'; end if;
  if v_task.status = 'completed' then
    return jsonb_build_object(
      'status', 'already_completed', 'lead_id', p_lead_id, 'task_id', p_task_id,
      'version', v_lead.version
    );
  end if;
  if v_task.status <> 'pending' then raise exception 'lead_task_not_pending'; end if;

  update public.lead_tasks
     set status = 'completed',
         outcome = nullif(btrim(p_outcome), ''),
         note = case
           when nullif(btrim(p_note), '') is null then note
           when note is null then btrim(p_note)
           else note || E'\n\n' || btrim(p_note)
         end,
         completed_at = now(),
         completed_by_staff_id = p_actor_staff_id,
         version = version + 1
   where club_id = p_club_id and id = p_task_id;

  update public.leads
     set next_action_at = private.lead_next_action_at(p_club_id, p_lead_id),
         last_activity_at = now(),
         last_contacted_at = case
           when v_task.type in ('call', 'message', 'follow_up', 'proposal') then now()
           else last_contacted_at
         end,
         first_response_at = case
           when v_task.type in ('call', 'message', 'follow_up', 'proposal')
             then coalesce(first_response_at, now())
           else first_response_at
         end,
         version = version + 1
   where club_id = p_club_id and id = p_lead_id
  returning version into v_new_version;

  insert into public.lead_activities (
    club_id, lead_id, created_by_staff_id, kind, direction, outcome, body, metadata
  ) values (
    p_club_id, p_lead_id, p_actor_staff_id, 'task_completed', 'internal',
    nullif(btrim(p_outcome), ''), nullif(btrim(p_note), ''),
    jsonb_build_object('task_id', p_task_id, 'type', v_task.type)
  );

  return jsonb_build_object(
    'status', 'completed', 'lead_id', p_lead_id, 'task_id', p_task_id,
    'version', v_new_version
  );
end
$$;

create or replace function public.record_lead_activity(
  p_club_id uuid,
  p_lead_id uuid,
  p_actor_staff_id uuid,
  p_kind text,
  p_channel text,
  p_direction text,
  p_outcome text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
  v_activity_id uuid;
  v_is_contact boolean;
  v_new_version bigint;
begin
  perform private.require_lead_actor(p_club_id, p_actor_staff_id);
  if nullif(btrim(p_kind), '') is null
     or btrim(p_kind) !~ '^[a-z][a-z0-9_]{0,63}$'
  then raise exception 'lead_activity_kind_invalid'; end if;
  if p_channel is not null and btrim(p_channel) !~ '^[a-z][a-z0-9_]{0,63}$' then
    raise exception 'lead_activity_channel_invalid';
  end if;
  if p_direction is not null and p_direction not in ('inbound', 'outbound', 'internal') then
    raise exception 'lead_activity_direction_invalid';
  end if;
  if btrim(p_kind) = 'note' and nullif(btrim(p_body), '') is null then
    raise exception 'lead_activity_body_required';
  end if;

  select l.* into v_lead
    from public.leads l
   where l.club_id = p_club_id and l.id = p_lead_id
   for update;
  if not found then raise exception 'lead_not_found'; end if;
  if v_lead.archived_at is not null then raise exception 'lead_archived'; end if;

  v_is_contact := p_direction in ('inbound', 'outbound')
    or btrim(p_kind) in ('call', 'message', 'email', 'meeting');

  insert into public.lead_activities (
    club_id, lead_id, created_by_staff_id, kind, channel, direction,
    outcome, body
  ) values (
    p_club_id, p_lead_id, p_actor_staff_id, btrim(p_kind),
    nullif(btrim(p_channel), ''), p_direction, nullif(btrim(p_outcome), ''),
    nullif(btrim(p_body), '')
  ) returning id into v_activity_id;

  update public.leads
     set last_activity_at = now(),
         last_contacted_at = case when v_is_contact then now() else last_contacted_at end,
         first_response_at = case
           when v_is_contact then coalesce(first_response_at, now())
           else first_response_at
         end,
         version = version + 1
   where club_id = p_club_id and id = p_lead_id
  returning version into v_new_version;

  return jsonb_build_object(
    'status', 'recorded', 'lead_id', p_lead_id, 'activity_id', v_activity_id,
    'version', v_new_version
  );
end
$$;

create or replace function public.schedule_lead_trial(
  p_club_id uuid,
  p_lead_id uuid,
  p_actor_staff_id uuid,
  p_title text,
  p_scheduled_at timestamptz,
  p_duration_minutes integer,
  p_trainer_staff_id uuid,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
  v_trial_id uuid;
  v_current_position integer;
  v_target_stage public.lead_pipeline_stages%rowtype;
  v_stage_changed boolean := false;
  v_new_version bigint;
begin
  perform private.require_lead_actor(p_club_id, p_actor_staff_id);
  perform private.require_active_lead_staff(
    p_club_id, p_trainer_staff_id, 'lead_trial_trainer_not_active_in_club'
  );
  if nullif(btrim(p_title), '') is null or char_length(btrim(p_title)) > 200 then
    raise exception 'lead_trial_title_invalid';
  end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then
    raise exception 'lead_trial_scheduled_at_invalid';
  end if;
  if p_duration_minutes is null or p_duration_minutes not between 15 and 480 then
    raise exception 'lead_trial_duration_invalid';
  end if;

  select l.* into v_lead
    from public.leads l
   where l.club_id = p_club_id and l.id = p_lead_id
   for update;
  if not found then raise exception 'lead_not_found'; end if;
  if v_lead.archived_at is not null then raise exception 'lead_archived'; end if;
  if v_lead.state <> 'open' then raise exception 'lead_not_open'; end if;

  insert into public.lead_trials (
    club_id, lead_id, title, scheduled_at, duration_minutes,
    trainer_staff_id, scheduled_by_staff_id, status, notes
  ) values (
    p_club_id, p_lead_id, btrim(p_title), p_scheduled_at, p_duration_minutes,
    p_trainer_staff_id, p_actor_staff_id, 'scheduled', nullif(btrim(p_notes), '')
  ) returning id into v_trial_id;

  select st.position into v_current_position
    from public.lead_pipeline_stages st
   where st.club_id = p_club_id and st.id = v_lead.stage_id;
  select st.* into v_target_stage
    from public.lead_pipeline_stages st
   where st.club_id = p_club_id and st.key = 'trial_booked'
     and st.kind = 'open' and st.is_active = true
   limit 1;
  v_stage_changed := found
    and coalesce(v_current_position, -2147483648) < v_target_stage.position;

  update public.leads
     set stage_id = case when v_stage_changed then v_target_stage.id else stage_id end,
         next_action_at = private.lead_next_action_at(p_club_id, p_lead_id),
         first_response_at = coalesce(first_response_at, now()),
         last_contacted_at = now(),
         last_activity_at = now(),
         version = version + 1
   where club_id = p_club_id and id = p_lead_id
  returning version into v_new_version;

  if v_stage_changed then
    insert into public.lead_stage_history (
      club_id, lead_id, from_stage_id, to_stage_id,
      changed_by_staff_id, lead_version
    ) values (
      p_club_id, p_lead_id, v_lead.stage_id, v_target_stage.id,
      p_actor_staff_id, v_new_version
    );
  end if;

  insert into public.lead_activities (
    club_id, lead_id, created_by_staff_id, kind, direction, body, metadata
  ) values (
    p_club_id, p_lead_id, p_actor_staff_id, 'trial_scheduled', 'internal',
    nullif(btrim(p_notes), ''),
    jsonb_build_object(
      'trial_id', v_trial_id, 'scheduled_at', p_scheduled_at,
      'duration_minutes', p_duration_minutes, 'trainer_staff_id', p_trainer_staff_id
    )
  );

  return jsonb_build_object(
    'status', 'scheduled', 'lead_id', p_lead_id, 'trial_id', v_trial_id,
    'version', v_new_version
  );
end
$$;

create or replace function public.mark_lead_trial_outcome(
  p_club_id uuid,
  p_lead_id uuid,
  p_trial_id uuid,
  p_actor_staff_id uuid,
  p_status text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
  v_trial public.lead_trials%rowtype;
  v_current_position integer;
  v_target_stage public.lead_pipeline_stages%rowtype;
  v_stage_changed boolean := false;
  v_new_version bigint;
begin
  perform private.require_lead_actor(p_club_id, p_actor_staff_id);
  if p_status not in ('attended', 'no_show', 'cancelled') then
    raise exception 'lead_trial_outcome_invalid';
  end if;

  select l.* into v_lead
    from public.leads l
   where l.club_id = p_club_id and l.id = p_lead_id
   for update;
  if not found then raise exception 'lead_not_found'; end if;
  if v_lead.archived_at is not null then raise exception 'lead_archived'; end if;

  select tr.* into v_trial
    from public.lead_trials tr
   where tr.club_id = p_club_id and tr.lead_id = p_lead_id and tr.id = p_trial_id
   for update;
  if not found then raise exception 'lead_trial_not_found'; end if;
  if v_trial.status = p_status then
    return jsonb_build_object(
      'status', 'already_recorded', 'lead_id', p_lead_id, 'trial_id', p_trial_id,
      'version', v_lead.version
    );
  end if;
  if v_trial.status <> 'scheduled' then raise exception 'lead_trial_already_resolved'; end if;

  update public.lead_trials
     set status = p_status,
         notes = case
           when nullif(btrim(p_notes), '') is null then notes
           when notes is null then btrim(p_notes)
           else notes || E'\n\n' || btrim(p_notes)
         end,
         outcome_notes = nullif(btrim(p_notes), ''),
         attended_at = case when p_status = 'attended' then now() else null end,
         resolved_by_staff_id = p_actor_staff_id,
         version = version + 1
   where club_id = p_club_id and id = p_trial_id;

  if p_status = 'attended' and v_lead.state = 'open' then
    select st.position into v_current_position
      from public.lead_pipeline_stages st
     where st.club_id = p_club_id and st.id = v_lead.stage_id;
    select st.* into v_target_stage
      from public.lead_pipeline_stages st
     where st.club_id = p_club_id and st.key = 'trial_completed'
       and st.kind = 'open' and st.is_active = true
     limit 1;
    v_stage_changed := found
      and coalesce(v_current_position, -2147483648) < v_target_stage.position;
  end if;

  update public.leads
     set stage_id = case when v_stage_changed then v_target_stage.id else stage_id end,
         next_action_at = private.lead_next_action_at(p_club_id, p_lead_id),
         first_response_at = coalesce(first_response_at, now()),
         last_contacted_at = now(),
         last_activity_at = now(),
         version = version + 1
   where club_id = p_club_id and id = p_lead_id
  returning version into v_new_version;

  if v_stage_changed then
    insert into public.lead_stage_history (
      club_id, lead_id, from_stage_id, to_stage_id,
      changed_by_staff_id, lead_version
    ) values (
      p_club_id, p_lead_id, v_lead.stage_id, v_target_stage.id,
      p_actor_staff_id, v_new_version
    );
  end if;

  insert into public.lead_activities (
    club_id, lead_id, created_by_staff_id, kind, direction, outcome, body, metadata
  ) values (
    p_club_id, p_lead_id, p_actor_staff_id, 'trial_outcome', 'internal',
    p_status, nullif(btrim(p_notes), ''), jsonb_build_object('trial_id', p_trial_id)
  );

  return jsonb_build_object(
    'status', p_status, 'lead_id', p_lead_id, 'trial_id', p_trial_id,
    'version', v_new_version
  );
end
$$;

create or replace function public.convert_lead_to_client(
  p_club_id uuid,
  p_lead_id uuid,
  p_actor_staff_id uuid,
  p_existing_client_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
  v_existing_conversion public.lead_conversions%rowtype;
  v_won_stage_id uuid;
  v_client_id uuid;
  v_client_created boolean := false;
  v_mode text;
  v_source_key text;
  v_duplicates jsonb := '[]'::jsonb;
  v_new_version bigint;
  v_idempotency_key text := nullif(btrim(p_idempotency_key), '');
  v_client_phone_normalized text;
  v_client_email_normalized text;
begin
  perform private.require_lead_actor(p_club_id, p_actor_staff_id);
  if v_idempotency_key is null or char_length(v_idempotency_key) > 240 then
    raise exception 'lead_conversion_idempotency_key_invalid';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('lead-conversion:' || p_club_id::text || ':' || v_idempotency_key, 0)
  );

  select c.* into v_existing_conversion
    from public.lead_conversions c
   where c.club_id = p_club_id and c.idempotency_key = v_idempotency_key
   limit 1;
  if found then
    if v_existing_conversion.lead_id <> p_lead_id then
      raise exception 'lead_conversion_idempotency_key_conflict';
    end if;
    select l.version into v_new_version
      from public.leads l
     where l.club_id = p_club_id and l.id = p_lead_id;
    return jsonb_build_object(
      'status', 'converted', 'lead_id', p_lead_id,
      'client_id', v_existing_conversion.client_id,
      'mode', v_existing_conversion.conversion_type,
      'version', v_new_version
    );
  end if;

  select l.* into v_lead
    from public.leads l
   where l.club_id = p_club_id and l.id = p_lead_id
   for update;
  if not found then raise exception 'lead_not_found'; end if;
  if v_lead.archived_at is not null then raise exception 'lead_archived'; end if;

  select c.* into v_existing_conversion
    from public.lead_conversions c
   where c.club_id = p_club_id and c.lead_id = p_lead_id
   limit 1;
  if found then
    return jsonb_build_object(
      'status', 'converted', 'lead_id', p_lead_id,
      'client_id', v_existing_conversion.client_id,
      'mode', v_existing_conversion.conversion_type,
      'version', v_lead.version
    );
  end if;

  if v_lead.state <> 'open' then raise exception 'lead_not_open'; end if;

  -- Distinct duplicate leads may be converted concurrently. Reuse the same
  -- fixed phone-then-email lock order as lead creation so only one transaction
  -- can recheck and create a client for a normalized contact at a time.
  if v_lead.phone_normalized is not null then
    perform pg_advisory_xact_lock(hashtextextended(
      'lead-contact:' || p_club_id::text || ':phone:' || v_lead.phone_normalized, 0
    ));
  end if;
  if v_lead.email_normalized is not null then
    perform pg_advisory_xact_lock(hashtextextended(
      'lead-contact:' || p_club_id::text || ':email:' || v_lead.email_normalized, 0
    ));
  end if;

  if p_existing_client_id is not null then
    select c.id, c.phone_normalized, c.email_normalized
      into v_client_id, v_client_phone_normalized, v_client_email_normalized
      from public.clients c
     where c.club_id = p_club_id and c.id = p_existing_client_id
     limit 1;
    if v_client_id is null then raise exception 'lead_conversion_client_not_found'; end if;
    if not (
      (v_lead.phone_normalized is not null
        and v_client_phone_normalized = v_lead.phone_normalized)
      or (v_lead.email_normalized is not null
        and v_client_email_normalized = v_lead.email_normalized)
    ) then
      raise exception 'lead_client_identity_mismatch';
    end if;
    v_mode := 'existing_client';
  else
    select coalesce(jsonb_agg(jsonb_build_object(
             'type', 'client', 'id', d.id, 'name', d.full_name,
             'phone', d.phone, 'email', d.email,
             'match', case
               when d.phone_match and d.email_match then 'phone_email'
               when d.phone_match then 'phone'
               else 'email'
             end
           ) order by d.created_at desc), '[]'::jsonb)
      into v_duplicates
      from (
        select c.id, c.full_name, c.phone, c.email, c.created_at,
               v_lead.phone_normalized is not null
                 and c.phone_normalized = v_lead.phone_normalized as phone_match,
               v_lead.email_normalized is not null
                 and c.email_normalized = v_lead.email_normalized as email_match
          from public.clients c
         where c.club_id = p_club_id
           and (
             (v_lead.phone_normalized is not null
               and c.phone_normalized = v_lead.phone_normalized)
             or (v_lead.email_normalized is not null
               and c.email_normalized = v_lead.email_normalized)
           )
         order by c.created_at desc
         limit 20
      ) d;

    if jsonb_array_length(v_duplicates) > 0 then
      return jsonb_build_object(
        'status', 'duplicate', 'lead_id', p_lead_id,
        'version', v_lead.version, 'duplicates', v_duplicates
      );
    end if;

    select src.key into v_source_key
      from public.lead_sources src
     where src.club_id = p_club_id and src.id = v_lead.source_id;

    -- The existing clients plan_record_limit_gate runs for this insert. A quota
    -- failure aborts the whole conversion transaction without partial state.
    insert into public.clients (
      club_id, full_name, phone, email, source, notes, tags
    ) values (
      p_club_id, v_lead.full_name, v_lead.phone, v_lead.email,
      coalesce(v_source_key, 'lead'), v_lead.notes, v_lead.tags
    ) returning id into v_client_id;
    v_mode := 'new_client';
    v_client_created := true;
  end if;

  select st.id into v_won_stage_id
    from public.lead_pipeline_stages st
   where st.club_id = p_club_id and st.kind = 'won'
   limit 1;
  if v_won_stage_id is null then raise exception 'lead_won_stage_not_found'; end if;

  update public.lead_tasks
     set status = 'cancelled', cancelled_at = now(),
         cancelled_by_staff_id = p_actor_staff_id, version = version + 1
   where club_id = p_club_id and lead_id = p_lead_id and status = 'pending';
  update public.lead_trials
     set status = 'cancelled', resolved_by_staff_id = p_actor_staff_id,
         version = version + 1
   where club_id = p_club_id and lead_id = p_lead_id and status = 'scheduled';

  insert into public.lead_conversions (
    club_id, lead_id, client_id, converted_by_staff_id, idempotency_key,
    conversion_type, lead_snapshot
  ) values (
    p_club_id, p_lead_id, v_client_id, p_actor_staff_id, v_idempotency_key,
    v_mode,
    jsonb_build_object(
      'full_name', v_lead.full_name, 'phone', v_lead.phone,
      'email', v_lead.email, 'source_id', v_lead.source_id,
      'estimated_value', v_lead.estimated_value,
      'client_id', v_client_id, 'mode', v_mode
    )
  );

  update public.leads
     set stage_id = v_won_stage_id,
         state = 'won',
         converted_client_id = v_client_id,
         converted_at = now(), won_at = now(), lost_at = null, closed_at = now(),
         loss_reason_id = null, loss_note = null,
         next_action_at = null,
         first_response_at = coalesce(first_response_at, now()),
         last_activity_at = now(),
         version = version + 1
   where club_id = p_club_id and id = p_lead_id
  returning version into v_new_version;

  insert into public.lead_stage_history (
    club_id, lead_id, from_stage_id, to_stage_id,
    changed_by_staff_id, lead_version
  ) values (
    p_club_id, p_lead_id, v_lead.stage_id, v_won_stage_id,
    p_actor_staff_id, v_new_version
  );

  insert into public.lead_activities (
    club_id, lead_id, created_by_staff_id, kind, direction, metadata
  ) values (
    p_club_id, p_lead_id, p_actor_staff_id, 'converted', 'internal',
    jsonb_build_object(
      'client_id', v_client_id, 'mode', v_mode, 'client_created', v_client_created
    )
  );

  return jsonb_build_object(
    'status', 'converted', 'lead_id', p_lead_id, 'client_id', v_client_id,
    'mode', v_mode, 'version', v_new_version
  );
end
$$;

create or replace function public.archive_lead(
  p_club_id uuid,
  p_lead_id uuid,
  p_actor_staff_id uuid,
  p_reason text,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
  v_new_version bigint;
begin
  perform private.require_lead_actor(p_club_id, p_actor_staff_id);

  select l.* into v_lead
    from public.leads l
   where l.club_id = p_club_id and l.id = p_lead_id
   for update;
  if not found then raise exception 'lead_not_found'; end if;
  if v_lead.archived_at is not null then
    return jsonb_build_object(
      'status', 'already_archived', 'lead_id', p_lead_id, 'version', v_lead.version
    );
  end if;
  if v_lead.state = 'won' then raise exception 'lead_won_immutable'; end if;
  if p_expected_version is distinct from v_lead.version then
    raise exception 'lead_version_conflict';
  end if;

  update public.lead_tasks
     set status = 'cancelled', cancelled_at = now(),
         cancelled_by_staff_id = p_actor_staff_id, version = version + 1
   where club_id = p_club_id and lead_id = p_lead_id and status = 'pending';
  update public.lead_trials
     set status = 'cancelled', resolved_by_staff_id = p_actor_staff_id,
         version = version + 1
   where club_id = p_club_id and lead_id = p_lead_id and status = 'scheduled';

  update public.leads
     set archived_at = now(),
         archived_by_staff_id = p_actor_staff_id,
         archived_reason = nullif(btrim(p_reason), ''),
         next_action_at = null,
         last_activity_at = now(),
         version = version + 1
   where club_id = p_club_id and id = p_lead_id
  returning version into v_new_version;

  insert into public.lead_activities (
    club_id, lead_id, created_by_staff_id, kind, direction, body
  ) values (
    p_club_id, p_lead_id, p_actor_staff_id, 'archived', 'internal',
    nullif(btrim(p_reason), '')
  );

  return jsonb_build_object(
    'status', 'archived', 'lead_id', p_lead_id, 'version', v_new_version
  );
end
$$;


-- Activities, stage history and conversion receipts are append-only audit facts.
-- Cascading cleanup is allowed only after the owning club or lead is already gone.
create or replace function private.prevent_lead_append_only_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- Composite actor FKs may null the actor during a legitimate staff delete.
    -- That preserves the immutable business fact while avoiding a permanent
    -- blocker for staff offboarding.
    if tg_table_name = 'lead_activities'
       and old.created_by_staff_id is not null
       and new.created_by_staff_id is null
       and to_jsonb(new) - 'created_by_staff_id' = to_jsonb(old) - 'created_by_staff_id'
       and not exists (
         select 1 from public.staff s
          where s.club_id = old.club_id and s.id = old.created_by_staff_id
       )
    then return new; end if;

    if tg_table_name = 'lead_stage_history'
       and old.changed_by_staff_id is not null
       and new.changed_by_staff_id is null
       and to_jsonb(new) - 'changed_by_staff_id' = to_jsonb(old) - 'changed_by_staff_id'
       and not exists (
         select 1 from public.staff s
          where s.club_id = old.club_id and s.id = old.changed_by_staff_id
       )
    then return new; end if;

    if tg_table_name = 'lead_conversions'
       and old.converted_by_staff_id is not null
       and new.converted_by_staff_id is null
       and to_jsonb(new) - 'converted_by_staff_id' = to_jsonb(old) - 'converted_by_staff_id'
       and not exists (
         select 1 from public.staff s
          where s.club_id = old.club_id and s.id = old.converted_by_staff_id
       )
    then return new; end if;

    if tg_table_name = 'lead_conversions'
       and old.client_id is not null
       and new.client_id is null
       and to_jsonb(new) - 'client_id' = to_jsonb(old) - 'client_id'
       and not exists (
         select 1 from public.clients c
          where c.club_id = old.club_id and c.id = old.client_id
       )
    then return new; end if;

    raise exception 'lead_audit_record_immutable';
  end if;

  if exists (select 1 from public.clubs c where c.id = old.club_id)
     and exists (
       select 1
         from public.leads l
        where l.club_id = old.club_id
          and l.id = old.lead_id
     )
  then
    raise exception 'lead_audit_record_immutable';
  end if;

  return old;
end
$$;

revoke all on function private.prevent_lead_append_only_mutation()
  from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'lead_activities', 'lead_stage_history', 'lead_conversions'
  ] loop
    execute format('drop trigger if exists lead_append_only_guard on public.%I', v_table);
    execute format(
      'create trigger lead_append_only_guard before update or delete on public.%I for each row execute function private.prevent_lead_append_only_mutation()',
      v_table
    );
  end loop;
end
$$;

-- Stable normalization shared by duplicate checks and clients.phone_normalized.
create or replace function private.normalize_lead_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_phone is null then null
    when length(regexp_replace(p_phone, '[^0-9]', '', 'g')) = 12
      and regexp_replace(p_phone, '[^0-9]', '', 'g') like '998%'
      then right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 9)
    when length(regexp_replace(p_phone, '[^0-9]', '', 'g')) = 11
      and left(regexp_replace(p_phone, '[^0-9]', '', 'g'), 1) in ('7', '8')
      then right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 10)
    else regexp_replace(p_phone, '[^0-9]', '', 'g')
  end
$$;

revoke all on function private.normalize_lead_phone(text)
  from public, anon, authenticated;

create or replace function private.require_lead_actor(
  p_club_id uuid,
  p_actor_staff_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_club_id is null or p_actor_staff_id is null then
    raise exception 'lead_actor_required';
  end if;

  if not private.club_has_platform_access(p_club_id) then
    raise exception 'platform_subscription_locked';
  end if;

  if not exists (
    select 1
      from public.staff s
     where s.club_id = p_club_id
       and s.id = p_actor_staff_id
       and s.is_active = true
  ) then
    raise exception 'lead_actor_not_active_in_club';
  end if;
end
$$;

revoke all on function private.require_lead_actor(uuid, uuid)
  from public, anon, authenticated;

create or replace function private.require_active_lead_staff(
  p_club_id uuid,
  p_staff_id uuid,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_staff_id is null then return; end if;

  if not exists (
    select 1
      from public.staff s
     where s.club_id = p_club_id
       and s.id = p_staff_id
       and s.is_active = true
  ) then
    raise exception '%', coalesce(nullif(p_error_code, ''), 'lead_staff_not_active_in_club');
  end if;
end
$$;

revoke all on function private.require_active_lead_staff(uuid, uuid, text)
  from public, anon, authenticated;

create or replace function private.lead_next_action_at(
  p_club_id uuid,
  p_lead_id uuid
)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select min(actions.action_at)
    from (
      select t.due_at as action_at
        from public.lead_tasks t
       where t.club_id = p_club_id
         and t.lead_id = p_lead_id
         and t.status = 'pending'
      union all
      select tr.scheduled_at
        from public.lead_trials tr
       where tr.club_id = p_club_id
         and tr.lead_id = p_lead_id
         and tr.status = 'scheduled'
    ) actions
$$;

revoke all on function private.lead_next_action_at(uuid, uuid)
  from public, anon, authenticated;

-- Default dictionaries are created for every existing club and by a club insert
-- trigger for future onboarding. User customizations survive migration re-runs.
create or replace function private.seed_lead_defaults(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.clubs c where c.id = p_club_id) then
    raise exception 'club_not_found';
  end if;

  insert into public.lead_settings (club_id)
  values (p_club_id)
  on conflict (club_id) do nothing;

  insert into public.lead_sources
    (club_id, key, name, category, icon_key, color_token, position, is_system)
  values
    (p_club_id, 'manual',     'Вручную',            'offline',  'plus',            'zinc',    5, true),
    (p_club_id, 'walk_in',    'Визит в клуб',       'offline',  'footprints',      'zinc',   10, true),
    (p_club_id, 'phone',      'Телефонный звонок',  'offline',  'phone',           'blue',   20, true),
    (p_club_id, 'website',    'Сайт',               'digital',  'globe',           'cyan',   30, true),
    (p_club_id, 'instagram',  'Instagram',          'digital',  'instagram',       'violet', 40, true),
    (p_club_id, 'telegram',   'Telegram',           'digital',  'send',            'sky',    50, true),
    (p_club_id, 'referral',   'Рекомендация',       'referral', 'users',           'green',  60, true),
    (p_club_id, 'paid_ads',   'Платная реклама',    'digital',  'megaphone',       'amber',  70, true),
    (p_club_id, 'partner',    'Партнёр',            'partner',  'handshake',       'orange', 80, true),
    (p_club_id, 'import',     'Импорт',             'import',   'file-up',         'slate',  90, true),
    (p_club_id, 'other',      'Другое',             'other',    'circle-ellipsis', 'zinc',  100, true)
  on conflict (club_id, key) do nothing;

  insert into public.lead_pipeline_stages
    (club_id, key, name, kind, tone, probability, position, is_system)
  values
    (p_club_id, 'new',             'Новый',               'open', 'neutral',      5,  10, true),
    (p_club_id, 'contacted',       'Связались',           'open', 'brand',       15,  20, true),
    (p_club_id, 'qualified',       'Квалифицирован',      'open', 'brand',       35,  30, true),
    (p_club_id, 'trial_booked',    'Пробное назначено',   'open', 'warning',     55,  40, true),
    (p_club_id, 'trial_completed', 'Пробное пройдено',    'open', 'warning',     70,  50, true),
    (p_club_id, 'offer',           'Решение',             'open', 'brand',       85,  60, true),
    (p_club_id, 'won',             'Конвертирован',       'won',  'success',     100,  90, true),
    (p_club_id, 'lost',            'Потерян',             'lost', 'destructive',  0, 100, true)
  on conflict (club_id, key) do nothing;

  insert into public.lead_loss_reasons
    (club_id, key, name, position, is_system)
  values
    (p_club_id, 'price',             'Не устроила цена',              10, true),
    (p_club_id, 'no_response',       'Не выходит на связь',           20, true),
    (p_club_id, 'competitor',        'Выбрал другой клуб',             30, true),
    (p_club_id, 'not_ready',         'Пока не готов',                  40, true),
    (p_club_id, 'schedule_location', 'Не подошли время или локация',   50, true),
    (p_club_id, 'medical',           'Медицинские ограничения',        60, true),
    (p_club_id, 'duplicate',         'Дубликат',                       70, true),
    (p_club_id, 'invalid_contact',   'Некорректный контакт',           80, true),
    (p_club_id, 'other',             'Другое',                         90, true)
  on conflict (club_id, key) do nothing;
end
$$;

revoke all on function private.seed_lead_defaults(uuid)
  from public, anon, authenticated;

create or replace function private.seed_lead_defaults_after_club_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_lead_defaults(new.id);
  return new;
end
$$;

revoke all on function private.seed_lead_defaults_after_club_insert()
  from public, anon, authenticated;

drop trigger if exists after_club_insert_seed_lead_hub on public.clubs;
create trigger after_club_insert_seed_lead_hub
  after insert on public.clubs
  for each row execute function private.seed_lead_defaults_after_club_insert();

do $$
declare
  v_club_id uuid;
begin
  for v_club_id in select c.id from public.clubs c loop
    perform private.seed_lead_defaults(v_club_id);
  end loop;
end
$$;

-- Leads are available on every current product tier. There is deliberately no
-- active_leads limit: pipeline volume is not a billable record quota in v1.
insert into public.plan_features (plan_id, feature_key, enabled)
select p.id, 'leads', true
  from public.plans p
on conflict (plan_id, feature_key)
do update set enabled = excluded.enabled;

insert into public.plan_sections (plan_id, section_key, enabled)
select p.id, 'leads', true
  from public.plans p
on conflict (plan_id, section_key)
do update set enabled = excluded.enabled;

create or replace function private.default_lead_permissions(p_role_key text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_role_key
    when 'owner' then
      '{"view":true,"create":true,"edit":true,"assign":true,"convert":true,"archive":true}'::jsonb
    when 'admin' then
      '{"view":true,"create":true,"edit":true,"assign":true,"convert":true,"archive":false}'::jsonb
    when 'manager' then
      '{"view":true,"create":true,"edit":true,"assign":true,"convert":true,"archive":false}'::jsonb
    when 'cashier' then
      '{"view":true,"create":true,"edit":true,"assign":false,"convert":true,"archive":false}'::jsonb
    else
      '{"view":false,"create":false,"edit":false,"assign":false,"convert":false,"archive":false}'::jsonb
  end
$$;

revoke all on function private.default_lead_permissions(text)
  from public, anon, authenticated;

update public.club_roles cr
   set permissions = jsonb_set(
     coalesce(cr.permissions, '{}'::jsonb),
     '{leads}',
     private.default_lead_permissions(cr.key),
     true
   )
 where not coalesce(cr.permissions, '{}'::jsonb) ? 'leads';

create or replace function private.ensure_lead_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(new.permissions, '{}'::jsonb) ? 'leads' then
    new.permissions := jsonb_set(
      coalesce(new.permissions, '{}'::jsonb),
      '{leads}',
      private.default_lead_permissions(new.key),
      true
    );
  end if;
  return new;
end
$$;

revoke all on function private.ensure_lead_role_permissions()
  from public, anon, authenticated;

drop trigger if exists ensure_lead_role_permissions on public.club_roles;
create trigger ensure_lead_role_permissions
  before insert or update of key, permissions on public.club_roles
  for each row execute function private.ensure_lead_role_permissions();

-- Preserve the latest permission semantics and add Leads as both a section and
-- feature. Export/finance checks remain cumulative with the primary feature.
create or replace function private.has_club_permission(
  p_club_id uuid,
  p_module text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_plan_id uuid;
  v_role_allowed boolean := false;
  v_plan_allowed boolean := true;
  v_section text;
  v_feature text;
begin
  select s.role, c.plan_id
    into v_role, v_plan_id
  from public.staff s
  join public.clubs c on c.id = s.club_id
  where s.club_id = p_club_id
    and s.user_id = (select auth.uid())
    and s.is_active = true
  order by (s.role = 'owner') desc
  limit 1;

  if v_role is null then return false; end if;
  if v_role = 'owner' then
    v_role_allowed := true;
  else
    select coalesce((cr.permissions #>> array[p_module, p_action])::boolean, false)
      into v_role_allowed
    from public.club_roles cr
    where cr.club_id = p_club_id and cr.key = v_role
    limit 1;
  end if;
  if not coalesce(v_role_allowed, false) then return false; end if;
  if v_plan_id is null then return true; end if;

  v_section := case
    when p_module in ('dashboard', 'clients', 'memberships', 'payments', 'visits',
                      'schedule', 'warehouse', 'reports', 'staff', 'inbox', 'ai',
                      'leads')
      then p_module
    when p_module = 'settings' and p_action = 'integrations' then 'integrations'
    when p_module = 'settings' and p_action = 'roles' then 'staff'
    else null
  end;
  if v_section is not null then
    select coalesce(ps.enabled, false) into v_plan_allowed
    from public.plan_sections ps
    where ps.plan_id = v_plan_id and ps.section_key = v_section limit 1;
    if not coalesce(v_plan_allowed, false) then return false; end if;
  end if;

  v_feature := case
    when p_module in ('clients', 'memberships', 'payments', 'visits', 'schedule') then 'crm'
    when p_module = 'reports' then 'reports'
    when p_module = 'warehouse' then 'warehouse'
    when p_module = 'inbox' then 'inbox'
    when p_module = 'ai' then 'ai'
    when p_module = 'telegram' then 'telegram'
    when p_module = 'leads' then 'leads'
    else null
  end;
  if v_feature is not null then
    select coalesce(pf.enabled, false) into v_plan_allowed
    from public.plan_features pf
    where pf.plan_id = v_plan_id and pf.feature_key = v_feature limit 1;
    if not coalesce(v_plan_allowed, false) then return false; end if;
  end if;

  -- Lead Hub is part of the core CRM entitlement as well as its own feature
  -- switch. The direct Data API must match applyPlanToPermissions().
  if p_module = 'leads' then
    select coalesce(pf.enabled, false) into v_plan_allowed
    from public.plan_features pf
    where pf.plan_id = v_plan_id and pf.feature_key = 'crm' limit 1;
    if not coalesce(v_plan_allowed, false) then return false; end if;
  end if;

  if p_action = 'export' then
    select coalesce(pf.enabled, false) into v_plan_allowed
    from public.plan_features pf
    where pf.plan_id = v_plan_id and pf.feature_key = 'export' limit 1;
    if not coalesce(v_plan_allowed, false) then return false; end if;
  end if;

  if (p_module = 'dashboard' and p_action = 'view_finance')
     or (p_module = 'payments' and p_action = 'view_revenue')
     or (p_module = 'reports' and p_action = 'finance') then
    select coalesce(pf.enabled, false) into v_plan_allowed
    from public.plan_features pf
    where pf.plan_id = v_plan_id and pf.feature_key = 'finance' limit 1;
    if not coalesce(v_plan_allowed, false) then return false; end if;
  end if;
  return true;
end
$$;

revoke all on function private.has_club_permission(uuid, text, text)
  from public, anon;
grant execute on function private.has_club_permission(uuid, text, text)
  to authenticated, service_role;

-- Supabase 2026 does not guarantee automatic Data API exposure for new public
-- tables. Grants are explicit: authenticated can read; only service_role writes.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'lead_settings', 'lead_sources', 'lead_pipeline_stages', 'lead_loss_reasons',
    'leads', 'lead_tasks', 'lead_activities', 'lead_stage_history', 'lead_trials',
    'lead_conversions'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);

    execute format('drop policy if exists lead_hub_permission_select on public.%I', v_table);
    execute format(
      'create policy lead_hub_permission_select on public.%I for select to authenticated using (private.has_club_permission(club_id, ''leads'', ''view''))',
      v_table
    );

    execute format('drop policy if exists lead_hub_tenant_scope on public.%I', v_table);
    execute format(
      'create policy lead_hub_tenant_scope on public.%I as restrictive for all to authenticated using (club_id in (select public.user_club_ids())) with check (club_id in (select public.user_club_ids()))',
      v_table
    );

    execute format('drop policy if exists platform_subscription_read_gate on public.%I', v_table);
    execute format(
      'create policy platform_subscription_read_gate on public.%I as restrictive for select to authenticated using (private.club_has_platform_access(club_id))',
      v_table
    );

    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
    execute format('grant select on table public.%I to authenticated', v_table);
    if v_table in ('lead_activities', 'lead_stage_history', 'lead_conversions') then
      execute format('grant select, insert on table public.%I to service_role', v_table);
    else
      execute format('grant select, insert, update on table public.%I to service_role', v_table);
    end if;

    execute format('drop trigger if exists platform_subscription_write_gate on public.%I', v_table);
    execute format(
      'create trigger platform_subscription_write_gate before insert or update or delete on public.%I for each row execute function private.enforce_club_platform_access()',
      v_table
    );
  end loop;
end
$$;

revoke all on sequence public.leads_lead_no_seq from public, anon, authenticated;
grant usage, select on sequence public.leads_lead_no_seq to service_role;

revoke all on function public.create_lead(
  uuid, uuid, text, text, text, text, uuid, text, numeric, text, boolean, text
) from public, anon, authenticated;
grant execute on function public.create_lead(
  uuid, uuid, text, text, text, text, uuid, text, numeric, text, boolean, text
) to service_role;

revoke all on function public.update_lead_details(
  uuid, uuid, uuid, bigint, text, text, text, text, text, numeric, text, text[], text, text
) from public, anon, authenticated;
grant execute on function public.update_lead_details(
  uuid, uuid, uuid, bigint, text, text, text, text, text, numeric, text, text[], text, text
) to service_role;

revoke all on function public.assign_lead(uuid, uuid, uuid, uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.assign_lead(uuid, uuid, uuid, uuid, bigint)
  to service_role;

revoke all on function public.move_lead_stage(
  uuid, uuid, uuid, text, text, text, bigint
) from public, anon, authenticated;
grant execute on function public.move_lead_stage(
  uuid, uuid, uuid, text, text, text, bigint
) to service_role;

revoke all on function public.create_lead_task(
  uuid, uuid, uuid, text, text, text, timestamptz, uuid, text
) from public, anon, authenticated;
grant execute on function public.create_lead_task(
  uuid, uuid, uuid, text, text, text, timestamptz, uuid, text
) to service_role;

revoke all on function public.complete_lead_task(
  uuid, uuid, uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.complete_lead_task(
  uuid, uuid, uuid, uuid, text, text
) to service_role;

revoke all on function public.record_lead_activity(
  uuid, uuid, uuid, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_lead_activity(
  uuid, uuid, uuid, text, text, text, text, text
) to service_role;

revoke all on function public.schedule_lead_trial(
  uuid, uuid, uuid, text, timestamptz, integer, uuid, text
) from public, anon, authenticated;
grant execute on function public.schedule_lead_trial(
  uuid, uuid, uuid, text, timestamptz, integer, uuid, text
) to service_role;

revoke all on function public.mark_lead_trial_outcome(
  uuid, uuid, uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.mark_lead_trial_outcome(
  uuid, uuid, uuid, uuid, text, text
) to service_role;

revoke all on function public.convert_lead_to_client(
  uuid, uuid, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.convert_lead_to_client(
  uuid, uuid, uuid, uuid, text
) to service_role;

revoke all on function public.archive_lead(uuid, uuid, uuid, text, bigint)
  from public, anon, authenticated;
grant execute on function public.archive_lead(uuid, uuid, uuid, text, bigint)
  to service_role;
