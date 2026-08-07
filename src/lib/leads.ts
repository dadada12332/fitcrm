import { createServiceClient } from "@/lib/supabase/service"
import { sanitizeSearchTerm } from "@/lib/search"
import { zonedDayRange } from "@/lib/timezone"

export const LEADS_PAGE_SIZE = 50

export type LeadState = "open" | "won" | "lost"
export type LeadStageKey =
  | "new"
  | "contacted"
  | "qualified"
  | "trial_booked"
  | "trial_completed"
  | "offer"
  | "won"
  | "lost"

export type LeadPriority = "low" | "normal" | "high" | "urgent"
export type LeadTaskType = "call" | "message" | "trial" | "follow_up" | "proposal" | "other"
export type LeadTrialStatus = "scheduled" | "attended" | "no_show" | "cancelled"

export type LeadStageOption = {
  id: string
  key: LeadStageKey
  name: string
  kind: LeadState
  position: number
  tone: "neutral" | "brand" | "warning" | "success" | "destructive"
}

export type LeadSourceOption = {
  id: string
  key: string
  name: string
  category: string
}

export type LeadLossReasonOption = {
  id: string
  key: string
  name: string
}

export type LeadStaffOption = {
  id: string
  name: string
  role: string
}

export type LeadTask = {
  id: string
  origin: "task" | "trial"
  type: LeadTaskType
  title: string
  note: string | null
  dueAt: string
  status: "pending" | "completed" | "cancelled"
  priority: LeadPriority
  assignedStaffId: string | null
  completedAt: string | null
  createdAt: string
}

export type LeadRow = {
  id: string
  leadNo: number
  name: string
  phone: string | null
  email: string | null
  telegramUsername: string | null
  stage: LeadStageOption
  state: LeadState
  source: LeadSourceOption
  priority: LeadPriority
  assigneeId: string | null
  assigneeName: string | null
  interest: string | null
  estimatedValue: number
  currency: string
  firstResponseDueAt: string
  firstResponseAt: string | null
  lastActivityAt: string | null
  nextAction: LeadTask | null
  convertedClientId: string | null
  createdAt: string
  updatedAt: string
  version: number
}

export type LeadActivity = {
  id: string
  kind: string
  channel: string | null
  direction: string | null
  outcome: string | null
  body: string | null
  occurredAt: string
  actorName: string | null
}

export type LeadTrial = {
  id: string
  title: string
  scheduledAt: string
  durationMinutes: number
  status: LeadTrialStatus
  trainerStaffId: string | null
  trainerName: string | null
  notes: string | null
  attendedAt: string | null
}

export type LeadDetail = LeadRow & {
  notes: string | null
  tags: string[]
  sourceDetail: string | null
  preferredChannel: string | null
  lossReasonId: string | null
  lossNote: string | null
  convertedAt: string | null
  archivedAt: string | null
  tasks: LeadTask[]
  activities: LeadActivity[]
  trials: LeadTrial[]
}

export type LeadSummary = {
  newToday: number
  needsAction: number
  trialsNext7Days: number
  converted30Days: number
  created30Days: number
  conversionRate30Days: number
}

export type LeadsQuery = {
  search?: string
  quick?: "all" | "mine" | "overdue" | "unassigned"
  stage?: string
  source?: string
  assignee?: string
  state?: "open" | "won" | "lost" | "all"
  sort?: "updated_desc" | "created_desc" | "action_asc" | "value_desc"
  page?: number
  pageSize?: number
}

export type LeadHubData = {
  rows: LeadRow[]
  total: number
  page: number
  pageSize: number
  summary: LeadSummary
  stages: LeadStageOption[]
  sources: LeadSourceOption[]
  lossReasons: LeadLossReasonOption[]
  staff: LeadStaffOption[]
  currentStaffId: string | null
  selected: LeadDetail | null
}

