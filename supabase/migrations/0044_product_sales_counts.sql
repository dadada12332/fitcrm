-- Агрегат продаж по товарам (для бейджа «Хит» и блока «Часто продаваемые») — обходит лимит 1000.
create or replace function public.product_sales_counts(p_club_id uuid, p_since timestamptz)
returns table(product_id uuid, cnt bigint, qty numeric, last_sold timestamptz)
language sql stable security definer set search_path = public as $$
  select product_id, count(*)::bigint as cnt, coalesce(sum(qty),0) as qty, max(created_at) as last_sold
  from public.stock_movements
  where club_id = p_club_id and type = 'sale' and created_at >= p_since
  group by product_id;
$$;
