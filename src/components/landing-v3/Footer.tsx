import Link from "next/link"
import { Zap, Send, Mail, Globe } from "lucide-react"

const columns = [
  { title: "Продукт", links: [["Возможности", "#features"], ["Продукт", "#product"], ["Цены", "#pricing"]] },
  { title: "Компания", links: [["О нас", "/about"], ["Контакты", "/contact"], ["Блог", "/blog"]] },
  { title: "Правовое", links: [["Конфиденциальность", "/privacy"], ["Условия", "/terms"]] },
]
const socials = [Send, Mail, Globe]

export function Footer() {
  return (
    <footer className="px-4 pb-12 pt-16" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] gap-10">
        <div className="col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center v3-btn">
              <Zap className="w-4 h-4 text-white" fill="white" />
            </span>
            <span className="text-lg font-semibold text-white">FitCRM</span>
          </div>
          <p className="text-sm text-white/50 max-w-xs leading-relaxed">
            CRM-система для фитнес-клубов Узбекистана. Управляйте бизнесом умнее.
          </p>
          <div className="flex items-center gap-3 mt-5">
            {socials.map((Icon, i) => (
              <span key={i} className="w-9 h-9 rounded-lg flex items-center justify-center v3-chip text-white/60">
                <Icon className="w-4 h-4" />
              </span>
            ))}
          </div>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="text-sm text-white/50 mb-4">{col.title}</h4>
            <ul className="flex flex-col gap-3">
              {col.links.map(([label, href]) => (
                <li key={label}><Link href={href} className="text-sm text-white/75 hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="max-w-6xl mx-auto mt-14 pt-6 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-xs text-white/40">© 2026 FitCRM · Ташкент, Узбекистан</p>
      </div>
    </footer>
  )
}
