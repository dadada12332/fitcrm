-- Google Calendar OAuth and schedule sync support.
-- OAuth credentials remain service-role only in integration_connections.

alter table public.integration_connections
  drop constraint if exists integration_connections_provider_check;
alter table public.integration_connections
  add constraint integration_connections_provider_check
  check (provider in ('instagram', 'google_calendar'));

alter table public.integration_oauth_states
  drop constraint if exists integration_oauth_states_provider_check;
alter table public.integration_oauth_states
  add constraint integration_oauth_states_provider_check
  check (provider in ('instagram', 'google_calendar'));

alter table public.integration_sync_runs
  drop constraint if exists integration_sync_runs_provider_check;
alter table public.integration_sync_runs
  add constraint integration_sync_runs_provider_check
  check (provider in ('instagram', 'google_calendar'));

-- One Google account may legitimately serve several clubs. Keep the stricter
-- single-club rule only for Instagram professional accounts.
alter table public.integration_connections
  drop constraint if exists integration_connections_provider_external_account_id_key;

create unique index if not exists idx_integration_connections_instagram_account
  on public.integration_connections (external_account_id)
  where provider = 'instagram';

