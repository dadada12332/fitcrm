-- Add settings JSONB to staff table for extended profile data
alter table public.staff add column if not exists settings jsonb not null default '{}';

-- Seed demo staff members (additional trainers/admins) for the current club
-- This runs as a function to safely use the existing club_id
do $$
declare
  v_club_id uuid;
  v_user1   uuid := gen_random_uuid();
  v_user2   uuid := gen_random_uuid();
  v_user3   uuid := gen_random_uuid();
  v_user4   uuid := gen_random_uuid();
  v_user5   uuid := gen_random_uuid();
  v_staff1  uuid;
  v_staff2  uuid;
  v_staff3  uuid;
  v_staff4  uuid;
  v_staff5  uuid;
begin
  select id into v_club_id from public.clubs limit 1;
  if v_club_id is null then return; end if;

  -- Skip if already have demo staff
  if (select count(*) from public.staff where club_id = v_club_id) > 2 then return; end if;

  -- Insert ghost users (no auth.users entry needed for display)
  insert into public.users (id, email, full_name) values
    (v_user1, 'aziz.karimov@fitcrm.demo',   'Азиз Каримов'),
    (v_user2, 'dilnoza.yusupova@fitcrm.demo','Дилноза Юсупова'),
    (v_user3, 'bekzod.rakhimov@fitcrm.demo', 'Бекзод Рахимов'),
    (v_user4, 'malika.nazarova@fitcrm.demo', 'Малика Назарова'),
    (v_user5, 'jasur.toshmatov@fitcrm.demo', 'Жасур Тошматов')
  on conflict (id) do nothing;

  -- Insert staff records with settings
  insert into public.staff (user_id, club_id, role, salary, is_active, settings) values
    (v_user1, v_club_id, 'trainer', 4000000,  true, '{
      "phone": "+998901234567", "dob": "1992-03-15", "hired_at": "2022-09-01",
      "status": "active", "salary_type": "mixed", "salary_fixed": 4000000,
      "salary_percent": 20,
      "permissions": {"clients":true,"visits":true,"payments":false,"inventory":false,"finance":false,"settings":false},
      "salary_history": [
        {"date":"2026-05-01","amount":6300000,"note":"Май 2026"},
        {"date":"2026-04-01","amount":5800000,"note":"Апрель 2026"}
      ]
    }'::jsonb)
  returning id into v_staff1;

  insert into public.staff (user_id, club_id, role, salary, is_active, settings) values
    (v_user2, v_club_id, 'trainer', 3500000, true, '{
      "phone": "+998902345678", "dob": "1995-07-22", "hired_at": "2023-03-15",
      "status": "active", "salary_type": "percent", "salary_fixed": 0,
      "salary_percent": 25,
      "permissions": {"clients":true,"visits":true,"payments":false,"inventory":false,"finance":false,"settings":false},
      "salary_history": [
        {"date":"2026-05-01","amount":3750000,"note":"Май 2026"}
      ]
    }'::jsonb)
  returning id into v_staff2;

  insert into public.staff (user_id, club_id, role, salary, is_active, settings) values
    (v_user3, v_club_id, 'trainer', 3800000, true, '{
      "phone": "+998903456789", "dob": "1990-11-08", "hired_at": "2021-06-01",
      "status": "vacation", "salary_type": "fixed", "salary_fixed": 3800000,
      "salary_percent": 0,
      "permissions": {"clients":true,"visits":true,"payments":false,"inventory":false,"finance":false,"settings":false},
      "salary_history": []
    }'::jsonb)
  returning id into v_staff3;

  insert into public.staff (user_id, club_id, role, salary, is_active, settings) values
    (v_user4, v_club_id, 'admin', 5500000, true, '{
      "phone": "+998904567890", "dob": "1988-01-30", "hired_at": "2020-01-15",
      "status": "active", "salary_type": "fixed", "salary_fixed": 5500000,
      "salary_percent": 0,
      "permissions": {"clients":true,"visits":true,"payments":true,"inventory":true,"finance":false,"settings":false},
      "salary_history": [
        {"date":"2026-05-01","amount":5500000,"note":"Май 2026"}
      ]
    }'::jsonb)
  returning id into v_staff4;

  insert into public.staff (user_id, club_id, role, salary, is_active, settings) values
    (v_user5, v_club_id, 'trainer', 3200000, false, '{
      "phone": "+998905678901", "dob": "1997-05-12", "hired_at": "2024-02-01",
      "status": "fired", "salary_type": "fixed", "salary_fixed": 3200000,
      "salary_percent": 0,
      "permissions": {"clients":true,"visits":true,"payments":false,"inventory":false,"finance":false,"settings":false},
      "salary_history": []
    }'::jsonb)
  returning id into v_staff5;

  -- Link some existing visits to demo trainers
  if v_staff1 is not null then
    update public.visits set staff_id = v_staff1
    where club_id = v_club_id and staff_id is null
    and ctid in (select ctid from public.visits where club_id = v_club_id and staff_id is null limit 15);
  end if;

  if v_staff2 is not null then
    update public.visits set staff_id = v_staff2
    where club_id = v_club_id and staff_id is null
    and ctid in (select ctid from public.visits where club_id = v_club_id and staff_id is null limit 10);
  end if;

  if v_staff3 is not null then
    update public.visits set staff_id = v_staff3
    where club_id = v_club_id and staff_id is null
    and ctid in (select ctid from public.visits where club_id = v_club_id and staff_id is null limit 8);
  end if;

end $$;
