-- Platform Admin role management.
-- Role changes are intentionally atomic and executable only by service_role.

create or replace function public.platform_set_admin_role(
  p_actor_id uuid,
  p_target_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_target_email text;
  v_previous_role text;
begin
  perform pg_advisory_xact_lock(hashtext('platform-admin-role-management'));

  select u.platform_role
    into v_actor_role
    from public.users u
   where u.id = p_actor_id;

  if v_actor_role is distinct from 'super_admin' then
    raise exception 'platform_super_admin_required';
  end if;

  if p_actor_id = p_target_id then
    raise exception 'platform_self_role_change_forbidden';
  end if;

  if p_role is not null and p_role not in ('platform_admin', 'super_admin') then
    raise exception 'platform_invalid_role';
  end if;

  select u.email, u.platform_role
    into v_target_email, v_previous_role
    from public.users u
   where u.id = p_target_id
   for update;

  if not found then
    raise exception 'platform_target_user_not_found';
  end if;

  if v_previous_role = 'super_admin'
     and p_role is distinct from 'super_admin'
     and (select count(*) from public.users where platform_role = 'super_admin') <= 1 then
    raise exception 'platform_last_super_admin';
  end if;

  update public.users
     set platform_role = p_role
   where id = p_target_id;

  insert into public.platform_admin_logs (
    admin_id,
    admin_email,
    action,
    target_user,
    meta
  )
  select
    p_actor_id,
    actor.email,
    'platform_role_change',
    p_target_id,
    jsonb_build_object(
      'target_email', v_target_email,
      'previous_role', v_previous_role,
      'new_role', p_role
    )
  from public.users actor
  where actor.id = p_actor_id;

  return jsonb_build_object(
    'target_id', p_target_id,
    'target_email', v_target_email,
    'previous_role', v_previous_role,
    'new_role', p_role
  );
end;
$$;

revoke all on function public.platform_set_admin_role(uuid, uuid, text) from public;
revoke all on function public.platform_set_admin_role(uuid, uuid, text) from anon;
revoke all on function public.platform_set_admin_role(uuid, uuid, text) from authenticated;
grant execute on function public.platform_set_admin_role(uuid, uuid, text) to service_role;
