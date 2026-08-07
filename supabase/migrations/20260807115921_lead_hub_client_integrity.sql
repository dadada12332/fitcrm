-- A converted lead and its immutable conversion record must always retain the
-- client they produced. The foundation migration used SET NULL, which makes
-- the audit relationship optional at the FK level. Tighten it before release.

do $$
begin
  if exists (
    select 1
      from public.lead_conversions
     where client_id is null
  ) then
    raise exception 'lead_conversion_client_integrity_violation';
  end if;
end
$$;

alter table public.lead_conversions
  alter column client_id set not null;

alter table public.leads
  drop constraint if exists leads_converted_client_tenant_fkey,
  add constraint leads_converted_client_tenant_fkey
    foreign key (club_id, converted_client_id)
    references public.clients (club_id, id)
    on delete restrict;

alter table public.lead_conversions
  drop constraint if exists lead_conversions_client_tenant_fkey,
  add constraint lead_conversions_client_tenant_fkey
    foreign key (club_id, client_id)
    references public.clients (club_id, id)
    on delete restrict;
