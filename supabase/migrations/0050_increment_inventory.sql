-- ════════════════════════════════════════════════════════════════════════
-- 0050_increment_inventory.sql — недостающая RPC для прихода/восстановления
-- остатка (в коде warehouse/actions.ts был fallback, теперь работает нативно).
-- Без on-conflict: у inventory нет unique(product_id) — делаем update-first,
-- insert если строки ещё нет. Симметрична decrement_inventory.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.increment_inventory(p_product_id uuid, p_qty numeric, p_club_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare updated int;
begin
  update public.inventory
     set quantity = quantity + p_qty, updated_at = now()
   where product_id = p_product_id and club_id = p_club_id;
  get diagnostics updated = row_count;
  if updated = 0 then
    insert into public.inventory (club_id, product_id, quantity, min_quantity, updated_at)
    values (p_club_id, p_product_id, p_qty, 0, now());
  end if;
  return true;
end;
$$;

grant execute on function public.increment_inventory(uuid, numeric, uuid) to authenticated;
