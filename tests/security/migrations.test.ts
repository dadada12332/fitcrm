import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const migrationsDir = path.join(process.cwd(), "supabase/migrations")
const migrationFiles = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort()
const sql = migrationFiles.map((file) => readFileSync(path.join(migrationsDir, file), "utf8")).join("\n").toLowerCase()
const billingRenewalExpandSql = readFileSync(
  path.join(migrationsDir, "20260804103933_platform_billing_renewal_hardening.sql"),
  "utf8",
).toLowerCase()
const billingRenewalContractSql = readFileSync(
  path.join(migrationsDir, "20260804110824_platform_billing_renewal_contract.sql"),
  "utf8",
).toLowerCase()

describe("database security migrations", () => {
  it("keeps migration numbering unique", () => {
    const numbers = migrationFiles.map((file) => file.split("_", 1)[0])
    expect(new Set(numbers).size).toBe(numbers.length)
  })

  it.each(["clubs", "staff", "clients", "memberships", "subscriptions", "payments", "visits"])(
    "enables RLS for %s",
    (table) => {
      expect(sql).toMatch(new RegExp("alter\\s+table(?:\\s+public\\.)?" + table + "\\s+enable\\s+row\\s+level\\s+security"))
    },
  )

  it.each([
    "access_control_integrations",
    "access_control_credentials",
    "access_control_events",
    "access_control_reservations",
  ])(
    "keeps access-control table %s behind RLS and service-role access",
    (table) => {
      expect(sql).toMatch(new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`))
      expect(sql).toContain("to service_role")
    },
  )

  it("keeps the atomic access-control check-in RPC service-only", () => {
    expect(sql).toContain("reserve_access_control_entry")
    expect(sql).toContain("process_access_control_entry")
    expect(sql).toContain("from public, anon, authenticated")
    expect(sql).toContain("grant execute on function public.reserve_access_control_entry")
    expect(sql).toContain("grant execute on function public.process_access_control_entry")
  })

  it("contains the staff privilege-escalation trigger", () => {
    expect(sql).toContain("enforce_staff_no_escalation")
    expect(sql).toContain("create trigger staff_no_escalation")
  })

  it("scopes the tenant helper to the authenticated user", () => {
    expect(sql).toContain("auth.uid()")
    expect(sql).toContain("user_club_ids")
  })

  it("protects platform roles and club billing fields from direct Data API updates", () => {
    expect(sql).toContain("users_protect_platform_role")
    expect(sql).toContain("platform_role_service_only")
    expect(sql).toContain("drop policy if exists users_self_delete")
    expect(sql).toContain("clubs_protect_platform_fields")
    expect(sql).toContain("club_platform_fields_service_only")
  })

  it("keeps provider confirmation and Payme lifecycle RPCs service-only", () => {
    for (const rpc of [
      "confirm_provider_payment",
      "create_payme_transaction",
      "perform_payme_transaction",
      "cancel_payme_transaction",
    ]) {
      expect(sql).toContain(rpc)
      expect(sql).toContain("to service_role")
    }
  })

  it("revokes anonymous execution and runs tenant readers as invoker", () => {
    expect(sql).toContain("0055: prevent public and cross-tenant execution")
    expect(sql).toContain("alter function public.clients_page")
    expect(sql).toContain("security invoker")
    expect(sql).toContain("from public, anon")
    expect(sql).toContain("platform_clubs_metrics(uuid[]) from public, anon, authenticated")
  })

  it("keeps platform billing approval server-authoritative and renewal-safe", () => {
    expect(migrationFiles.indexOf("20260804103933_platform_billing_renewal_hardening.sql"))
      .toBeLessThan(migrationFiles.indexOf("20260804110824_platform_billing_renewal_contract.sql"))
    for (const column of [
      "quoted_plan_id",
      "quoted_unit_price",
      "quoted_currency",
      "quoted_period",
      "quoted_at",
      "promo_free_days",
      "resolution_reason",
    ]) {
      expect(billingRenewalExpandSql).toContain(column)
    }
    expect(billingRenewalExpandSql).toContain("platform_billing_approval_rollout_freeze")
    expect(billingRenewalExpandSql).toContain("billing_approval_contract_pending")
    expect(billingRenewalExpandSql).toContain("drop policy if exists billing_requests_insert")
    expect(billingRenewalExpandSql).toContain("drop policy if exists billing_requests_cancel")
    expect(billingRenewalExpandSql).toContain("drop policy if exists billing_requests_update")
    expect(billingRenewalExpandSql).toContain(
      "revoke insert, update, delete on table public.platform_billing_requests",
    )
    expect(billingRenewalExpandSql).toContain("platform_billing_requests_one_pending_club_idx")
    expect(billingRenewalExpandSql).toContain("superseded_pending_request")
    expect(billingRenewalExpandSql).toContain("row_number() over (partition by club_id")
    expect(billingRenewalExpandSql).toContain("commercial_terms_repaired_resubmit")
    expect(billingRenewalExpandSql).toContain("plan_currency_locked = plans.currency")
    expect(billingRenewalExpandSql).not.toContain("plan_currency_locked = coalesce")
    expect(billingRenewalExpandSql).toContain("platform_apply_plan_commercial_terms")
    expect(billingRenewalExpandSql).toContain("platform_save_plan_configuration")
    expect(billingRenewalExpandSql).toContain("platform_change_club_plan")
    expect(billingRenewalExpandSql).toContain("platform_plan_already_assigned")
    expect(billingRenewalExpandSql).toContain("plan_changed_by_admin")
    expect(billingRenewalExpandSql).toContain("platform_extend_club_trial")
    expect(billingRenewalExpandSql).toContain("platform_trial_only")
    expect(billingRenewalExpandSql).toMatch(
      /create or replace function public\.create_club_for_user[\s\S]*?lock table public\.platform_billing_requests in share row exclusive mode/,
    )
    expect(billingRenewalExpandSql).toMatch(
      /create or replace function public\.create_branch_for_user[\s\S]*?lock table public\.platform_billing_requests in share row exclusive mode/,
    )
    expect(billingRenewalExpandSql).toContain("access_control_integrations")
    expect(billingRenewalExpandSql).not.toContain("platform_approve_billing_request")

    expect(billingRenewalContractSql).toMatch(
      /where id = v_request\.quoted_plan_id\s+and is_archived = false\s+and is_active = true/,
    )
    expect(billingRenewalContractSql).toContain("check (months between 1 and 12) not valid")
    expect(billingRenewalContractSql).toContain("invalid_months_resubmit")
    expect(billingRenewalContractSql).toContain("legacy_quote_missing_resubmit")
    expect(billingRenewalContractSql).toContain("unsupported_period_resubmit")
    expect(billingRenewalContractSql).toContain("unlimited_plan_no_renewal")
    expect(billingRenewalContractSql).toContain("repeat the deterministic expand repair at contract time")
    expect(billingRenewalContractSql).toContain("lock table public.platform_billing_requests in share row exclusive mode")
    expect(billingRenewalContractSql).toContain("drop trigger if exists platform_billing_approval_rollout_freeze")
    expect(billingRenewalContractSql).toContain("platform_billing_requests_one_pending_club_idx")
    expect(billingRenewalContractSql).toContain("where status = 'pending'")
    expect(billingRenewalContractSql).toContain("drop policy if exists billing_requests_insert")
    expect(billingRenewalContractSql).toContain("drop policy if exists billing_requests_update")
    expect(billingRenewalContractSql).toContain("revoke insert, update, delete on table public.platform_billing_requests")
    expect(billingRenewalContractSql).toContain("grant execute on function public.platform_approve_billing_request")
    expect(billingRenewalContractSql).toContain("billing_request_quote_immutable")
    expect(billingRenewalContractSql).toContain("new.quoted_plan_id is distinct from old.quoted_plan_id")
    expect(billingRenewalContractSql).toContain("billing_request_unsupported_period")
    expect(billingRenewalContractSql).toContain("never reprice a legacy or untrusted request")
    expect(billingRenewalContractSql).toContain("v_quoted_base_amount := round(v_request.quoted_unit_price * v_request.months, 2)")
    expect(billingRenewalContractSql).toContain("create or replace function public.platform_cancel_club_compensation")
    expect(billingRenewalContractSql).toContain("compensation_cancelled_resubmit")
    expect(billingRenewalContractSql).not.toContain("compensation_id = null")
    expect(billingRenewalContractSql).not.toContain("set amount =")
    expect(billingRenewalContractSql).toContain("perform private.enforce_platform_plan_capacity")
    expect(billingRenewalContractSql).toContain("billing_plan_capacity_unconfigured")
    expect(billingRenewalContractSql).toContain("billing_plan_capacity_exceeded")
    expect(billingRenewalContractSql).toContain("accepted_at is null and expires_at > now()")
    expect(billingRenewalContractSql).toContain("authoritative point-in-time recheck at approval")
    expect(billingRenewalContractSql).not.toContain("lock table public.clients")
    expect(billingRenewalContractSql).toContain("billing_unlimited_plan_no_renewal")
    expect(billingRenewalContractSql).toContain("when v_same_plan then greatest(v_now, v_club.plan_expires_at)")
    expect(billingRenewalContractSql).not.toContain("plan = case when v_plan.code")
    expect(billingRenewalContractSql).toContain("if v_plan.code in ('trial', 'starter', 'standard', 'business') then")
    expect(billingRenewalContractSql).toContain("set plan = v_plan.code::public.club_plan")
    expect(billingRenewalContractSql).toContain("for update")
    expect(billingRenewalContractSql).not.toContain("suspended_at = null")
    expect(billingRenewalContractSql).toContain("private.club_has_platform_access")
    expect(billingRenewalContractSql).toContain("platform_subscription_write_gate")
    expect(billingRenewalContractSql).toContain("platform_subscription_read_gate")
    expect(billingRenewalContractSql).toContain("platform_subscription_storage_insert_gate")
    expect(billingRenewalContractSql).toContain("revoke all on function public.create_club(text, text)")
    expect(billingRenewalExpandSql).toContain("create_club_for_user")
    expect(billingRenewalContractSql).toContain("create or replace function public.accept_staff_invitation")
    expect(billingRenewalContractSql).toContain("app.accept_staff_invitation_id")
    expect(billingRenewalContractSql).toContain("invitation.accepted_at = transaction_timestamp()")
    expect(billingRenewalContractSql).toContain("coalesce(settings, '{}'::jsonb) - 'permissions'")
    expect(billingRenewalContractSql).not.toContain("email is null or lower(email) = v_user_email")
    const acceptFunction = billingRenewalContractSql.slice(
      billingRenewalContractSql.indexOf("create or replace function public.accept_staff_invitation"),
      billingRenewalContractSql.indexOf("revoke all on function public.accept_staff_invitation"),
    )
    expect(acceptFunction.indexOf("update public.staff_invitations"))
      .toBeLessThan(acceptFunction.indexOf("insert into public.staff"))
  })
})
