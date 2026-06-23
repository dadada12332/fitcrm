-- ============================================================
-- FitCRM — демо-данные для интерактивной работы с CRM.
-- Применять в Supabase SQL Editor → Run (выполняется как superuser, RLS не мешает).
-- Идемпотентно: наполняет только клубы, где ещё нет клиентов.
-- Все демо-клиенты помечены notes = '[demo]' (см. очистку внизу файла).
-- ============================================================

do $$
declare
  c        record;
  mids     uuid[];
  m_id     uuid;
  cid      uuid;
  cl       uuid;
  i        int;
  st       subscription_status;
  exp      date;
  names    text[] := array[
    'Алишер Усманов','Дилноза Рахимова','Тимур Маткаримов','Азиз Каримов',
    'Камола Юсупова','Бекзод Тошматов','Нигора Саидова','Рустам Холматов',
    'Малика Эргашева','Шерзод Назаров','Гульнора Ахмедова','Фаррух Зокиров',
    'Лола Исмаилова','Жасур Турсунов','Севара Камилова','Отабек Юлдашев',
    'Зухра Хамидова','Санжар Абдуллаев'
  ];
  tags_pool text[] := array['VIP','PRO','Новый','Постоянный'];
begin
  for c in select id from public.clubs loop
    -- пропустить клубы, где демо уже залито (по метке '[demo]')
    if exists (select 1 from public.clients where club_id = c.id and notes = '[demo]') then
      continue;
    end if;

    -- ── memberships (5 типов) ──
    mids := array[]::uuid[];
    insert into public.memberships (club_id, name, price, duration_days, visits_limit)
      values (c.id, 'VIP Безлимит', 1200000, 30, null) returning id into m_id; mids := mids || m_id;
    insert into public.memberships (club_id, name, price, duration_days, visits_limit)
      values (c.id, 'PRO', 800000, 30, null) returning id into m_id; mids := mids || m_id;
    insert into public.memberships (club_id, name, price, duration_days, visits_limit)
      values (c.id, 'Дневной', 500000, 30, 12) returning id into m_id; mids := mids || m_id;
    insert into public.memberships (club_id, name, price, duration_days, visits_limit)
      values (c.id, 'Утренний', 400000, 30, 12) returning id into m_id; mids := mids || m_id;
    insert into public.memberships (club_id, name, price, duration_days, visits_limit)
      values (c.id, 'Женский', 600000, 30, null) returning id into m_id; mids := mids || m_id;

    -- ── clients + subscriptions + платёж за абонемент ──
    for i in 1 .. array_length(names, 1) loop
      insert into public.clients (club_id, full_name, phone, tags, notes, created_at)
      values (
        c.id,
        names[i],
        '+99890' || lpad((1000000 + i * 37)::text, 7, '0'),
        array[ tags_pool[1 + (i % 4)] ],
        '[demo]',
        now() - ((i % 6) || ' hours')::interval - ((i / 6) || ' days')::interval
      )
      returning id into cid;

      -- распределение статусов/срока
      if i % 7 = 0 then
        st := 'expired';  exp := current_date - (1 + (i % 5));
      elsif i % 5 = 0 then
        st := 'active';   exp := current_date + (1 + (i % 6));   -- истекает скоро
      elsif i % 11 = 0 then
        st := 'frozen';   exp := current_date + 20;
      else
        st := 'active';   exp := current_date + (10 + (i % 20));
      end if;

      insert into public.subscriptions
        (club_id, client_id, membership_id, starts_at, expires_at, visits_total, visits_used, status)
      values
        (c.id, cid, mids[1 + (i % 5)], exp - 30, exp, 30, (i % 12), st);

      insert into public.payments
        (club_id, client_id, amount, provider, status, paid_at, created_at)
      values (
        c.id, cid,
        (array[400000,500000,600000,800000,1200000])[1 + (i % 5)],
        (array['cash','click','payme']::payment_provider[])[1 + (i % 3)],
        'paid',
        now() - ((i % 28) || ' days')::interval,
        now() - ((i % 28) || ' days')::interval
      );
    end loop;

    -- ── платежи, разбросанные по 30 дням (для графика выручки) ──
    for i in 1 .. 40 loop
      insert into public.payments (club_id, amount, provider, status, paid_at, created_at)
      values (
        c.id,
        (100000 + (i * 37 % 20) * 50000),
        (array['cash','click','payme']::payment_provider[])[1 + (i % 3)],
        'paid',
        now() - ((i % 30) || ' days')::interval - ((i * 7 % 24) || ' hours')::interval,
        now()
      );
    end loop;

    -- ── платежи сегодня и вчера (для метрики «Выручка за сегодня») ──
    for i in 1 .. 6 loop
      insert into public.payments (club_id, amount, provider, status, paid_at, created_at)
      values (c.id, (300000 + i * 150000), 'cash', 'paid', now() - (i || ' hours')::interval, now());
    end loop;
    for i in 1 .. 5 loop
      insert into public.payments (club_id, amount, provider, status, paid_at, created_at)
      values (c.id, (250000 + i * 120000), 'click', 'paid',
              now() - interval '1 day' - (i || ' hours')::interval, now());
    end loop;

    -- ── посещения за последние 14 дней ──
    for i in 1 .. 120 loop
      select id into cl from public.clients where club_id = c.id order by random() limit 1;
      insert into public.visits (club_id, client_id, checked_in_at, method)
      values (
        c.id, cl,
        now() - ((i % 14) || ' days')::interval - ((i * 5 % 12) || ' hours')::interval,
        (array['manual','qr','telegram']::visit_method[])[1 + (i % 3)]
      );
    end loop;

  end loop;
end $$;

-- ── Очистка демо-данных (при необходимости выполнить отдельно) ──
-- delete from public.clients where notes = '[demo]';   -- каскадом удалит их subscriptions/visits/payments
-- delete from public.payments where client_id is null;  -- разбросанные платежи без клиента
-- delete from public.memberships where name in ('VIP Безлимит','PRO','Дневной','Утренний','Женский');
