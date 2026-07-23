-- Allow mapping a vendor-side person/access-object identifier when the
-- installed controller API does not expose the physical card number.

alter table public.access_control_credentials
  drop constraint if exists access_control_credentials_credential_type_check;

alter table public.access_control_credentials
  add constraint access_control_credentials_credential_type_check
  check (credential_type in ('card', 'bracelet', 'qr', 'face', 'external_id'));
