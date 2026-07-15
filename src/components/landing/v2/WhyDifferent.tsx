"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Users, CreditCard, FileText, Hash, Wallet, Send, MessageCircle, QrCode, Camera, Bell } from "lucide-react"
import { useT } from "@/lib/i18n/context"

const panel = "relative rounded-[20px] h-[360px] overflow-hidden"
const panelStyle = { background: "#f5f6f8", border: "1px solid rgba(0,0,0,0.05)" } as const

const chipRise = (d = 0) => ({
  initial: { opacity: 0, scale: 0.9, y: 8 },
  whileInView: { opacity: 1, scale: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay: d },
})
const float = (dur = 4, dy = 5) => ({ animate: { y: [0, -dy, 0] }, transition: { duration: dur, repeat: Infinity, ease: "easeInOut" as const } })

// Ротация конкурента в заголовке
function RotatingRival() {
  const t = useT()
  const rivals = t.why.rivals
  const [i, setI] = useState(0)
  useEffect(() => { const iv = setInterval(() => setI((x) => (x + 1) % rivals.length), 1400); return () => clearInterval(iv) }, [rivals.length])
  return (
    <AnimatePresence mode="wait">
      <motion.span key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.28, ease: "easeOut" }}
        className="inline-block text-[#a1a1aa] whitespace-nowrap">{rivals[i % rivals.length]}</motion.span>
    </AnimatePresence>
  )
}

function Chip({ icon: Icon, color, children }: { icon?: typeof Users; color?: string; children?: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full pl-2 pr-3 py-1.5 text-[12.5px] font-medium text-[#0a0a0a] whitespace-nowrap"
      style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 14px -4px rgba(0,0,0,0.12)" }}>
      {Icon && <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: `${color}1a` }}><Icon className="w-3 h-3" style={{ color }} /></span>}
      {children}
    </div>
  )
}
function Skeleton({ w }: { w: number }) {
  return <div className="rounded-full h-7" style={{ width: w, background: "#fff", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 4px 14px -4px rgba(0,0,0,0.1)" }} />
}

// ── 1. Данные клиента (разбросанные чипы) ───────────────────────────────
function ContextPanel() {
  const AV = ["#3b82f6", "#a855f7", "#f97316", "#16a34a"]
  return (
    <div className={panel} style={panelStyle}>
      <motion.div {...chipRise(0.05)} className="absolute" style={{ top: 40, left: 24, rotate: "-4deg" }}><motion.div {...float(4.5)}><Skeleton w={120} /></motion.div></motion.div>
      <motion.div {...chipRise(0.12)} className="absolute" style={{ top: 92, left: 96, rotate: "3deg" }}><motion.div {...float(5)}><Chip icon={Users} color="#2563eb">Профиль клиента</Chip></motion.div></motion.div>
      <motion.div {...chipRise(0.2)} className="absolute" style={{ top: 150, right: 40, rotate: "-3deg" }}>
        <motion.div {...float(4.2)} className="inline-flex items-center gap-1.5 rounded-full pl-2 pr-3 py-1.5" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 14px -4px rgba(0,0,0,0.12)" }}>
          <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(22,163,74,0.12)" }}><Wallet className="w-3 h-3" style={{ color: "#16a34a" }} /></span>
          <div className="flex -space-x-2">{AV.map((c, i) => <span key={i} className="w-5 h-5 rounded-full border-2 border-white" style={{ background: c }} />)}</div>
        </motion.div>
      </motion.div>
      <motion.div {...chipRise(0.16)} className="absolute" style={{ top: 205, left: 32, rotate: "2deg" }}><motion.div {...float(4.8)}><Chip icon={FileText} color="#dc2626">договор.pdf</Chip></motion.div></motion.div>
      <motion.div {...chipRise(0.24)} className="absolute" style={{ top: 128, left: 40, rotate: "-2deg" }}><motion.div {...float(5.2)}><Chip icon={Hash} color="#7c3aed">VIP Безлимит · 48 визитов</Chip></motion.div></motion.div>
      <motion.div {...chipRise(0.3)} className="absolute" style={{ bottom: 44, left: 28, rotate: "3deg" }}><motion.div {...float(4.4)}><Chip icon={CreditCard} color="#2563eb">Баланс 120 000 сум</Chip></motion.div></motion.div>
      <motion.div {...chipRise(0.34)} className="absolute" style={{ bottom: 40, right: 40, rotate: "-4deg" }}><motion.div {...float(5)}><Skeleton w={90} /></motion.div></motion.div>
    </div>
  )
}

// ── 2. Автоматизация / память (наклонённые заметки) ─────────────────────
const NOTES = [
  { t: "Абонемент Амира истекает 21.06 — напомнить о продлении", r: "-3deg", top: 32, dur: 5 },
  { t: "Списать оплату за неделю и обновить отчёты автоматически", r: "2.5deg", top: 116, dur: 4.5 },
  { t: "12 клиентов не приходили 14+ дней — риск оттока", r: "-2deg", top: 196, dur: 4.8 },
  { t: "Сабине осталось 3 посещения — предложить продление", r: "3deg", top: 270, dur: 5.2 },
]
function MemoryPanel() {
  return (
    <div className={panel} style={panelStyle}>
      {NOTES.map((n, i) => (
        <motion.div key={i} {...chipRise(0.08 + i * 0.09)} className="absolute left-5 right-5" style={{ top: n.top, rotate: n.r }}>
          <motion.div {...float(n.dur, 4)} className="flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 18px -6px rgba(0,0,0,0.14)" }}>
            <Bell className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#7c3aed" }} />
            <span className="text-[12.5px] leading-[17px] text-[#0a0a0a]">{n.t}</span>
          </motion.div>
        </motion.div>
      ))}
    </div>
  )
}

