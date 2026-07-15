-- Add balance field to clients (prepaid balance in local currency)
alter table public.clients
  add column if not exists balance numeric(12,2) not null default 0;
