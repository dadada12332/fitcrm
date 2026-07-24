-- Procurement costs require warehouse.view_cost_price. Normal warehouse reads
-- keep operational product and movement fields only; server code fetches costs
-- with service-role after checking the dedicated permission.
revoke select on public.products from authenticated;
grant select (
  id,
  club_id,
  name,
  category,
  unit,
  sell_price,
  sku,
  is_active,
  photo_url,
  barcode,
  description
) on public.products to authenticated;

revoke select on public.stock_movements from authenticated;
grant select (
  id,
  club_id,
  product_id,
  type,
  qty,
  client_id,
  payment_id,
  note,
  created_by,
  created_at
) on public.stock_movements to authenticated;
