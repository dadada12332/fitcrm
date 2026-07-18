-- One-time redemption registry for short-lived signed client QR passes.
-- Passes are issued statelessly; only a redeemed jti is persisted.

create table if not exists public.qr_pass_redemptions (
  jti text primary key,
  club_id uuid not null references public.clubs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  expires_at timestamptz not null,
  redeemed_by uuid references public.users(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_qr_pass_redemptions_expiry
  on public.qr_pass_redemptions (expires_at);
create index if not exists idx_qr_pass_redemptions_club_client
  on public.qr_pass_redemptions (club_id, client_id, redeemed_at desc);

alter table public.qr_pass_redemptions enable row level security;
revoke all on public.qr_pass_redemptions from public, anon, authenticated;
grant all on public.qr_pass_redemptions to service_role;