type RawLead = {
  id: string
  lead_no: number | string
  full_name: string
  phone: string | null
  email: string | null
  telegram_username: string | null
  stage_id: string
  state: LeadState
  source_id: string
  priority: LeadPriority
  assigned_staff_id: string | null
  interest: string | null
  estimated_value: number | string | null
  currency: string
  first_response_due_at: string
  first_response_at: string | null
  last_activity_at: string | null
  converted_client_id: string | null
  created_at: string
  updated_at: string
  version: number | string
  notes?: string | null
  tags?: string[] | null
  source_detail?: string | null
  preferred_channel?: string | null
  loss_reason_id?: string | null
  loss_note?: string | null
  converted_at?: string | null
  archived_at?: string | null
}

const LEAD_LIST_COLUMNS = [
  "id", "lead_no", "full_name", "phone", "email", "telegram_username",
  "stage_id", "state", "source_id", "priority", "assigned_staff_id", "interest",
  "estimated_value", "currency", "first_response_due_at", "first_response_at",
  "last_activity_at", "converted_client_id", "created_at", "updated_at", "version",
].join(",")

const LEAD_DETAIL_COLUMNS = [
  LEAD_LIST_COLUMNS, "notes", "tags", "source_detail", "preferred_channel",
  "loss_reason_id", "loss_note", "converted_at", "archived_at",
].join(",")

export const LEAD_STAGE_LABELS: Record<LeadStageKey, string> = {
  new: "Новый",
  contacted: "Связались",
  qualified: "Квалифицирован",
  trial_booked: "Пробное назначено",
  trial_completed: "Пробное пройдено",
  offer: "Решение",
  won: "Конвертирован",
  lost: "Потерян",
}

export const LEAD_SOURCE_FALLBACK_LABELS: Record<string, string> = {
  manual: "Вручную",
  website: "Сайт",
  telegram: "Telegram",
  instagram: "Instagram",
  phone: "Звонок",
  walk_in: "Walk-in",
  referral: "Рекомендация",
  import: "Импорт",
  other: "Другое",
}

export const LEAD_TASK_LABELS: Record<LeadTaskType, string> = {
  call: "Звонок",
  message: "Сообщение",
  trial: "Пробное занятие",
  follow_up: "Follow-up",
  proposal: "Предложение",
  other: "Другое",
}

function mapTask(row: Record<string, unknown>): LeadTask {
  return {
    id: String(row.id),
    origin: "task",
    type: row.type as LeadTaskType,
    title: String(row.title),
    note: typeof row.note === "string" ? row.note : null,
    dueAt: String(row.due_at),
    status: row.status as LeadTask["status"],
    priority: row.priority as LeadPriority,
    assignedStaffId: typeof row.assigned_staff_id === "string" ? row.assigned_staff_id : null,
    completedAt: typeof row.completed_at === "string" ? row.completed_at : null,
    createdAt: String(row.created_at),
  }
}

function mapTrialAsNextAction(row: Record<string, unknown>): LeadTask {
  return {
    id: String(row.id),
    origin: "trial",
    type: "trial",
    title: typeof row.title === "string" && row.title.trim() ? row.title : "Пробная тренировка",
    note: typeof row.notes === "string" ? row.notes : null,
    dueAt: String(row.scheduled_at),
    status: "pending",
    priority: "normal",
    assignedStaffId: typeof row.trainer_staff_id === "string" ? row.trainer_staff_id : null,
    completedAt: null,
    createdAt: typeof row.created_at === "string" ? row.created_at : String(row.scheduled_at),
  }
}

export function pickNextLeadAction(actions: LeadTask[]): LeadTask | null {
  return actions.reduce<LeadTask | null>((earliest, action) => {
    if (!earliest) return action
    const dueDelta = new Date(action.dueAt).getTime() - new Date(earliest.dueAt).getTime()
    if (dueDelta < 0) return action
    if (dueDelta > 0) return earliest
    if (action.origin !== earliest.origin) return action.origin === "task" ? action : earliest
    return action.id.localeCompare(earliest.id) < 0 ? action : earliest
  }, null)
}

export function normalizeLeadPage(requestedPage: number | undefined, total: number, pageSize: number): number {
  const safeRequestedPage = Number.isFinite(requestedPage)
    ? Math.max(0, Math.floor(requestedPage as number))
    : 0
  const safePageSize = Math.max(1, Math.floor(pageSize))
  const lastPage = total > 0 ? Math.ceil(total / safePageSize) - 1 : 0
  return Math.min(safeRequestedPage, lastPage)
}

