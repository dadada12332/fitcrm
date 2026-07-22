"use client"

import { createContext, useContext } from "react"
import type { RolePermissions } from "@/lib/permissions"
import type { PlanAccess } from "@/lib/plan-access"

export type ClubCtx = {
  clubId: string
  clubName: string
  role: string
  plan: string
  permissions: RolePermissions
  planAccess: PlanAccess | null
}

const ClubContext = createContext<ClubCtx | null>(null)

export function ClubProvider({ value, children }: { value: ClubCtx; children: React.ReactNode }) {
  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>
}

/** Access current club/role/permissions from any client component without server calls. */
export function useClub(): ClubCtx {
  const ctx = useContext(ClubContext)
  if (!ctx) throw new Error("useClub() must be used inside AppShell")
  return ctx
}
