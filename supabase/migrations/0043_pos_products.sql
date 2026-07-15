-- POS / Витрина товаров: фото, штрихкод, описание у товаров + продажа онлайн (pending items).

-- 1) Поля товара для витрины.
alter table public.products
  add column if not exists photo_url   text,
  add column if not exists barcode     text,
  add column if not exists description text;

create index if not exists products_barcode_idx on public.products (club_id, barcode);

-- 2) Онлайн-продажа товаров: корзина «запоминается» в платеже до подтверждения оплаты.
--    Формат: [{ "product_id": uuid, "qty": number, "unit_price": number, "name": text }]
alter table public.payments
  add column if not exists pending_items jsonb;

-- 3) Атомарное списание остатка при продаже (обновит строку только если остатка хватает).
create or replace function public.decrement_inventory(p_product_id uuid, p_qty numeric, p_club_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare updated int;
begin
  update public.inventory
     set quantity = quantity - p_qty, updated_at = now()
   where product_id = p_product_id and club_id = p_club_id and quantity >= p_qty;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

-- 4) Bucket для фото товаров (публичное чтение, запись — авторизованным).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "product photos public read" on storage.objects;
create policy "product photos public read" on storage.objects
  for select to public using (bucket_id = 'product-photos');

drop policy if exists "product photos auth write" on storage.objects;
create policy "product photos auth write" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-photos');

drop policy if exists "product photos auth update" on storage.objects;
create policy "product photos auth update" on storage.objects
  for update to authenticated using (bucket_id = 'product-photos');

drop policy if exists "product photos auth delete" on storage.objects;
create policy "product photos auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'product-photos');
