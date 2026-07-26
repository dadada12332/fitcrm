"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { Activity, CreditCard, Plus, UserCog, Users, Wallet } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { QuickActionView } from "./QuickActionsDrawer"
import { useAppLocale } from "./ClubContext"
import type { AppMessageKey } from "@/lib/app-locale"

const QuickActionsPanel = dynamic(
  () => import("./QuickActionsDrawer").then((module) => module.QuickActionsPanel),
  { ssr: false },
)

const ACTIONS: { view: QuickActionView; icon: React.ElementType; label: AppMessageKey; desc: AppMessageKey }[] = [
  { view: "client", icon: Users, label: "quick.client", desc: "quick.clientDesc" },
  { view: "payment", icon: Wallet, label: "quick.payment", desc: "quick.paymentDesc" },
  { view: "membership", icon: CreditCard, label: "quick.membership", desc: "quick.membershipDesc" },
  { view: "visit", icon: Activity, label: "quick.visit", desc: "quick.visitDesc" },
  { view: "staff", icon: UserCog, label: "quick.staff", desc: "quick.staffDesc" },
]

export function QuickActionsMenu({ collapsed }: { collapsed?: boolean }) {
  const { t } = useAppLocale()
  const [view, setView] = useState<QuickActionView | null>(null)

  return (
    <>
      <div className="px-2 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("quick.title")}
            title={collapsed ? t("quick.title") : undefined}
            className="flex h-8 w-full items-center justify-center gap-2 rounded-md bg-primary text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {!collapsed && t("quick.title")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="w-[min(320px,calc(100vw-2rem))] rounded-lg p-1.5">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-1.5">{t("quick.title")}</DropdownMenuLabel>
              {ACTIONS.map(({ view: actionView, icon: Icon, label, desc }) => (
                <DropdownMenuItem key={actionView} onClick={() => setView(actionView)} className="items-center gap-3 px-2 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{t(label)}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{t(desc)}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {view && <QuickActionsPanel view={view} onClose={() => setView(null)} />}
    </>
  )
}
