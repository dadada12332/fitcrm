-- 0013_roles.sql
-- Full role-based permissions system

-- 1. Change staff.role from enum to text (keeps existing values)
ALTER TABLE public.staff ALTER COLUMN role TYPE text USING role::text;
DROP TYPE IF EXISTS staff_role;

-- 2. Create club_roles table
CREATE TABLE IF NOT EXISTS public.club_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  key         text NOT NULL,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  permissions jsonb NOT NULL DEFAULT '{}',
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, key)
);

ALTER TABLE public.club_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club_roles_select" ON public.club_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE staff.club_id = club_roles.club_id
        AND staff.user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "club_roles_manage" ON public.club_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE staff.club_id = club_roles.club_id
        AND staff.user_id = auth.uid()
        AND staff.role = 'owner'
        AND staff.is_active = true
    )
  );

-- 3. Function to create default roles for a club
CREATE OR REPLACE FUNCTION create_default_club_roles(p_club_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO public.club_roles (club_id, key, name, description, permissions, is_system) VALUES
  (p_club_id, 'owner', 'Владелец', 'Полный доступ ко всем функциям',
    '{"dashboard":{"view":true,"view_finance":true},"clients":{"view":true,"create":true,"edit":true,"delete":true,"freeze":true,"extend":true,"export":true},"memberships":{"view":true,"sell":true,"create":true,"edit":true,"delete":true,"change_price":true},"payments":{"view":true,"create":true,"refund":true,"view_revenue":true,"export":true},"visits":{"view":true,"checkin":true,"checkout":true,"manual":true,"delete_history":true},"schedule":{"view":true,"create":true,"edit":true,"delete":true},"warehouse":{"view":true,"sell":true,"supply":true,"writeoff":true,"view_cost_price":true},"staff":{"view":true,"create":true,"edit":true,"delete":true,"salaries":true},"reports":{"view":true,"finance":true,"export":true},"ai":{"use":true},"telegram":{"view":true,"manage":true},"settings":{"general":true,"integrations":true,"subscription":true,"roles":true}}'::jsonb,
    true),
  (p_club_id, 'admin', 'Администратор', 'Управление клиентами и операциями',
    '{"dashboard":{"view":true,"view_finance":false},"clients":{"view":true,"create":true,"edit":true,"delete":false,"freeze":true,"extend":true,"export":true},"memberships":{"view":true,"sell":true,"create":true,"edit":true,"delete":false,"change_price":false},"payments":{"view":true,"create":true,"refund":true,"view_revenue":false,"export":false},"visits":{"view":true,"checkin":true,"checkout":true,"manual":true,"delete_history":false},"schedule":{"view":true,"create":true,"edit":true,"delete":true},"warehouse":{"view":true,"sell":true,"supply":true,"writeoff":true,"view_cost_price":false},"staff":{"view":true,"create":false,"edit":false,"delete":false,"salaries":false},"reports":{"view":true,"finance":false,"export":false},"ai":{"use":true},"telegram":{"view":true,"manage":false},"settings":{"general":true,"integrations":false,"subscription":false,"roles":false}}'::jsonb,
    true),
  (p_club_id, 'manager', 'Менеджер', 'Продажи и работа с клиентами',
    '{"dashboard":{"view":true,"view_finance":false},"clients":{"view":true,"create":true,"edit":true,"delete":false,"freeze":true,"extend":true,"export":true},"memberships":{"view":true,"sell":true,"create":false,"edit":false,"delete":false,"change_price":false},"payments":{"view":true,"create":true,"refund":false,"view_revenue":false,"export":false},"visits":{"view":true,"checkin":true,"checkout":true,"manual":true,"delete_history":false},"schedule":{"view":true,"create":false,"edit":false,"delete":false},"warehouse":{"view":true,"sell":true,"supply":false,"writeoff":false,"view_cost_price":false},"staff":{"view":true,"create":false,"edit":false,"delete":false,"salaries":false},"reports":{"view":true,"finance":false,"export":false},"ai":{"use":false},"telegram":{"view":false,"manage":false},"settings":{"general":false,"integrations":false,"subscription":false,"roles":false}}'::jsonb,
    true),
  (p_club_id, 'trainer', 'Тренер', 'Работа с клиентами и расписанием',
    '{"dashboard":{"view":true,"view_finance":false},"clients":{"view":true,"create":false,"edit":false,"delete":false,"freeze":true,"extend":false,"export":false},"memberships":{"view":true,"sell":false,"create":false,"edit":false,"delete":false,"change_price":false},"payments":{"view":false,"create":false,"refund":false,"view_revenue":false,"export":false},"visits":{"view":true,"checkin":true,"checkout":true,"manual":true,"delete_history":false},"schedule":{"view":true,"create":false,"edit":false,"delete":false},"warehouse":{"view":false,"sell":false,"supply":false,"writeoff":false,"view_cost_price":false},"staff":{"view":false,"create":false,"edit":false,"delete":false,"salaries":false},"reports":{"view":false,"finance":false,"export":false},"ai":{"use":false},"telegram":{"view":false,"manage":false},"settings":{"general":false,"integrations":false,"subscription":false,"roles":false}}'::jsonb,
    true),
  (p_club_id, 'accountant', 'Бухгалтер', 'Финансы и отчётность',
    '{"dashboard":{"view":true,"view_finance":true},"clients":{"view":true,"create":false,"edit":false,"delete":false,"freeze":false,"extend":false,"export":true},"memberships":{"view":true,"sell":false,"create":false,"edit":false,"delete":false,"change_price":false},"payments":{"view":true,"create":false,"refund":false,"view_revenue":true,"export":true},"visits":{"view":true,"checkin":false,"checkout":false,"manual":false,"delete_history":false},"schedule":{"view":false,"create":false,"edit":false,"delete":false},"warehouse":{"view":true,"sell":false,"supply":false,"writeoff":false,"view_cost_price":true},"staff":{"view":true,"create":false,"edit":false,"delete":false,"salaries":true},"reports":{"view":true,"finance":true,"export":true},"ai":{"use":false},"telegram":{"view":false,"manage":false},"settings":{"general":false,"integrations":false,"subscription":false,"roles":false}}'::jsonb,
    true),
  (p_club_id, 'cashier', 'Кассир', 'Продажи и посещения',
    '{"dashboard":{"view":true,"view_finance":false},"clients":{"view":true,"create":true,"edit":false,"delete":false,"freeze":false,"extend":true,"export":false},"memberships":{"view":true,"sell":true,"create":false,"edit":false,"delete":false,"change_price":false},"payments":{"view":true,"create":true,"refund":false,"view_revenue":false,"export":false},"visits":{"view":true,"checkin":true,"checkout":true,"manual":false,"delete_history":false},"schedule":{"view":true,"create":false,"edit":false,"delete":false},"warehouse":{"view":false,"sell":false,"supply":false,"writeoff":false,"view_cost_price":false},"staff":{"view":false,"create":false,"edit":false,"delete":false,"salaries":false},"reports":{"view":false,"finance":false,"export":false},"ai":{"use":false},"telegram":{"view":false,"manage":false},"settings":{"general":false,"integrations":false,"subscription":false,"roles":false}}'::jsonb,
    true)
  ON CONFLICT (club_id, key) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger to auto-create roles for new clubs
CREATE OR REPLACE FUNCTION trigger_create_default_club_roles()
RETURNS trigger AS $$
BEGIN
  PERFORM create_default_club_roles(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER after_club_insert_create_roles
  AFTER INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION trigger_create_default_club_roles();

-- 5. Create default roles for all existing clubs
SELECT create_default_club_roles(id) FROM public.clubs;