function mapLead(
  raw: RawLead,
  stageById: Map<string, LeadStageOption>,
  sourceById: Map<string, LeadSourceOption>,
  staffById: Map<string, LeadStaffOption>,
  nextActionByLead: Map<string, LeadTask>,
): LeadRow {
  const stage = stageById.get(raw.stage_id) ?? {
    id: raw.stage_id,
    key: "new" as const,
    name: "Этап не найден",
    kind: raw.state,
    position: 0,
    tone: "neutral" as const,
  }
  const source = sourceById.get(raw.source_id) ?? {
    id: raw.source_id,
    key: "other",
    name: "Другое",
    category: "other",
  }
  return {
    id: raw.id,
    leadNo: Number(raw.lead_no),
    name: raw.full_name,
    phone: raw.phone,
    email: raw.email,
    telegramUsername: raw.telegram_username,
    stage,
    state: raw.state,
    source,
    priority: raw.priority,
    assigneeId: raw.assigned_staff_id,
    assigneeName: raw.assigned_staff_id ? staffById.get(raw.assigned_staff_id)?.name ?? "Сотрудник неактивен" : null,
    interest: raw.interest,
    estimatedValue: Number(raw.estimated_value ?? 0),
    currency: raw.currency,
    firstResponseDueAt: raw.first_response_due_at,
    firstResponseAt: raw.first_response_at,
    lastActivityAt: raw.last_activity_at,
    nextAction: nextActionByLead.get(raw.id) ?? null,
    convertedClientId: raw.converted_client_id,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    version: Number(raw.version),
  }
}

async function getLeadLookups(clubId: string, currentUserId: string) {
  const service = createServiceClient()
  const [stagesResult, sourcesResult, reasonsResult, staffResult] = await Promise.all([
    service.from("lead_pipeline_stages").select("id,key,name,kind,position,tone").eq("club_id", clubId).eq("is_active", true).order("position"),
    service.from("lead_sources").select("id,key,name,category").eq("club_id", clubId).eq("is_active", true).order("position"),
    service.from("lead_loss_reasons").select("id,key,name").eq("club_id", clubId).eq("is_active", true).order("position"),
    service.from("staff").select("id,user_id,role").eq("club_id", clubId).eq("is_active", true).order("created_at"),
  ])
  const lookupError = [stagesResult.error, sourcesResult.error, reasonsResult.error, staffResult.error].find(Boolean)
  if (lookupError) throw new Error(`Не удалось загрузить справочники лидов: ${lookupError.message}`)

  const staffRows = (staffResult.data ?? []) as Array<{ id: string; user_id: string; role: string }>
  const userIds = staffRows.map((row) => row.user_id)
  const usersResult = userIds.length
    ? await service.from("users").select("id,full_name,email").in("id", userIds)
    : { data: [] }
  if ("error" in usersResult && usersResult.error) {
    throw new Error(`Не удалось загрузить сотрудников Lead Hub: ${usersResult.error.message}`)
  }
  const userById = new Map(
    ((usersResult.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((row) => [row.id, row]),
  )

  const stages = (stagesResult.data ?? []).map((row) => ({
    id: row.id,
    key: row.key as LeadStageKey,
    name: row.name,
    kind: row.kind as LeadState,
    position: Number(row.position),
    tone: row.tone as LeadStageOption["tone"],
  }))
  const sources = (sourcesResult.data ?? []).map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    category: row.category,
  }))
  const lossReasons = (reasonsResult.data ?? []).map((row) => ({ id: row.id, key: row.key, name: row.name }))
  const staff = staffRows.map((row) => {
    const user = userById.get(row.user_id)
    return { id: row.id, name: user?.full_name || user?.email || "Сотрудник", role: row.role }
  })

  return {
    stages,
    sources,
    lossReasons,
    staff,
    currentStaffId: staffRows.find((row) => row.user_id === currentUserId)?.id ?? null,
  }
}

