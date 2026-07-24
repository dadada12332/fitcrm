-- PostgREST exposes the public schema. Keep the implementation private and
-- expose only a service-role wrapper for payment callbacks.
create or replace function public.confirm_paid_membership(
  p_club_id uuid,
  p_payment_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.confirm_paid_membership(p_club_id, p_payment_id);
$$;

revoke all on function public.confirm_paid_membership(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.confirm_paid_membership(uuid, uuid)
  to service_role;
