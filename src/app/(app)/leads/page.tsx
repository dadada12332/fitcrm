import { redirect } from "next/navigation"
import { LeadHub, type LeadHubQueryState } from "@/components/app/LeadHub"
import { getAuthUser } from "@/lib/auth"
import { getCurrentClubForPage } from "@/lib/club"
import { getLeadHubData, LEADS_PAGE_SIZE, type LeadsQuery } from "@/lib/leads"
import { planFeatureEnabled, planSectionEnabled } from "@/lib/plan-access"
import { sanitizeSearchTerm } from "@/lib/search"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_KEY_RE = /^[a-z0-9_-]{1,64}$/i
const QUICK_FILTERS = new Set(["all", "mine", "overdue", "unassigned"])
const LEAD_STATES = new Set(["open", "won", "lost", "all"])
const LEAD_SORTS = new Set(["updated_desc", "created_desc", "action_asc", "value_desc"])

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function safeKey(value: string | undefined): string {
  return value && SAFE_KEY_RE.test(value) ? value : ""
}

function safeUuid(value: string | undefined): string {
  return value && UUID_RE.test(value) ? value : ""
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [club, user, params] = await Promise.all([
    getCurrentClubForPage(),
    getAuthUser(),
    searchParams,
  ])

  if (!user) redirect("/login?next=/leads")
  if (!club) redirect("/onboarding")
  if (!club.permissions.leads.view) redirect("/dashboard")
  if (!planSectionEnabled(club.planAccess, "leads") || !planFeatureEnabled(club.planAccess, "leads")) {
    redirect("/dashboard")
  }

  const rawQuick = one(params.quick) ?? "all"
  const rawState = one(params.state) ?? "open"
  const rawSort = one(params.sort) ?? "updated_desc"
  const rawAssignee = one(params.assignee)
  const page = Math.min(100_000, Math.max(0, Number.parseInt(one(params.page) ?? "0", 10) || 0))

  const queryState: LeadHubQueryState = {
    search: sanitizeSearchTerm(one(params.q) ?? "").slice(0, 120),
    quick: QUICK_FILTERS.has(rawQuick) ? rawQuick as LeadHubQueryState["quick"] : "all",
    stage: safeKey(one(params.stage)),
    source: safeKey(one(params.source)),
    assignee: rawAssignee === "unassigned" ? "unassigned" : safeUuid(rawAssignee),
    state: LEAD_STATES.has(rawState) ? rawState as LeadHubQueryState["state"] : "open",
    sort: LEAD_SORTS.has(rawSort) ? rawSort as LeadHubQueryState["sort"] : "updated_desc",
    page,
  }

  const query: LeadsQuery = {
    search: queryState.search,
    quick: queryState.quick,
    stage: queryState.stage || undefined,
    source: queryState.source || undefined,
    assignee: queryState.assignee || undefined,
    state: queryState.state,
    sort: queryState.sort,
    page,
    pageSize: LEADS_PAGE_SIZE,
  }
  const selectedLeadId = safeUuid(one(params.lead)) || undefined
  const data = await getLeadHubData(club.clubId, user.id, club.timezone, query, selectedLeadId)
  const normalizedQueryState = data.page === queryState.page
    ? queryState
    : { ...queryState, page: data.page }
  const readOnly = club.impersonating === true

  return (
    <LeadHub
      data={data}
      query={normalizedQueryState}
      nowIso={new Date().toISOString()}
      permissions={{
        create: !readOnly && club.permissions.leads.create,
        edit: !readOnly && club.permissions.leads.edit,
        assign: !readOnly && club.permissions.leads.assign,
        convert: !readOnly && club.permissions.leads.convert,
        archive: !readOnly && club.permissions.leads.archive,
        clientsView: club.permissions.clients.view,
        clientsCreate: !readOnly && club.permissions.clients.create,
        readOnly,
      }}
    />
  )
}
