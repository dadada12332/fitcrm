-- Preserve source-system fields that do not map to FitCRM's canonical schema.
-- The JSON object is tenant-owned through the parent clients row and existing RLS.

alter table public.clients
  add column if not exists import_data jsonb not null default '{"extraFields": {}}'::jsonb,
  add column if not exists email_normalized text generated always as (
    nullif(lower(btrim(email)), '')
  ) stored;

comment on column public.clients.import_data is
  'Latest import provenance and non-empty source fields that have no canonical FitCRM column';

create index if not exists idx_clients_club_email_normalized
  on public.clients (club_id, email_normalized)
  where email_normalized is not null;
