-- Добавить тестовые посещения на сегодня.
-- Запустить в Supabase Dashboard → SQL Editor.
-- Идемпотентно: добавит только если сегодня < 5 посещений.

do $$
declare
  c    record;
  cl   uuid;
  sub  uuid;
  i    int;
begin
  for c in select id from public.clubs loop
    -- пропустить если сегодня уже много посещений
    if (select count(*) from public.visits
        where club_id = c.id and checked_in_at >= current_date) >= 5 then
      continue;
    end if;

    -- 20 посещений сегодня в разное время
    for i in 1 .. 20 loop
      -- берём случайного клиента с активным абонементом
      select s.client_id, s.id into cl, sub
      from public.subscriptions s
      where s.club_id = c.id and s.status = 'active'
      order by random() limit 1;

      if cl is null then
        -- нет активных — берём любого клиента
        select id into cl from public.clients where club_id = c.id order by random() limit 1;
        sub := null;
      end if;

      if cl is null then continue; end if;

      insert into public.visits (club_id, client_id, subscription_id, checked_in_at, method)
      values (
        c.id,
        cl,
        sub,
        current_date + (interval '7 hours' + (i * interval '25 minutes')),
        (array['manual','qr','telegram']::visit_method[])[1 + (i % 3)]
      );
    end loop;
  end loop;
end $$;