async function getLeadSummary(clubId: string, timezone: string, trialBookedStageId: string): Promise<LeadSummary> {
  const service = createServiceClient()
  const now = new Date()
  let today: ReturnType<typeof zonedDayRange>
  try {
    today = zonedDayRange(now, timezone)
  } catch {
    today = zonedDayRange(now, "Asia/Tashkent")
  }
  const inSevenDays = new Date(now.getTime() + 7 * 86_400_000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString()
  const nowIso = now.toISOString()

  const [newToday, needsAction, trials, created, converted] = await Promise.all([
    service.from("leads").select("id", { count: "exact", head: true }).eq("club_id", clubId).is("archived_at", null).gte("created_at", today.from).lt("created_at", today.to),
    service.from("leads").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("state", "open").is("archived_at", null).or(`and(first_response_at.is.null,first_response_due_at.lte.${nowIso}),next_action_at.lte.${nowIso}`),
    service.from("leads").select("id,lead_trials!inner(id)", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("stage_id", trialBookedStageId)
      .eq("state", "open")
      .is("archived_at", null)
      .eq("lead_trials.status", "scheduled")
      .gte("lead_trials.scheduled_at", nowIso)
      .lt("lead_trials.scheduled_at", inSevenDays),
    service.from("leads").select("id", { count: "exact", head: true }).eq("club_id", clubId).gte("created_at", thirtyDaysAgo),
    service.from("leads").select("id", { count: "exact", head: true }).eq("club_id", clubId).gte("created_at", thirtyDaysAgo).not("converted_at", "is", null),
  ])
  const summaryError = [newToday.error, needsAction.error, trials.error, created.error, converted.error].find(Boolean)
  if (summaryError) throw new Error(`Не удалось рассчитать показатели лидов: ${summaryError.message}`)

  const created30Days = created.count ?? 0
  const converted30Days = converted.count ?? 0
  return {
    newToday: newToday.count ?? 0,
    needsAction: needsAction.count ?? 0,
    trialsNext7Days: trials.count ?? 0,
    converted30Days,
    created30Days,
    conversionRate30Days: created30Days > 0 ? Math.round((converted30Days / created30Days) * 100) : 0,
  }
}

async function getLeadDetail(
  clubId: string,
  leadId: string,
  stageById: Map<string, LeadStageOption>,
  sourceById: Map<string, LeadSourceOption>,
  staffById: Map<string, LeadStaffOption>,
): Promise<LeadDetail | null> {
  const service = createServiceClient()
  const [leadResult, tasksResult, activitiesResult, trialsResult] = await Promise.all([
    service.from("leads").select(LEAD_DETAIL_COLUMNS).eq("club_id", clubId).eq("id", leadId).maybeSingle(),
    service.from("lead_tasks").select("id,type,title,note,due_at,status,priority,assigned_staff_id,completed_at,created_at").eq("club_id", clubId).eq("lead_id", leadId).order("created_at", { ascending: false }).limit(50),
    service.from("lead_activities").select("id,kind,channel,direction,outcome,body,occurred_at,created_by_staff_id").eq("club_id", clubId).eq("lead_id", leadId).order("occurred_at", { ascending: false }).limit(100),
    service.from("lead_trials").select("id,title,scheduled_at,duration_minutes,status,trainer_staff_id,notes,attended_at,created_at").eq("club_id", clubId).eq("lead_id", leadId).order("scheduled_at", { ascending: false }).limit(30),
  ])
  const detailError = [leadResult.error, tasksResult.error, activitiesResult.error, trialsResult.error].find(Boolean)
  if (detailError) throw new Error(`Не удалось загрузить карточку лида: ${detailError.message}`)
  if (!leadResult.data) return null

  const tasks = (tasksResult.data ?? []).map((row) => mapTask(row as Record<string, unknown>))
  const trials = (trialsResult.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    scheduledAt: row.scheduled_at,
    durationMinutes: Number(row.duration_minutes),
    status: row.status as LeadTrialStatus,
    trainerStaffId: row.trainer_staff_id,
    trainerName: row.trainer_staff_id ? staffById.get(row.trainer_staff_id)?.name ?? "Сотрудник неактивен" : null,
    notes: row.notes,
    attendedAt: row.attended_at,
  }))
  const nextAction = pickNextLeadAction([
    ...tasks.filter((task) => task.status === "pending"),
    ...(trialsResult.data ?? [])
      .filter((trial) => trial.status === "scheduled")
      .map((trial) => mapTrialAsNextAction(trial as Record<string, unknown>)),
  ])
  const nextActionByLead = new Map<string, LeadTask>()
  if (nextAction) nextActionByLead.set(leadId, nextAction)
  const raw = leadResult.data as unknown as RawLead
  const base = mapLead(raw, stageById, sourceById, staffById, nextActionByLead)

  return {
    ...base,
    notes: raw.notes ?? null,
    tags: raw.tags ?? [],
    sourceDetail: raw.source_detail ?? null,
    preferredChannel: raw.preferred_channel ?? null,
    lossReasonId: raw.loss_reason_id ?? null,
    lossNote: raw.loss_note ?? null,
    convertedAt: raw.converted_at ?? null,
    archivedAt: raw.archived_at ?? null,
    tasks,
    activities: (activitiesResult.data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      channel: row.channel,
      direction: row.direction,
      outcome: row.outcome,
      body: row.body,
      occurredAt: row.occurred_at,
      actorName: row.created_by_staff_id ? staffById.get(row.created_by_staff_id)?.name ?? "Сотрудник неактивен" : null,
    })),
    trials,
  }
}

