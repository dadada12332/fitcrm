alter function public.consume_plan_usage(uuid,text,bigint,bigint) security invoker;
revoke all on function public.consume_plan_usage(uuid,text,bigint,bigint) from public, anon, authenticated;
grant execute on function public.consume_plan_usage(uuid,text,bigint,bigint) to service_role;
