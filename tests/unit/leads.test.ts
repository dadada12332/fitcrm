import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  LEAD_STAGE_LABELS,
  canMoveLeadStage,
  normalizeLeadPage,
  normalizeLeadPhone,
  pickNextLeadAction,
  type LeadTask,
  type LeadStageKey,
} from "../../src/lib/leads"

function leadAction(overrides: Partial<LeadTask>): LeadTask {
  return {
    id: "action-1",
    origin: "task",
    type: "call",
    title: "Позвонить",
    note: null,
    dueAt: "2026-08-06T09:00:00.000Z",
    status: "pending",
    priority: "normal",
    assignedStaffId: null,
    completedAt: null,
    createdAt: "2026-08-05T09:00:00.000Z",
    ...overrides,
  }
}

describe("Lead Hub domain", () => {
  it.each([
    ["+998 90 123-45-67", "901234567"],
    ["998901234567", "901234567"],
    ["8 (999) 123-45-67", "9991234567"],
    ["+7 999 123-45-67", "9991234567"],
    ["90 123 45 67", "901234567"],
  ])("normalizes %s consistently with the client identity schema", (input, expected) => {
    expect(normalizeLeadPhone(input)).toBe(expected)
  })

  it("keeps terminal conversion immutable and loss recoverable", () => {
    expect(canMoveLeadStage("won", "contacted")).toBe(false)
    expect(canMoveLeadStage("qualified", "won")).toBe(false)
    expect(canMoveLeadStage("lost", "contacted")).toBe(true)
    expect(canMoveLeadStage("lost", "qualified")).toBe(true)
    expect(canMoveLeadStage("lost", "new")).toBe(false)
  })

  it("has a visible label for every canonical stage", () => {
    const stages: LeadStageKey[] = [
      "new", "contacted", "qualified", "trial_booked",
      "trial_completed", "offer", "won", "lost",
    ]
    expect(stages.every((stage) => LEAD_STAGE_LABELS[stage].length > 0)).toBe(true)
  })

  it("uses the earliest pending task or scheduled trial as the next action", () => {
    const task = leadAction({ id: "task", dueAt: "2026-08-06T10:00:00.000Z" })
    const trial = leadAction({
      id: "trial",
      origin: "trial",
      type: "trial",
      title: "Пробная тренировка",
      dueAt: "2026-08-06T09:00:00.000Z",
    })

    expect(pickNextLeadAction([task, trial])).toEqual(trial)
    expect(pickNextLeadAction([])).toBeNull()
  })

  it("prefers a real task when a task and trial share the same due time", () => {
    const dueAt = "2026-08-06T09:00:00.000Z"
    const task = leadAction({ id: "task", dueAt })
    const trial = leadAction({ id: "trial", origin: "trial", type: "trial", dueAt })

    expect(pickNextLeadAction([trial, task])?.origin).toBe("task")
  })

  it.each([
    [undefined, 120, 50, 0],
    [-5, 120, 50, 0],
    [1.9, 120, 50, 1],
    [99, 120, 50, 2],
    [4, 0, 50, 0],
    [Number.NaN, 120, 50, 0],
  ])("normalizes page %s against %s rows", (requested, total, pageSize, expected) => {
    expect(normalizeLeadPage(requested, total, pageSize)).toBe(expected)
  })

  it("keeps pagination retries and distinct trial-lead KPI semantics in the data query", () => {
    const source = readFileSync(new URL("../../src/lib/leads.ts", import.meta.url), "utf8")
    expect(source.match(/buildLeadListQuery\(\)\.range/g)?.length).toBeGreaterThanOrEqual(2)
    expect(source).toContain("if (page !== requestedPage && total > 0)")
    expect(source).toContain('.from("leads").select("id,lead_trials!inner(id)", { count: "exact", head: true })')
    expect(source).toContain('.eq("stage_id", trialBookedStageId)')
  })
})
