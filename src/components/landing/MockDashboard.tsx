"use client"

import {
  LayoutDashboard, Users, CreditCard, CalendarDays, Wallet, BarChart3,
  Package, Plug, Search, Bell, Gift, Plus, Download, MoreHorizontal,
  TrendingUp, UserPlus, ChevronDown,
} from "lucide-react"

/* Мокап нашей реальной CRM (FitCRM) — статичное представление дашборда.
   Всё на тёмной палитре в окне браузера, как на референсе. */

const nav = [
  { icon: LayoutDashboard, label: "Дашборд", active: true },
  { icon: Users, label: "Клиенты" },
  { icon: CreditCard, label: "Абонементы" },
  { icon: CalendarDays, label: "Расписание" },
  { icon: Wallet, label: "Платежи" },
  { icon: BarChart3, label: "Отчёты" },
  { icon: Package, label: "Склад" },
  { icon: Plug, label: "Интеграции" },
]

const kpis = [
  { icon: Users, label: "Активные клиенты", value: "248" },
  { icon: CreditCard, label: "Выручка за месяц", value: "42.4M" },
  { icon: CalendarDays, label: "Истекает за 3 дня", value: "12" },
  { icon: TrendingUp, label: "Посещений сегодня", value: "63" },
]

const rows = [
  { name: "Азиз Каримов", plan: "Премиум", status: "Активен" },
  { name: "Дилноза Рахимова", plan: "Стандарт", status: "Активен" },
  { name: "Тимур Маткаримов", plan: "Годовой", status: "Активен" },
  { name: "Нигора Юсупова", plan: "Стандарт", status: "Истекает" },
  { name: "Бекзод Тошматов", plan: "Премиум", status: "Активен" },
  { name: "Малика Собирова", plan: "Разовый", status: "Активен" },
]

const pays = [
  { id: "#2026-11-025", amount: "450 000", status: "Оплачено", tone: "#22c55e" },
  { id: "#2026-11-018", amount: "300 000", status: "Ожидает", tone: "#f59e0b" },
  { id: "#2026-11-012", amount: "180 000", status: "Оплачено", tone: "#22c55e" },
  { id: "#2026-11-004", amount: "790 000", status: "Оплачено", tone: "#22c55e" },
]

const pts = [30, 42, 38, 55, 48, 66, 60, 74, 70, 82, 76, 90]

