import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8")
const actions = read("src/app/(app)/leads/actions.ts")
const clientActions = read("src/app/(app)/clients/actions.ts")
const data = read("src/lib/leads.ts")
const page = read("src/app/(app)/leads/page.tsx")
const leadHub = read("src/components/app/LeadHub.tsx")
const leadDetail = read("src/components/app/LeadDetailSheet.tsx")
const migration = read("supabase/migrations/20260805075601_lead_hub_foundation.sql").toLowerCase()
const hardening = read("supabase/migrations/20260807115921_lead_hub_client_integrity.sql").toLowerCase()

function migrationFunction(name: string) {
  const start = migration.indexOf(`create or replace function public.${name}(`)
  expect(start, `${name} must exist in the Lead Hub migration`).toBeGreaterThanOrEqual(0)
  const end = migration.indexOf("\n$$;", start)
  expect(end, `${name} must have a complete SQL body`).toBeGreaterThan(start)
  return migration.slice(start, end)
}

describe("Lead Hub security contract", () => {
  it("checks granular permissions and resolves the current club without a caller-supplied tenant", () => {
    expect(actions).toContain("getCurrentClub()")
    expect(actions).toContain('can(club.permissions, "leads", action)')
    expect(actions).not.toMatch(/getCurrentClub\([^)]/)
    expect(actions).toContain("if (club.impersonating)")
  })

  it("scopes the actor lookup and every mutation RPC to the resolved club", () => {
    expect(actions).toContain('.eq("club_id", club.clubId)')
    const rpcCalls = [...actions.matchAll(/\.rpc\("([a-z_]+)",\s*\{([\s\S]*?)\n\s*\}\)/g)]
    expect(rpcCalls.length).toBeGreaterThanOrEqual(10)
    for (const [, rpc, args] of rpcCalls) {
      expect(args, `${rpc} must receive tenant scope`).toContain("p_club_id: context.clubId")
      expect(args, `${rpc} must receive the verified actor`).toContain("p_actor_staff_id: context.staffId")
    }
  })

  it("sanitizes PostgREST search filters", () => {
    expect(data).toContain('import { sanitizeSearchTerm } from "@/lib/search"')
    expect(data).toContain("const search = sanitizeSearchTerm")
  })

  it("does not expose duplicate contact PII without the corresponding view permission", () => {
    expect(actions).toContain("function visibleDuplicates")
    expect(actions).toContain('can(permissions, "leads", "view")')
    expect(actions).toContain('can(permissions, "clients", "view")')
    expect(actions).toContain("visibleDuplicates(payload, context.permissions)")
  })

  it("does not let create or task-edit permissions assign work to another employee", () => {
    expect(actions).toContain('if (!can(context.permissions, "leads", "assign"))')
    expect(actions).toContain("assigneeStaffId !== context.staffId")
    expect(actions).toContain('assignedStaffId !== context.staffId && !can(context.permissions, "leads", "assign")')
    expect(actions).toContain('trainerStaffId !== context.staffId && !can(context.permissions, "leads", "assign")')
    expect(leadDetail).toContain("const availableTrainers = canAssign ? staff : staff.filter")
    expect(leadDetail).toContain("canAssign={permissions.assign}")
  })

  it("requires client creation permission for every conversion mode", () => {
    expect(actions).toContain('if (!can(context.permissions, "clients", "create"))')
    expect(actions).not.toContain('if (!existingClientId && !can(context.permissions, "clients", "create"))')
  })

  it("renders platform impersonation as an explicit read-only Lead Hub", () => {
    expect(page).toContain("const readOnly = club.impersonating === true")
    expect(page).toContain("create: !readOnly && club.permissions.leads.create")
    expect(page).toContain("clientsCreate: !readOnly && club.permissions.clients.create")
    expect(leadHub).toContain("Режим просмотра")
  })

  it("refreshes stale lead data after an optimistic version conflict", () => {
    expect(leadDetail).toContain('result.error === "Лид уже изменился. Обновите данные и повторите действие."')
    expect(leadDetail).toContain("router.refresh()")
    expect(leadDetail).toContain("edit-${editOpen}-${lead.version}")
  })

  it("keeps all Lead Hub tables tenant-scoped and authenticated writes service-only", () => {
    for (const table of [
      "lead_settings",
      "lead_sources",
      "lead_pipeline_stages",
      "lead_loss_reasons",
      "leads",
      "lead_tasks",
      "lead_activities",
      "lead_stage_history",
      "lead_trials",
      "lead_conversions",
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`)
      expect(migration).toContain(`'${table}'`)
    }
    expect(migration).toContain("alter table public.%i enable row level security")
    expect(migration).toContain("create policy lead_hub_permission_select on public.%i")
    expect(migration).toContain("create policy lead_hub_tenant_scope on public.%i")
    expect(migration).toContain("grant select on")
    expect(migration).toContain("to authenticated")
    expect(migration).toContain("to service_role")
    expect(migration).not.toContain("grant all on table")
    expect(migration).not.toContain("grant delete on table")
    expect(migration).toContain("platform_subscription_read_gate")
    expect(migration).toContain("platform_subscription_write_gate")
  })

  it("keeps conversion atomic, idempotent and unavailable to browser roles", () => {
    expect(migration).toContain("create or replace function public.convert_lead_to_client")
    expect(migration).toContain("for update")
    expect(migration).toContain("idempotency")
    expect(migration).toContain("lead_conversions")
    expect(migration).toContain("from public, anon, authenticated")
    expect(migration).toContain("grant execute on function public.convert_lead_to_client")
    expect(migration).toContain("to service_role")
    expect((migration.match(/'lead-contact:'/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })

  it("prevents a converted client from being deleted out from under the sales audit trail", () => {
    expect(clientActions).toContain('.from("lead_conversions")')
    expect(clientActions).toContain('.eq("club_id", club.clubId)')
    expect(clientActions).toContain('.eq("client_id", clientId)')
    expect(hardening).toContain("alter column client_id set not null")
    expect((hardening.match(/on delete restrict/g) ?? []).length).toBe(2)
    expect(hardening).not.toContain("on delete set null")
  })

  it("keeps won leads immutable in editable and assignment RPCs", () => {
    for (const rpc of ["update_lead_details", "assign_lead"]) {
      const sql = migrationFunction(rpc)
      expect(sql).toContain("for update")
      expect(sql).toContain("if v_lead.state = 'won' then raise exception 'lead_won_immutable'; end if;")
      expect(sql.indexOf("lead_won_immutable")).toBeLessThan(sql.indexOf("update public.leads"))
    }
  })

  it("does not advertise the unsupported leads export permission", () => {
    const sql = migration.slice(
      migration.indexOf("create or replace function private.default_lead_permissions("),
      migration.indexOf("\n$$;", migration.indexOf("create or replace function private.default_lead_permissions(")),
    )
    expect(sql).not.toContain('"export"')
  })
})
