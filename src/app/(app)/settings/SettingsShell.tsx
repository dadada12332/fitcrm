"use client"

import { useEffect, useState } from "react"
import {
  Building2, GitFork, Users, Wallet,
  Bell, Plug, ShieldCheck, Shield, Crown,
} from "lucide-react"
import { ClubSettings, type ClubData } from "@/components/app/ClubSettings"
import { RolesSettings } from "@/components/app/RolesSettings"
import { getRolesAction, type RoleRow } from "./roles/actions"

type TabKey = "club" | "branches" | "staff" | "finance" | "notifications" | "integrations" | "roles" | "security" | "subscription"

type AllowedTabs = Partial<Record<TabKey, boolean>>

const ALL_TABS: { key: TabKey; label: string; icon: typeof Building2 }[] = [
  { key: "club",          label: "Основное",      icon: Building2   },
  { key: "branches",      label: "Филиалы",       icon: GitFork     },
  { key: "staff",         label: "Сотрудники",    icon: Users       },
  { key: "finance",       label: "Финансы",       icon: Wallet      },
  { key: "notifications", label: "Уведомления",   icon: Bell        },
  { key: "integrations",  label: "Интеграции",    icon: Plug        },
  { key: "roles",         label: "Роли и права",  icon: ShieldCheck },
  { key: "security",      label: "Безопасность",  icon: Shield      },
  { key: "subscription",  label: "Подписка",      icon: Crown       },
]

// Maps settings tab key → ClubSettings section prop
const SECTION_MAP: Record<string, "basic" | "branches" | "staff" | "finance" | "notifications" | "integrations" | "security" | "plan"> = {
  club:          "basic",
  branches:      "branches",
  staff:         "staff",
  finance:       "finance",
  notifications: "notifications",
  integrations:  "integrations",
  security:      "security",
  subscription:  "plan",
}

export function SettingsShell({
  data,
  allowedTabs,
  isOwner,
  initialTab = "club",
  initialAssignStaffId,
  initialAssignStaffName,
  initialRoles,
  initialRolesError,
}: {
  data: ClubData
  allowedTabs: AllowedTabs
  isOwner: boolean
  initialTab?: string
  initialAssignStaffId?: string
  initialAssignStaffName?: string
  initialRoles?: RoleRow[]
  initialRolesError?: string
}) {
  const visibleTabs = ALL_TABS.filter(t => allowedTabs[t.key] !== false)

  // Resolve initial tab (might come from redirect with ?tab=X)
  const defaultTab = visibleTabs.find(t => t.key === initialTab)?.key ?? visibleTabs[0]?.key ?? "club"
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab as TabKey)

  // Roles data loaded lazily on first click
  const [roles, setRoles] = useState<RoleRow[] | null>(initialRoles ?? null)
  const [rolesLoading, setRolesLoading] = useState(false)
  const [rolesError, setRolesError] = useState<string | null>(initialRolesError ?? null)
  const [rolesRetry, setRolesRetry] = useState(0)
  const [assignStaffId] = useState(initialAssignStaffId)
  const [assignStaffName] = useState(initialAssignStaffName)

  useEffect(() => {
    if (activeTab !== "roles" || roles !== null || rolesError) return

    let cancelled = false
    getRolesAction()
      .then(({ roles: loadedRoles, error }) => {
        if (cancelled) return
        if (error) setRolesError(error)
        else setRoles(loadedRoles)
      })
      .catch(() => {
        if (!cancelled) setRolesError("Не удалось загрузить роли. Повторите попытку.")
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false)
      })

    return () => { cancelled = true }
  }, [activeTab, roles, rolesError, rolesRetry])

  function handleTabChange(tab: TabKey) {
    if (tab === "roles" && roles === null && !rolesError) setRolesLoading(true)
    setActiveTab(tab)
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky tabs header */}
      <div
        className="sticky top-0 z-10 -mx-4 lg:-mx-5 px-4 lg:px-5"
        style={{ background: "var(--bg, #fafafa)", borderBottom: "1px solid var(--border)" }}
      >
        <nav className="flex items-end overflow-x-auto" style={{ gap: 0, scrollbarWidth: "none" }}>
          {visibleTabs.map(({ key, label, icon: Icon }) => {
            const active = activeTab === key
            return (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                className="flex items-center gap-2 relative transition-colors flex-shrink-0 cursor-pointer"
                style={{
                  height: 44,
                  paddingLeft: 14,
                  paddingRight: 14,
                  fontSize: 14,
                  fontWeight: active ? 500 : 400,
                  color: active ? "#2563eb" : "var(--on-dark-soft)",
                  whiteSpace: "nowrap",
                  borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
                  marginBottom: -1,
                  background: "none",
                  border: "none",
                  borderBottomStyle: "solid",
                  borderBottomWidth: 2,
                  borderBottomColor: active ? "#2563eb" : "transparent",
                }}
              >
                <Icon style={{ width: 15, height: 15, color: active ? "#2563eb" : "var(--gray-muted)", flexShrink: 0 }} />
                {label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Content — instant switch, no server round-trip */}
      <div className="pt-6">
        {activeTab === "roles" ? (
          rolesLoading ? (
            <div className="flex flex-col gap-4 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
              ))}
            </div>
          ) : rolesError ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border text-center">
              <p className="text-sm text-muted-foreground">{rolesError}</p>
              <button
                type="button"
                onClick={() => {
                  setRolesLoading(true)
                  setRolesError(null)
                  setRolesRetry((value) => value + 1)
                }}
                className="text-sm font-medium text-primary"
              >
                Повторить
              </button>
            </div>
          ) : (
            <RolesSettings
              roles={roles ?? []}
              isOwner={isOwner}
              assignStaffId={assignStaffId}
              assignStaffName={assignStaffName}
            />
          )
        ) : (
          <ClubSettings club={data} section={SECTION_MAP[activeTab] ?? "basic"} />
        )}
      </div>
    </div>
  )
}
