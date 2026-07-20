-- Cover the last foreign keys reported by the Supabase performance advisor.
create index if not exists qr_pass_redemptions_client_id_idx
  on public.qr_pass_redemptions (client_id);

create index if not exists telegram_staff_pairings_staff_id_idx
  on public.telegram_staff_pairings (staff_id);
