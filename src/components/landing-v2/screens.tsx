"use client"

import {
  LayoutDashboard, Users, CreditCard, BarChart3, Send,
  Search, TrendingUp, Wallet, Check,
} from "lucide-react"

/* Компактные светлые мокапы реальных экранов FitCRM для showcase-ленты v2.
   Всё на нашей дизайн-системе (белый + zinc + синий акцент). */

function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full h-full flex flex-col bg-white text-left overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 h-7 flex-shrink-0 border-b border-zinc-100">
        <span className="w-2 h-2 rounded-full bg-zinc-300" />
        <span className="w-2 h-2 rounded-full bg-zinc-300" />
        <span className="w-2 h-2 rounded-full bg-zinc-300" />
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  )
}

function MiniSidebar({ active }: { active: string }) {
  const items = [
    { icon: LayoutDashboard, label: "Дашборд" },
    { icon: Users, label: "Клиенты" },
    { icon: CreditCard, label: "Абонементы" },
    { icon: Wallet, label: "Платежи" },
    { icon: BarChart3, label: "Отчёты" },
  ]
  return (
    <aside className="w-[132px] flex-shrink-0 border-r border-zinc-100 p-2 flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 px-1.5 mb-2">
        <span className="w-4 h-4 rounded bg-blue-600" />
        <span className="text-[11px] font-semibold text-zinc-900">FitCRM</span>
      </div>
      {items.map((it) => (
        <div key={it.label}
          className={`flex items-center gap-1.5 h-6 px-1.5 rounded-md text-[10px] ${active === it.label ? "bg-zinc-100 text-zinc-900" : "text-zinc-400"}`}>
          <it.icon className="w-3 h-3" />
          {it.label}
        </div>
      ))}
    </aside>
  )
}

