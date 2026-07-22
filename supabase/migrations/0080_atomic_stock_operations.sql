-- Keep inventory balance and movement history in the same transaction.
create unique index if not exists inventory_club_product_unique
  on public.inventory (club_id, product_id);

create or replace function public.record_stock_supply(
  p_club_id uuid,
  p_product_id uuid,
  p_qty numeric,
  p_unit_price numeric default 0,
  p_note text default null
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_qty <= 0 or coalesce(p_unit_price, 0) < 0 then return false; end if;

  perform 1
  from public.products
  where id = p_product_id and club_id = p_club_id and is_active = true
  for update;
  if not found then return false; end if;

  insert into public.inventory (club_id, product_id, quantity, min_quantity, updated_at)
  values (p_club_id, p_product_id, p_qty, 0, now())
  on conflict (club_id, product_id) do update
    set quantity = public.inventory.quantity + excluded.quantity,
        updated_at = now();

  insert into public.stock_movements (club_id, product_id, type, qty, unit_price, note)
  values (p_club_id, p_product_id, 'supply', p_qty, coalesce(p_unit_price, 0), nullif(trim(p_note), ''));

  return true;
end;
$$;

create or replace function public.record_stock_writeoff(
  p_club_id uuid,
  p_product_id uuid,
  p_qty numeric,
  p_note text default null
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_qty <= 0 then return false; end if;

  perform 1
  from public.products
  where id = p_product_id and club_id = p_club_id and is_active = true;
  if not found then return false; end if;

  update public.inventory
  set quantity = quantity - p_qty,
      updated_at = now()
  where club_id = p_club_id
    and product_id = p_product_id
    and quantity >= p_qty;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return false; end if;

  insert into public.stock_movements (club_id, product_id, type, qty, unit_price, note)
  values (p_club_id, p_product_id, 'writeoff', p_qty, 0, nullif(trim(p_note), ''));

  return true;
end;
$$;

revoke all on function public.record_stock_supply(uuid, uuid, numeric, numeric, text) from public, anon, authenticated;
revoke all on function public.record_stock_writeoff(uuid, uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.record_stock_supply(uuid, uuid, numeric, numeric, text) to service_role;
grant execute on function public.record_stock_writeoff(uuid, uuid, numeric, text) to service_role;
