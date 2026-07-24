-- Salary and salary history must not be readable through the Data API with
-- staff.view alone. Server code fetches them with service-role only after an
-- explicit staff.salaries permission check and sanitizes the RSC payload.
revoke select on public.staff from authenticated;
grant select (
  id,
  user_id,
  club_id,
  role,
  is_active,
  created_at,
  product_tour_completed_at,
  trial_offer_last_seen_at
) on public.staff to authenticated;

revoke execute on function public.get_staff_page_data(uuid) from authenticated;
grant execute on function public.get_staff_page_data(uuid) to service_role;
