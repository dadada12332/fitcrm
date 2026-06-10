"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Calendar,
  CheckSquare,
  Wallet,
  Package,
  UserCheck,
  BarChart2,
  Settings,
  HelpCircle,
  ChevronsUpDown,
  Zap,
  X,
} from "lucide-react"
import { useState } from "react"
import { signOut } from "@/app/(auth)/actions"

const mainNav = [
  { href: "/dashboard",   label: "Дашборд",    icon: LayoutDashboard },
  { href: "/clients",     label: "Клиенты",    icon: Users },
  { href: "/memberships", label: "Абонементы", icon: CreditCard },
  { href: "/schedule",    label: "Расписание", icon: Calendar },
  { href: "/visits",      label: "Посещения",  icon: CheckSquare },
  { href: "/payments",    label: "Платежи",    icon: Wallet },
]

const otherNav = [
  { href: "/inventory", label: "Склад",      icon: Package },
  { href: "/staff",     label: "Сотрудники", icon: UserCheck },
  { href: "/reports",   label: "Отчеты",     icon: BarChart2 },
]

const bottomNav = [
  { href: "/settings", label: "Настройки", icon: Settings },
  { href: "/support",  label: "Поддержка", icon: HelpCircle },
]

type Props = {
  email: string
  collapsed?: boolean
  mobile?: boolean
  onClose?: () => void
}

function Tooltip({ label, show, children }: { label: string; show: boolean; children: React.ReactNode }) {
  if (!show) return <>{children}</>
  return (
    <div className="relative group/tip">
      {children}
      <div
        className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap pointer-events-none z-[200]
          opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150"
        style={{ background: "#0c111d", color: "white", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
      >
        {label}
        <span
          className="absolute right-full top-1/2 -translate-y-1/2"
          style={{ borderWidth: 5, borderStyle: "solid", borderColor: "transparent #0c111d transparent transparent" }}
        />
      </div>
    </div>
  )
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onClick,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  collapsed: boolean
  onClick?: () => void
}) {
  return (
    <Tooltip label={label} show={collapsed}>
      <Link
        href={href}
        onClick={onClick}
        className={`flex items-center h-8 rounded-md text-base transition-colors w-full ${
          collapsed ? "justify-center px-0" : "gap-2 px-2"
        }`}
        style={{
          background: active ? "rgba(0,0,0,0.07)" : "transparent",
          color: active ? "#09090b" : "#3f3f46",
          fontWeight: active ? 500 : 400,
        }}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        {!collapsed && <span className="truncate leading-5">{label}</span>}
      </Link>
    </Tooltip>
  )
}

export function AppSidebar({ email, collapsed = false, mobile = false, onClose }: Props) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const initials = email.charAt(0).toUpperCase()

  const width = collapsed && !mobile ? "w-14" : "w-[244px]"

  return (
    <aside
      className={`flex flex-col ${width} h-full flex-shrink-0 transition-all duration-200 overflow-hidden`}
      style={{ background: "white", borderRight: "1px solid #e5e7eb" }}
    >
      {/* Mobile header */}
      {mobile && (
        <div className="flex items-center justify-between px-3 h-[60px] flex-shrink-0" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#0c111d" }}
            >
              <Zap className="w-4 h-4 text-white" fill="white" />
            </div>
            <span className="text-sm font-medium" style={{ color: "#09090b" }}>fitCRM</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-zinc-100 transition-colors"
            style={{ color: "#71717a" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Меню */}
        <div className={`pt-2 ${collapsed && !mobile ? "px-1" : "px-2"}`}>
          {!collapsed && (
            <div className="px-2 h-8 flex items-center">
              <span className="text-sm font-medium leading-4 tracking-[-0.072px]" style={{ color: "#3f3f46", opacity: 0.7 }}>
                Меню
              </span>
            </div>
          )}
          <div className="flex flex-col gap-1">
            {mainNav.map(({ href, label, icon }) => (
              <NavItem
                key={href}
                href={href}
                label={label}
                icon={icon}
                active={pathname === href}
                collapsed={collapsed && !mobile}
                onClick={onClose}
              />
            ))}
          </div>
        </div>

        {/* Другое */}
        <div className={`pt-3 ${collapsed && !mobile ? "px-1" : "px-2"}`}>
          {!collapsed && (
            <div className="px-2 h-8 flex items-center">
              <span className="text-sm font-medium leading-4 tracking-[-0.072px]" style={{ color: "#3f3f46", opacity: 0.7 }}>
                Другое
              </span>
            </div>
          )}
          <div className="flex flex-col gap-1">
            {otherNav.map(({ href, label, icon }) => (
              <NavItem
                key={href}
                href={href}
                label={label}
                icon={icon}
                active={pathname === href}
                collapsed={collapsed && !mobile}
                onClick={onClose}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div className={`py-2 flex-shrink-0 ${collapsed && !mobile ? "px-1" : "px-2"}`}>
        <div className="flex flex-col gap-1">
          {bottomNav.map(({ href, label, icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={pathname === href}
              collapsed={collapsed && !mobile}
              onClick={onClose}
            />
          ))}
        </div>
      </div>

      {/* Footer: user */}
      <div
        className={`flex-shrink-0 relative ${collapsed && !mobile ? "px-1 py-2" : "px-2 py-2"}`}
        style={{ borderTop: "1px solid #e5e7eb" }}
      >
        <Tooltip label={`${email.split("@")[0]} — ${email}`} show={collapsed && !mobile}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className={`w-full flex items-center h-12 rounded-md hover:bg-zinc-100 transition-colors ${
              collapsed && !mobile ? "justify-center px-0" : "gap-2 px-2"
            }`}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
              style={{ background: "#0c111d" }}
            >
              {initials}
            </div>
            {(!collapsed || mobile) && (
              <>
                <div className="flex flex-col min-w-0 flex-1 text-left">
                  <span className="text-sm font-semibold leading-none truncate tracking-[-0.084px]" style={{ color: "#09090b" }}>
                    {email.split("@")[0]}
                  </span>
                  <span className="text-xs font-normal leading-none truncate tracking-[-0.072px] mt-0.5" style={{ color: "#3f3f46" }}>
                    {email}
                  </span>
                </div>
                <ChevronsUpDown className="w-4 h-4 flex-shrink-0 text-zinc-400" />
              </>
            )}
          </button>
        </Tooltip>

        {profileOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
            <div
              className="absolute left-2 right-2 bottom-full mb-2 z-20 rounded-xl py-2 text-sm"
              style={{ background: "white", border: "1px solid #e5e7eb", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}
            >
              <div className="px-3 py-2 border-b border-zinc-100 mb-1">
                <p className="font-medium text-zinc-900 truncate">{email.split("@")[0]}</p>
                <p className="text-xs text-zinc-500 truncate">{email}</p>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  Выйти
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