export function DashboardScreen() {
  const bars = [40, 62, 50, 74, 66, 88]
  return (
    <Chrome>
      <div className="flex h-full">
        <MiniSidebar active="Дашборд" />
        <div className="flex-1 min-w-0 p-3">
          <div className="text-[12px] font-semibold text-zinc-900 mb-2">Дашборд</div>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {[["Клиенты", "248"], ["Выручка", "42.4M"], ["Визиты", "63"]].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-zinc-100 p-1.5">
                <div className="text-[8px] text-zinc-400">{l}</div>
                <div className="text-[13px] font-bold text-zinc-900">{v}</div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-zinc-100 p-2">
            <div className="text-[9px] text-zinc-400 mb-1.5">Выручка за неделю</div>
            <div className="flex items-end gap-1 h-16">
              {bars.map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-blue-500/80" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Chrome>
  )
}

export function ClientsScreen() {
  const rows = [
    ["Азиз Каримов", "Премиум", "Активен"],
    ["Дилноза Рахимова", "Стандарт", "Активен"],
    ["Тимур Маткаримов", "Годовой", "Активен"],
    ["Нигора Юсупова", "Стандарт", "Истекает"],
    ["Бекзод Тошматов", "Премиум", "Активен"],
  ]
  return (
    <Chrome>
      <div className="p-3 h-full">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[12px] font-semibold text-zinc-900">Клиенты</div>
          <div className="flex items-center gap-1 h-5 px-2 rounded-md border border-zinc-200 text-[9px] text-zinc-400">
            <Search className="w-2.5 h-2.5" /> Поиск
          </div>
        </div>
        <div className="grid grid-cols-[1.4fr_1fr_0.8fr] text-[8px] text-zinc-400 pb-1 border-b border-zinc-100">
          <span>Клиент</span><span>Абонемент</span><span>Статус</span>
        </div>
        {rows.map((r) => (
          <div key={r[0]} className="grid grid-cols-[1.4fr_1fr_0.8fr] items-center text-[9px] py-1.5 border-b border-zinc-50">
            <span className="flex items-center gap-1 text-zinc-800 truncate">
              <span className="w-3.5 h-3.5 rounded-full bg-blue-100 flex-shrink-0" />
              <span className="truncate">{r[0]}</span>
            </span>
            <span className="text-zinc-500">{r[1]}</span>
            <span className={r[2] === "Истекает" ? "text-amber-600" : "text-green-600"}>{r[2]}</span>
          </div>
        ))}
      </div>
    </Chrome>
  )
}

export function PaymentsScreen() {
  const pays = [
    ["Азиз Каримов", "450 000", "Оплачено"],
    ["Дилноза Рахимова", "300 000", "Оплачено"],
    ["Нигора Юсупова", "180 000", "Ожидает"],
    ["Бекзод Тошматов", "790 000", "Оплачено"],
  ]
  return (
    <Chrome>
      <div className="p-3 h-full">
        <div className="text-[12px] font-semibold text-zinc-900 mb-2">Платежи</div>
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          <div className="rounded-lg border border-zinc-100 p-1.5">
            <div className="text-[8px] text-zinc-400">За месяц</div>
            <div className="text-[13px] font-bold text-zinc-900">42.4M сум</div>
          </div>
          <div className="rounded-lg border border-zinc-100 p-1.5">
            <div className="text-[8px] text-zinc-400">Ожидает</div>
            <div className="text-[13px] font-bold text-amber-600">1.2M сум</div>
          </div>
        </div>
        {pays.map((p) => (
          <div key={p[0]} className="flex items-center justify-between text-[9px] py-1.5 border-b border-zinc-50">
            <span className="flex items-center gap-1 text-zinc-800">
              <Wallet className="w-2.5 h-2.5 text-zinc-400" />{p[0]}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-semibold text-zinc-900">{p[1]}</span>
              <span className={`px-1 py-0.5 rounded ${p[2] === "Ожидает" ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"}`}>{p[2]}</span>
            </span>
          </div>
        ))}
      </div>
    </Chrome>
  )
}

export function ReportsScreen() {
  const pts = [30, 45, 40, 58, 52, 70, 64, 82]
  const w = 220, h = 70, step = w / (pts.length - 1)
  const line = pts.map((p, i) => `${i * step},${h - (p / 100) * h}`).join(" ")
  return (
    <Chrome>
      <div className="p-3 h-full">
        <div className="text-[12px] font-semibold text-zinc-900 mb-2">Отчёты</div>
        <div className="flex gap-1.5 mb-2">
          {["Выручка", "Прибыль", "Средний чек"].map((l, i) => (
            <div key={l} className="flex-1 rounded-lg border border-zinc-100 p-1.5">
              <div className="text-[8px] text-zinc-400">{l}</div>
              <div className="text-[11px] font-bold text-zinc-900">{["42.4M", "29.7M", "160K"][i]}</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-zinc-100 p-2">
          <div className="flex items-center gap-1 text-[9px] text-green-600 mb-1"><TrendingUp className="w-2.5 h-2.5" /> +23% за квартал</div>
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 56 }} preserveAspectRatio="none">
            <polygon points={`0,${h} ${line} ${w},${h}`} fill="rgba(37,99,235,0.12)" />
            <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="2" />
          </svg>
        </div>
      </div>
    </Chrome>
  )
}

export function TelegramScreen() {
  return (
    <Chrome>
      <div className="p-3 h-full flex flex-col">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#2AABEE" }}>
            <Send className="w-2.5 h-2.5 text-white" />
          </span>
          <span className="text-[12px] font-semibold text-zinc-900">Telegram-бот</span>
        </div>
        <div className="flex-1 rounded-lg p-2 flex flex-col gap-1.5" style={{ background: "#e9edf2" }}>
          <div className="self-start max-w-[80%] rounded-lg rounded-tl-sm bg-white px-2 py-1 text-[9px] text-zinc-700 shadow-sm">
            Здравствуйте! Ваш абонешь истекает через 3 дня 💪
          </div>
          <div className="self-end max-w-[80%] rounded-lg rounded-tr-sm px-2 py-1 text-[9px] text-white" style={{ background: "#2AABEE" }}>
            Продлить абонемент
          </div>
          <div className="self-start max-w-[80%] rounded-lg rounded-tl-sm bg-white px-2 py-1 text-[9px] text-zinc-700 shadow-sm flex items-center gap-1">
            <Check className="w-2.5 h-2.5 text-green-600" /> Оплата принята — до 12.09
          </div>
        </div>
      </div>
    </Chrome>
  )
}
