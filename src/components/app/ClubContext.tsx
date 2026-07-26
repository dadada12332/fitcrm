"use client"

import { createContext, useCallback, useContext } from "react"
import type { RolePermissions } from "@/lib/permissions"
import type { PlanAccess } from "@/lib/plan-access"
import { formatClubMoney, translate, type AppLocale, type AppMessageKey } from "@/lib/app-locale"

export type ClubCtx = {
  clubId: string
  clubName: string
  role: string
  plan: string
  permissions: RolePermissions
  planAccess: PlanAccess | null
  locale: AppLocale
  currency: string
  timezone: string
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

export function useAppLocale() {
  const { locale, currency, timezone } = useClub()
  const t = useCallback(
    (key: AppMessageKey, values?: Record<string, string | number>) => translate(locale, key, values),
    [locale],
  )
  const money = useCallback(
    (amount: number) => formatClubMoney(amount, currency, locale),
    [currency, locale],
  )
  return {
    locale,
    currency,
    timezone,
    t,
    money,
  }
}
