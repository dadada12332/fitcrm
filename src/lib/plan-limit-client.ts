"use client"

import { toast } from "sonner"
import { parsePlanLimitError, type PlanLimitDetails } from "@/lib/plan-limits"

export const PLAN_LIMIT_EVENT = "fitcrm:plan-limit"

export function dispatchPlanLimitError(message: string): boolean {
  const details = parsePlanLimitError(message)
  if (!details || typeof window === "undefined") return false
  window.dispatchEvent(new CustomEvent<PlanLimitDetails>(PLAN_LIMIT_EVENT, { detail: details }))
  return true
}

export function showActionError(message: string): void {
  if (!dispatchPlanLimitError(message)) toast.error(message)
}
