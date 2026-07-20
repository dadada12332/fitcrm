-- Launch hardening: tenant-scoped product images, safer RPC exposure and FK indexes.

-- Public buckets serve object URLs without SELECT policies. Removing broad
-- SELECT policies prevents directory listing through the Data API.
drop policy if exists "Public read avatars" on storage.objects;
drop policy if exists "product photos public read" on storage.objects;

-- Product images live under <club_id>/products/<uuid> and may only be changed
-- by an authenticated member of that club.
drop policy if exists "product photos auth write" on storage.objects;
create policy "product photos auth write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-photos'
    and ((storage.foldername(name))[1])::uuid in (select public.user_club_ids())
  );

drop policy if exists "product photos auth update" on storage.objects;
create policy "product photos auth update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-photos'
    and ((storage.foldername(name))[1])::uuid in (select public.user_club_ids())
  )
  with check (
    bucket_id = 'product-photos'
    and ((storage.foldername(name))[1])::uuid in (select public.user_club_ids())
  );

drop policy if exists "product photos auth delete" on storage.objects;
create policy "product photos auth delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-photos'
    and ((storage.foldername(name))[1])::uuid in (select public.user_club_ids())
  );

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'avatars';

update storage.buckets
set file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'broadcasts';

-- Only the clubs trigger needs this bootstrap helper. Authenticated users must
-- not be able to invoke the SECURITY DEFINER function for arbitrary clubs.
alter function public.create_default_club_roles(uuid) set search_path = public;
alter function public.trigger_create_default_club_roles() set search_path = public;
revoke all on function public.create_default_club_roles(uuid) from public, anon, authenticated;

alter function public.get_payments_kpi(uuid) set search_path = public;
alter function public.get_visits_kpi(uuid) set search_path = public;

create index if not exists broadcasts_created_by_idx
  on public.broadcasts (created_by);
create index if not exists integration_connections_connected_by_idx
  on public.integration_connections (connected_by);
create index if not exists integration_events_club_id_idx
  on public.integration_events (club_id);
create index if not exists integration_oauth_states_club_id_idx
  on public.integration_oauth_states (club_id);
create index if not exists integration_oauth_states_created_by_idx
  on public.integration_oauth_states (created_by);
create index if not exists marketing_touchpoints_client_id_idx
  on public.marketing_touchpoints (client_id);
create index if not exists qr_pass_redemptions_redeemed_by_idx
  on public.qr_pass_redemptions (redeemed_by);
create index if not exists telegram_events_client_id_idx
  on public.telegram_events (client_id);
create index if not exists telegram_staff_pairings_created_by_idx
  on public.telegram_staff_pairings (created_by);