export async function getLeadHubData(
  clubId: string,
  currentUserId: string,
  timezone: string,
  query: LeadsQuery,
  selectedLeadId?: string,
): Promise<LeadHubData> {
  const service = createServiceClient()
  const pageSize = Math.min(100, Math.max(1, Math.floor(query.pageSize ?? LEADS_PAGE_SIZE)))
  const requestedPage = normalizeLeadPage(query.page, Number.MAX_SAFE_INTEGER, pageSize)
  const lookups = await getLeadLookups(clubId, currentUserId)
  const stageById = new Map(lookups.stages.map((stage) => [stage.id, stage]))
  const stageByKey = new Map(lookups.stages.map((stage) => [stage.key, stage]))
  const sourceById = new Map(lookups.sources.map((source) => [source.id, source]))
  const sourceByKey = new Map(lookups.sources.map((source) => [source.key, source]))
  const staffById = new Map(lookups.staff.map((staff) => [staff.id, staff]))
  const trialBookedStage = stageByKey.get("trial_booked")
  if (!trialBookedStage) throw new Error("Не найден системный этап «Пробное назначено»")

  function buildLeadListQuery() {
    let listQuery = service
      .from("leads")
      .select(LEAD_LIST_COLUMNS, { count: "exact" })
      .eq("club_id", clubId)
      .is("archived_at", null)

    const state = query.state ?? "open"
    if (state !== "all") listQuery = listQuery.eq("state", state)
    const search = sanitizeSearchTerm(query.search ?? "")
    if (search) listQuery = listQuery.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,telegram_username.ilike.%${search}%`)
    const stage = query.stage ? stageByKey.get(query.stage as LeadStageKey) : null
    if (stage) listQuery = listQuery.eq("stage_id", stage.id)
    const source = query.source ? sourceByKey.get(query.source) : null
    if (source) listQuery = listQuery.eq("source_id", source.id)
    if (query.assignee === "unassigned") listQuery = listQuery.is("assigned_staff_id", null)
    else if (query.assignee && staffById.has(query.assignee)) listQuery = listQuery.eq("assigned_staff_id", query.assignee)
    if (query.quick === "mine") {
      listQuery = lookups.currentStaffId
        ? listQuery.eq("assigned_staff_id", lookups.currentStaffId)
        : listQuery.eq("assigned_staff_id", "00000000-0000-0000-0000-000000000000")
    } else if (query.quick === "unassigned") {
      listQuery = listQuery.is("assigned_staff_id", null)
    } else if (query.quick === "overdue") {
      const now = new Date().toISOString()
      listQuery = listQuery.or(`and(first_response_at.is.null,first_response_due_at.lte.${now}),next_action_at.lte.${now}`)
    }

    switch (query.sort) {
      case "created_desc":
        return listQuery.order("created_at", { ascending: false }).order("id", { ascending: false })
      case "action_asc":
        return listQuery.order("next_action_at", { ascending: true, nullsFirst: false }).order("id")
      case "value_desc":
        return listQuery.order("estimated_value", { ascending: false }).order("id")
      default:
        return listQuery.order("updated_at", { ascending: false }).order("id", { ascending: false })
    }
  }

  const [initialPageResult, summary] = await Promise.all([
    buildLeadListQuery().range(requestedPage * pageSize, requestedPage * pageSize + pageSize - 1),
    getLeadSummary(clubId, timezone, trialBookedStage.id),
  ])
  if (initialPageResult.error) throw new Error(`Не удалось загрузить лиды: ${initialPageResult.error.message}`)

  const total = initialPageResult.count ?? 0
  const page = normalizeLeadPage(requestedPage, total, pageSize)
  let pageData = initialPageResult.data
  if (page !== requestedPage && total > 0) {
    const normalizedPageResult = await buildLeadListQuery().range(page * pageSize, page * pageSize + pageSize - 1)
    if (normalizedPageResult.error) {
      throw new Error(`Не удалось загрузить последнюю страницу лидов: ${normalizedPageResult.error.message}`)
    }
    pageData = normalizedPageResult.data
  }

  const rawRows = (pageData ?? []) as unknown as RawLead[]
  const leadIds = rawRows.map((row) => row.id)
  const [pendingTasksResult, scheduledTrialsResult] = leadIds.length
    ? await Promise.all([
      service.from("lead_tasks").select("id,lead_id,type,title,note,due_at,status,priority,assigned_staff_id,completed_at,created_at").eq("club_id", clubId).in("lead_id", leadIds).eq("status", "pending").order("due_at"),
      service.from("lead_trials").select("id,lead_id,title,notes,scheduled_at,status,trainer_staff_id,created_at").eq("club_id", clubId).in("lead_id", leadIds).eq("status", "scheduled").order("scheduled_at"),
    ])
    : [{ data: [], error: null }, { data: [], error: null }]
  const nextActionError = pendingTasksResult.error ?? scheduledTrialsResult.error
  if (nextActionError) throw new Error(`Не удалось загрузить следующие действия: ${nextActionError.message}`)

  const actionCandidatesByLead = new Map<string, LeadTask[]>()
  for (const row of (pendingTasksResult.data ?? []) as Array<Record<string, unknown> & { lead_id: string }>) {
    const actions = actionCandidatesByLead.get(row.lead_id) ?? []
    actions.push(mapTask(row))
    actionCandidatesByLead.set(row.lead_id, actions)
  }
  for (const row of (scheduledTrialsResult.data ?? []) as Array<Record<string, unknown> & { lead_id: string }>) {
    const actions = actionCandidatesByLead.get(row.lead_id) ?? []
    actions.push(mapTrialAsNextAction(row))
    actionCandidatesByLead.set(row.lead_id, actions)
  }
  const nextActionByLead = new Map<string, LeadTask>()
  for (const [leadId, actions] of actionCandidatesByLead) {
    const nextAction = pickNextLeadAction(actions)
    if (nextAction) nextActionByLead.set(leadId, nextAction)
  }

  const selected = selectedLeadId
    ? await getLeadDetail(clubId, selectedLeadId, stageById, sourceById, staffById)
    : null

  return {
    rows: rawRows.map((row) => mapLead(row, stageById, sourceById, staffById, nextActionByLead)),
    total,
    page,
    pageSize,
    summary,
    stages: lookups.stages,
    sources: lookups.sources,
    lossReasons: lookups.lossReasons,
    staff: lookups.staff,
    currentStaffId: lookups.currentStaffId,
    selected,
  }
}

export function normalizeLeadPhone(value: string): string {
  const digits = value.replace(/\D/g, "")
  if (digits.length === 12 && digits.startsWith("998")) return digits.slice(-9)
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) return digits.slice(-10)
  return digits
}

export function canMoveLeadStage(from: LeadStageKey, to: LeadStageKey): boolean {
  if (from === to || from === "won") return false
  if (to === "won") return false
  if (from === "lost") return ["contacted", "qualified"].includes(to)
  return true
}
