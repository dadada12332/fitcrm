-- Keep membership freeze allowance within the actual membership duration.
alter table public.memberships
  add constraint memberships_freeze_days_allowed_check
  check (
    freeze_days_allowed >= 0
    and freeze_days_allowed <= duration_days
  );
