-- 0033_reports_debts.sql
-- Серверная агрегация вкладки «Долги» отчётов (Stage 6).
-- Повторяет то, что раньше считалось в браузере из массива оплат со статусом pending:
--   count = число должников (pending-платежей)
--   total = сумма долга
--   list  = топ-20 по дате (created_at desc), с именем/телефоном клиента
-- Примечание: старый код видел только платежи created_at >= год назад; RPC берёт все pending
-- (как и в финансах — это исправление старого «слепого пятна» по годовым данным).
-- Идемпотентно.

create or replace function public.reports_debts(p_club_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  with pend as (
    select pay.id, pay.amount, pay.created_at,
           cl.full_name as client_name, cl.phone as client_phone
    from public.payments pay
    left join public.clients cl on cl.id = pay.client_id
    where pay.club_id = p_club_id and pay.status = 'pending'
  )
  select jsonb_build_object(
    'count', (select count(*) from pend),
    'total', coalesce((select sum(amount) from pend), 0),
    'list', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'clientName', client_name, 'clientPhone', client_phone,
        'amount', amount, 'createdAt', created_at) order by created_at desc)
      from (select * from pend order by created_at desc limit 20) t
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.reports_debts(uuid) to authenticated, service_role;
