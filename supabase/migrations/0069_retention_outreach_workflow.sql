create table if not exists public.retention_cases (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  assigned_staff_id uuid references public.staff(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'contacted', 'follow_up', 'won', 'lost')),
  next_follow_up_at timestamptz,
  last_interaction_at timestamptz,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  close_reason text check (close_reason is null or close_reason in ('payment', 'visit', 'manual_return', 'declined')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, client_id)
);

create table if not exists public.client_interactions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  case_id uuid references public.retention_cases(id) on delete set null,
  staff_id uuid references public.staff(id) on delete set null,
  source text not null default 'retention' check (source in ('retention', 'client_profile', 'system')),
  channel text not null check (channel in ('telegram', 'phone', 'copy', 'system')),
  kind text not null default 'outreach' check (kind in ('outreach', 'outcome', 'automation')),
  outcome text check (outcome is null or outcome in ('sent', 'opened', 'no_answer', 'interested', 'renewing', 'returned', 'declined', 'follow_up')),
  message text,
  next_follow_up_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists retention_cases_club_status_idx on public.retention_cases (club_id, status, next_follow_up_at);
create index if not exists retention_cases_client_idx on public.retention_cases (client_id);
create index if not exists retention_cases_staff_idx on public.retention_cases (assigned_staff_id);
create index if not exists retention_cases_created_by_idx on public.retention_cases (created_by);
create index if not exists client_interactions_club_client_created_idx on public.client_interactions (club_id, client_id, created_at desc);
create index if not exists client_interactions_case_idx on public.client_interactions (case_id);
create index if not exists client_interactions_staff_idx on public.client_interactions (staff_id);
create index if not exists client_interactions_created_by_idx on public.client_interactions (created_by);

alter table public.retention_cases enable row level security;
alter table public.client_interactions enable row level security;

drop policy if exists "retention_cases_club_access" on public.retention_cases;
create policy "retention_cases_club_access" on public.retention_cases
  for all to authenticated
  using (club_id in (select public.user_club_ids()))
  with check (club_id in (select public.user_club_ids()));

drop policy if exists "client_interactions_club_access" on public.client_interactions;
create policy "client_interactions_club_access" on public.client_interactions
  for all to authenticated
  using (club_id in (select public.user_club_ids()))
  with check (club_id in (select public.user_club_ids()));

create or replace function public.close_retention_case_after_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_id uuid;
  v_reason text;
  v_client_id uuid;
  v_club_id uuid;
  v_activity_at timestamptz;
begin
  if tg_table_name = 'payments' then
    if new.status <> 'paid' or (tg_op = 'UPDATE' and old.status = new.status) or new.client_id is null then
      return new;
    end if;
    v_reason := 'payment';
    v_client_id := new.client_id;
    v_club_id := new.club_id;
    v_activity_at := coalesce(new.paid_at, new.created_at, now());
  else
    v_reason := 'visit';
    v_client_id := new.client_id;
    v_club_id := new.club_id;
    v_activity_at := new.checked_in_at;
  end if;

  update public.retention_cases
  set status = 'won',
      closed_at = v_activity_at,
      close_reason = v_reason,
      next_follow_up_at = null,
      updated_at = now()
  where club_id = v_club_id
    and client_id = v_client_id
    and status in ('open', 'contacted', 'follow_up')
    and opened_at <= v_activity_at
  returning id into v_case_id;

  if v_case_id is not null then
    insert into public.client_interactions (
      club_id, client_id, case_id, source, channel, kind, outcome, message, metadata
    ) values (
      v_club_id,
      v_client_id,
      v_case_id,
      'system',
      'system',
      'automation',
      'returned',
      case when v_reason = 'payment' then 'Кейс автоматически закрыт после оплаты' else 'Кейс автоматически закрыт после посещения' end,
      jsonb_build_object('reason', v_reason)
    );
  end if;

  return new;
end;
$$;

revoke all on function public.close_retention_case_after_activity() from public, anon, authenticated;

drop trigger if exists retention_close_after_payment on public.payments;
create trigger retention_close_after_payment
after insert or update of status on public.payments
for each row execute function public.close_retention_case_after_activity();

drop trigger if exists retention_close_after_visit on public.visits;
create trigger retention_close_after_visit
after insert on public.visits
for each row execute function public.close_retention_case_after_activity();