// ── 3. Интеграции (сетка инструментов) ──────────────────────────────────
const TOOLS = [
  { label: "Telegram", icon: Send, color: "#2AABEE" },
  { label: "Payme", letter: "P", color: "#33b1ff" },
  { label: "Click", letter: "C", color: "#00a3e0" },
  { label: "Uzum", letter: "U", color: "#7c3aed" },
  { label: "QR-чекин", icon: QrCode, color: "#0a0a0a" },
  { label: "WhatsApp", icon: MessageCircle, color: "#25D366" },
  { label: "Instagram", icon: Camera, color: "#E1306C" },
  { label: "Уведомления", icon: Bell, color: "#f59e0b" },
]
function ToolsPanel() {
  return (
    <div className={`${panel} flex items-center justify-center`} style={panelStyle}>
      <div className="grid grid-cols-4 gap-3 p-6">
        {TOOLS.map((t, i) => (
          <motion.div key={t.label} {...chipRise(0.04 + i * 0.05)}
            className="w-[76px] h-[76px] rounded-2xl flex flex-col items-center justify-center gap-1.5"
            style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 14px -6px rgba(0,0,0,0.12)" }}>
            {t.icon
              ? <t.icon className="w-5 h-5" style={{ color: t.color }} />
              : <span className="w-6 h-6 rounded-md flex items-center justify-center text-[13px] font-bold text-white" style={{ background: t.color }}>{t.letter}</span>}
            <span className="text-[10px] font-medium text-[#52525b]">{t.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

const PANELS = [ContextPanel, MemoryPanel, ToolsPanel]
const headRise = (d = 0) => ({ initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.6, ease: "easeOut" as const, delay: d } })

export function WhyDifferent() {
  const t = useT()
  const COLS = [
    { title: t.why.col1t, sub: t.why.col1s, Panel: PANELS[0] },
    { title: t.why.col2t, sub: t.why.col2s, Panel: PANELS[1] },
    { title: t.why.col3t, sub: t.why.col3s, Panel: PANELS[2] },
  ]
  return (
    <section className="py-24 md:py-32" style={{ background: "#ffffff" }}>
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="max-w-[620px] mx-auto text-center mb-16">
          <motion.h2 {...headRise(0)} className="text-[40px] md:text-[52px] font-normal leading-[1.06] tracking-[-1.4px] text-[#0a0a0a]">
            {t.why.title1}<br />{t.why.title2} <RotatingRival />
          </motion.h2>
          <motion.p {...headRise(0.08)} className="mt-4 text-[16px] leading-[24px] text-[#52525b]">
            {t.why.subtitle}
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COLS.map((c, i) => {
            const P = c.Panel
            return (
              <motion.div key={c.title} {...headRise(0.12 + i * 0.08)}>
                <P />
                <div className="text-center mt-6">
                  <h3 className="text-[19px] font-semibold text-[#0a0a0a] tracking-[-0.3px]">{c.title}</h3>
                  <p className="text-[13.5px] leading-[20px] text-[#52525b] mt-1.5 max-w-[300px] mx-auto">{c.sub}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