function AreaChart() {
  const w = 520, h = 150
  const step = w / (pts.length - 1)
  const max = 100
  const line = pts.map((p, i) => `${i * step},${h - (p / max) * h}`).join(" ")
  const area = `0,${h} ${line} ${w},${h}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: "100%" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#mg)" />
      <polyline points={line} fill="none" stroke="#3b82f6" strokeWidth="2" />
      <circle cx={8 * step} cy={h - (pts[8] / max) * h} r="4" fill="#3b82f6" stroke="#0d0d10" strokeWidth="2" />
    </svg>
  )
}

export function MockDashboard() {
  return (
    <div className="w-full h-full rounded-xl overflow-hidden flex flex-col text-left"
      style={{ background: "#0d0d10", border: "1px solid rgba(255,255,255,0.08)" }}>
      {/* Window bar */}
      <div className="flex items-center gap-2 px-3 h-8 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#febc2e" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="hidden sm:flex w-[168px] flex-shrink-0 flex-col py-3 px-2.5 gap-1"
          style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "#101013" }}>
          <div className="flex items-center gap-2 px-2 mb-3">
            <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "var(--accent-strong)" }}>
              <span className="w-2 h-2 rounded-[3px] bg-white" />
            </span>
            <span className="text-sm font-semibold text-white">FitCRM</span>
          </div>
          {nav.map((n) => (
            <div key={n.label}
              className="flex items-center gap-2 h-8 px-2 rounded-lg text-[12px]"
              style={n.active
                ? { background: "rgba(255,255,255,0.07)", color: "#fff" }
                : { color: "rgba(255,255,255,0.5)" }}>
              <n.icon className="w-3.5 h-3.5" />
              {n.label}
            </div>
          ))}
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Topbar */}
          <div className="flex items-center gap-3 px-4 h-11 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 h-7 px-3 rounded-lg flex-1 max-w-[280px]" style={{ background: "rgba(255,255,255,0.04)" }}>
              <Search className="w-3.5 h-3.5 text-white/40" />
              <span className="text-[11px] text-white/40">Поиск…</span>
            </div>
            <div className="flex items-center gap-2.5 ml-auto text-white/50">
              <Bell className="w-4 h-4" />
              <Gift className="w-4 h-4" />
              <div className="flex items-center gap-2 pl-2">
                <span className="w-6 h-6 rounded-full" style={{ background: "linear-gradient(135deg,#3b82f6,#60a5fa)" }} />
                <div className="hidden md:block leading-tight">
                  <div className="text-[11px] text-white">Айгуль Носирова</div>
                  <div className="text-[9px] text-white/40">Владелец</div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-hidden p-4 flex flex-col gap-3">
            {/* Greeting + actions */}
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-semibold text-white">С возвращением, Айгуль!</div>
              <div className="hidden md:flex items-center gap-2">
                <span className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] text-white/70 sol-chip">
                  <Plus className="w-3 h-3" /> Клиент
                </span>
                <span className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] text-white/70 sol-chip">
                  <Download className="w-3 h-3" /> Экспорт
                </span>
                <span className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] text-white btn-primary">
                  <UserPlus className="w-3 h-3" /> Продать абонемент
                </span>
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {kpis.map((k) => (
                <div key={k.label} className="sol-card p-3">
                  <div className="flex items-start justify-between">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center sol-chip">
                      <k.icon className="w-3.5 h-3.5 text-white/70" />
                    </span>
                    <MoreHorizontal className="w-3.5 h-3.5 text-white/30" />
                  </div>
                  <div className="text-[10px] text-white/45 mt-2">{k.label}</div>
                  <div className="text-lg font-semibold text-white leading-tight">{k.value}</div>
                </div>
              ))}
            </div>

            {/* Two panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 flex-1 min-h-0">
              {/* Sales */}
              <div className="sol-card p-3 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-medium text-white">Выручка</span>
                  <span className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] text-white/60 sol-chip">
                    Неделя <ChevronDown className="w-3 h-3" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-base font-semibold text-white">42 480 000</span>
                  <span className="text-[10px] font-medium" style={{ color: "#22c55e" }}>+5,3% ↑</span>
                </div>
                <div className="flex-1 min-h-[90px]"><AreaChart /></div>
                <div className="flex justify-between text-[9px] text-white/35 mt-1">
                  {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => <span key={d}>{d}</span>)}
                </div>
              </div>

              {/* Recent clients table */}
              <div className="sol-card p-3 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-medium text-white">Недавние клиенты</span>
                  <span className="text-[10px] text-white/40">Смотреть все</span>
                </div>
                <div className="grid grid-cols-[1.4fr_1fr_0.9fr] text-[9px] text-white/35 pb-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span>Клиент</span><span>Абонемент</span><span>Статус</span>
                </div>
                <div className="flex flex-col">
                  {rows.map((r) => (
                    <div key={r.name} className="grid grid-cols-[1.4fr_1fr_0.9fr] items-center text-[10px] py-1.5"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <span className="flex items-center gap-1.5 text-white/80 truncate">
                        <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: "rgba(59,130,246,0.5)" }} />
                        <span className="truncate">{r.name}</span>
                      </span>
                      <span className="text-white/50 truncate">{r.plan}</span>
                      <span style={{ color: r.status === "Истекает" ? "#f59e0b" : "#22c55e" }}>{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent payments */}
            <div className="sol-card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-medium text-white">Последние оплаты</span>
                <span className="text-[10px] text-white/40">Смотреть все</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {pays.map((p) => (
                  <div key={p.id} className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Wallet className="w-3 h-3 text-white/40" />
                      <span className="text-[9px] text-white/45">Оплата {p.id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-white">{p.amount}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: `${p.tone}22`, color: p.tone }}>{p.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
