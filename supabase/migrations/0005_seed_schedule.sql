-- ============================================================
-- FitCRM — демо-данные для раздела «Расписание».
-- Залы + занятия на текущую неделю (Пн–Вс) + записи демо-клиентов.
-- Применять в SQL Editor → Run. Идемпотентно: пропускает клубы,
-- где уже есть занятия.
-- ============================================================

do $$
declare
  c          record;
  r1 uuid; r2 uuid; r3 uuid;
  room_ids   uuid[];
  client_ids uuid[];
  week_mon   date := date_trunc('week', current_date)::date; -- понедельник текущей недели
  d          int;
  cls_date   date;
  cid        uuid;          -- id занятия
  cli        uuid;          -- id клиента
  tpl        record;
  booked     int;
  i          int;
begin
  for c in select id from public.clubs loop
    if exists (select 1 from public.classes where club_id = c.id) then
      continue;
    end if;

    -- ── залы ──
    insert into public.rooms (club_id, name, capacity) values (c.id, 'Зал 1', 20) returning id into r1;
    insert into public.rooms (club_id, name, capacity) values (c.id, 'Зал 2', 15) returning id into r2;
    insert into public.rooms (club_id, name, capacity) values (c.id, 'Зал 3', 12) returning id into r3;
    room_ids := array[r1, r2, r3];

    select array_agg(id) into client_ids from public.clients where club_id = c.id;

    -- ── занятия на неделю ──
    for d in 0..6 loop
      cls_date := week_mon + d;
      for tpl in
        select * from (values
          ('Йога',      'Анна',   8,  1, 15, 120000, 1),
          ('Кроссфит',  'Иван',   9,  1, 12, 150000, 2),
          ('Бокс',      'Марина', 10, 1, 12, 130000, 3),
          ('Сайклинг',  'Анна',   12, 1, 18, 100000, 1),
          ('Стретчинг', 'Олег',   15, 1, 15, 90000,  2),
          ('Йога',      'Анна',   18, 1, 15, 120000, 1),
          ('Кроссфит',  'Иван',   19, 1, 12, 150000, 2),
          ('Танцы',     'Лола',   20, 1, 20, 110000, 3)
        ) as t(title, trainer, sh, dur, seats, price, ridx)
      loop
        -- переменная заполненность → разные цвета карточек (0..seats)
        booked := least(tpl.seats, greatest(0, tpl.seats * ((d * 7 + tpl.sh) % 11) / 10));

        insert into public.classes
          (club_id, room_id, date, start_time, end_time, seats_total, seats_booked, status, title, trainer_name, price)
        values
          (c.id, room_ids[tpl.ridx], cls_date,
           make_time(tpl.sh, 0, 0), make_time(tpl.sh + tpl.dur, 0, 0),
           tpl.seats, booked, 'scheduled', tpl.title, tpl.trainer, tpl.price)
        returning id into cid;

        if client_ids is not null and booked > 0 then
          for i in 1..booked loop
            cli := client_ids[1 + floor(random() * array_length(client_ids, 1))::int];
            insert into public.class_bookings (club_id, class_id, client_id, status)
            values (c.id, cid, cli, 'booked');
          end loop;
        end if;
      end loop;
    end loop;

    -- пара отменённых занятий для реалистичности
    update public.classes set status = 'cancelled'
    where id in (select id from public.classes where club_id = c.id order by random() limit 2);

  end loop;
end $$;

-- ── Очистка демо-расписания (при необходимости) ──
-- delete from public.class_bookings where club_id in (select id from public.clubs);
-- delete from public.classes where club_id in (select id from public.clubs);
-- delete from public.rooms where name in ('Зал 1','Зал 2','Зал 3');
