-- Add extra personal data fields to clients table
alter table public.clients
  add column if not exists gender     text check (gender in ('male', 'female')),
  add column if not exists birth_date date,
  add column if not exists email      text,
  add column if not exists source     text;
