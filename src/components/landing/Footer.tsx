import Link from "next/link"
import { Zap, Send, Mail, Globe } from "lucide-react"

const columns = [
  {
    title: "Продукт",
    links: [
      { label: "Клиенты и абонементы", href: "#features" },
      { label: "Оплаты", href: "#capabilities" },
      { label: "Расписание", href: "#features" },
      { label: "Telegram-бот", href: "#capabilities" },
    ],
  },
  {
    title: "Возможности",
    links: [
      { label: "QR-чекин", href: "#capabilities" },
      { label: "Аналитика", href: "#capabilities" },
      { label: "Интеграции", href: "#features" },
      { label: "Безопасность", href: "#capabilities" },
    ],
  },
  {
    title: "Применение",
    links: [
      { label: "Удержание", href: "#usecases" },
      { label: "Оплаты", href: "#usecases" },
      { label: "Ресепшн", href: "#usecases" },
      { label: "Аналитика", href: "#usecases" },
    ],
  },
  {
    title: "Компания",
    links: [
      { label: "О нас", href: "/about" },
      { label: "Контакты", href: "/contact" },
      { label: "Тарифы", href: "#pricing" },
      { label: "Конфиденциальность", href: "/privacy" },
    ],
  },
]

const socials = [
  { icon: Send, href: "https://t.me/fitcrm_uz" },
  { icon: Mail, href: "mailto:info@fitcrm.uz" },
  { icon: Globe, href: "#" },
]

export function Footer() {
  return (
    <footer className="px-4 pb-12 pt-20" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr] gap-10">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-strong)" }}>
                <Zap className="w-4 h-4 text-white" fill="white" />
              </span>
              <span className="text-lg font-semibold text-white">FitCRM</span>
            </div>
            <p className="text-sm text-white/50 leading-relaxed max-w-xs">
              CRM-система для фитнес-клубов Узбекистана. Управляйте клиентами, оплатами и расписанием умнее.
            </p>
            <div className="flex items-center gap-3 mt-5">
              {socials.map((s, i) => (
                <Link key={i} href={s.href} className="w-9 h-9 rounded-lg flex items-center justify-center sol-chip text-white/60 hover:text-white transition-colors">
                  <s.icon className="w-4 h-4" />
                </Link>
              ))}
            </div>
          </div>

          {/* Columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm text-white/50 mb-4">{col.title}</h4>
              <ul className="flex flex-col gap-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-white/75 hover:text-white transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-6 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs text-white/40">© 2026 FitCRM · Ташкент, Узбекистан</p>
        </div>
      </div>
    </footer>
  )
}
