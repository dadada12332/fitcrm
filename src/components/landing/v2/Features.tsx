"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, useInView, useMotionValue, animate as animateValue } from "framer-motion"
import { Users, Wallet, Sparkles, CalendarClock, TrendingUp, ArrowUpRight } from "lucide-react"
import { useT } from "@/lib/i18n/context"

const ROW = { background: "#fff", border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" } as const

function Counter({ to, on }: { to: number; on: boolean }) {
  const mv = useMotionValue(0)
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!on) return
    const c = animateValue(mv, to, { duration: 1.6, ease: "easeOut", onUpdate: (x) => setV(Math.round(x)) })
    return () => c.stop()
  }, [on, to, mv])
  return <>{v.toLocaleString("ru-RU")}</>
}

const rise = (d = 0) => ({ initial: { opacity: 0, y: 14 }, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const, delay: d } })

// Эффект заморозки строки
function Frost() {
  return (
    <motion.div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(219,234,254,0.6), rgba(191,219,254,0.4))" }} />
      <motion.div className="absolute inset-0" style={{ background: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.75) 50%, transparent 65%)" }}
        initial={{ x: "-130%" }} animate={{ x: "130%" }} transition={{ duration: 0.9, delay: 0.05, ease: "easeInOut" }} />
    </motion.div>
  )
}

// ── Обёртка модуля ──────────────────────────────────────────────────────
function Panel({ title, icon: Icon, tone, children, className, badge, delay, show }: {
  title: string; icon: typeof Users; tone: string; children: React.ReactNode; className?: string; badge?: React.ReactNode; delay: number; show: boolean
}) {
  return (
    <motion.div {...rise(delay)} animate={show ? { opacity: 1, y: 0 } : {}}
      className={`relative rounded-[18px] p-4 sm:p-5 flex flex-col ${className ?? ""}`}
      style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div className="flex items-center gap-2 mb-3.5">
        <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: `${tone}14` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: tone }} />
        </span>
        <span className="text-[13px] font-semibold text-[#0a0a0a]">{title}</span>
        {badge}
        <ArrowUpRight className="w-3.5 h-3.5 ml-auto" style={{ color: "#c4c8cf" }} />
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </motion.div>
  )
}

// ── Клиенты (циклическая заморозка клиента) ─────────────────────────────
const CLIENTS = [
  { n: "Амир Тураев",     c: "#3b82f6", mem: "VIP Безлимит · до 21.06" },
  { n: "Лола Назарова",   c: "#a855f7", mem: "Персональный · активен" },
  { n: "Сабина Каримова", c: "#f97316", mem: "8 посещений · 3 осталось" },
]
function ClientsModule({ show }: { show: boolean }) {
  const [frozen, setFrozen] = useState(false)
  useEffect(() => {
    if (!show) return
    const iv = setInterval(() => setFrozen((f) => !f), 3400)
    return () => clearInterval(iv)
  }, [show])
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 mb-1">
        {[["Клиентов", 1001], ["Активные", 588], ["Долг, M", 26]].map(([l, val]) => (
          <div key={l as string} className="rounded-lg px-2.5 py-1.5" style={{ background: "#f6f7f9" }}>
            <div className="text-[9.5px] text-[#9ca3af] leading-none mb-1">{l}</div>
            <div className="text-[14px] font-semibold text-[#0a0a0a] tabular-nums leading-none"><Counter to={val as number} on={show} /></div>
          </div>
        ))}
      </div>
      {CLIENTS.map((c, i) => {
        const isFrozen = i === 0 && frozen
        return (
          <motion.div key={c.n} {...rise(0.15 + i * 0.08)} animate={show ? { opacity: 1, y: 0 } : {}}
            className="relative flex items-center gap-2.5 rounded-xl px-2.5 py-2" style={{ ...ROW, borderColor: isFrozen ? "rgba(147,197,253,0.9)" : "rgba(0,0,0,0.07)" }}>
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0 relative z-10" style={{ background: c.c }}>
              {c.n.split(" ").map((w) => w[0]).join("")}
            </span>
            <div className="flex-1 min-w-0 relative z-10">
              <div className="text-[12.5px] font-medium text-[#0a0a0a] truncate">{c.n}</div>
              <div className="text-[10.5px] text-[#9ca3af] truncate">{c.mem}</div>
            </div>
            <div className="relative z-10 shrink-0">
              <AnimatePresence mode="wait">
                <motion.span key={i === 0 ? (isFrozen ? "f" : "a") : "s"} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ duration: 0.22 }}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={isFrozen ? { background: "rgba(37,99,235,0.14)", color: "#2563eb" } : { background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: isFrozen ? "#2563eb" : "#16a34a" }} />{isFrozen ? "Заморожен" : "Активный"}
                </motion.span>
              </AnimatePresence>
            </div>
            <AnimatePresence>{isFrozen && <Frost />}</AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}

// ── Оплаты (live — прилетают новые платежи) ─────────────────────────────
const BARS = [42, 58, 50, 72, 63, 88, 100]
const LIVE = [
  { n: "Сабина Каримова", m: 280, p: "Payme", c: "#33b1ff" },
  { n: "Бекзод Каримов", m: 120, p: "Click", c: "#00a3e0" },
  { n: "Малика Исмаилова", m: 200, p: "Наличные", c: "#16a34a" },
  { n: "Азиз Рахимов", m: 90, p: "Payme", c: "#33b1ff" },
]
function PaymentsModule({ show }: { show: boolean }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (!show) return
    const iv = setInterval(() => setIdx((i) => (i + 1) % LIVE.length), 2600)
    return () => clearInterval(iv)
  }, [show])
  const p = LIVE[idx]
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10.5px] text-[#71717a] flex items-center gap-1.5">
            Выручка за неделю
            <span className="flex items-center gap-1 text-[9px] font-semibold" style={{ color: "#16a34a" }}>
              <motion.span className="w-1.5 h-1.5 rounded-full" style={{ background: "#16a34a" }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />LIVE
            </span>
          </div>
          <div className="text-[22px] font-semibold text-[#0a0a0a] tabular-nums leading-tight mt-0.5"><Counter to={27500000} on={show} /> <span className="text-[11px] font-normal text-[#9ca3af]">сум</span></div>
        </div>
        <span className="text-[10.5px] font-semibold px-2 py-1 rounded-md flex items-center gap-1" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}><TrendingUp className="w-3 h-3" />+34%</span>
      </div>
      <div className="flex items-end gap-1.5 h-11 mt-1">
        {BARS.map((h, i) => (
          <motion.div key={i} className="flex-1 rounded-t-[3px]" style={{ background: i === BARS.length - 1 ? "#0065fc" : "rgba(0,101,252,0.22)" }}
            initial={{ height: 0 }} animate={show ? { height: `${h}%` } : {}} transition={{ duration: 0.6, delay: 0.2 + i * 0.05, ease: "easeOut" }} />
        ))}
      </div>
      <div className="text-[10px] text-[#9ca3af] mt-1">Последняя оплата</div>
      <div className="relative h-[42px]">
        <AnimatePresence mode="popLayout">
          <motion.div key={idx} initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute inset-x-0 flex items-center gap-2.5 rounded-xl px-2.5 py-2" style={ROW}>
            <span className="w-7 h-7 rounded-full shrink-0" style={{ background: p.c }} />
            <div className="flex-1 min-w-0"><div className="text-[12px] text-[#0a0a0a] truncate">{p.n}</div><div className="text-[10px] text-[#9ca3af]">только что · {p.p}</div></div>
            <span className="text-[12.5px] font-semibold text-[#16a34a] tabular-nums shrink-0">+{p.m}k</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Расписание (растут записи) ──────────────────────────────────────────
const CLASSES = [
  { t: "09:00", n: "Йога", tr: "Анна", total: 12, c: "#16a34a" },
  { t: "12:00", n: "Кроссфит", tr: "Дмитрий", total: 15, c: "#dc2626" },
  { t: "18:00", n: "Бокс", tr: "Руслан", total: 10, c: "#2563eb" },
  { t: "20:00", n: "Пилатес", tr: "Мадина", total: 14, c: "#7c3aed" },
]
function ScheduleModule({ show }: { show: boolean }) {
  const [seats, setSeats] = useState([8, 15, 6, 9])
  const [pulse, setPulse] = useState<number | null>(null)
  useEffect(() => {
    if (!show) return
    const iv = setInterval(() => {
      const i = Math.floor(Math.random() * CLASSES.length)
      setSeats((s) => { const n = [...s]; if (n[i] < CLASSES[i].total) n[i]++; return n })
      setPulse(i); setTimeout(() => setPulse(null), 650)
    }, 2000)
    return () => clearInterval(iv)
  }, [show])
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 h-full">
      {CLASSES.map((cl, i) => {
        const full = seats[i] >= cl.total
        return (
          <motion.div key={cl.n} {...rise(0.1 + i * 0.07)} animate={show ? { opacity: 1, y: 0, scale: pulse === i ? 1.03 : 1 } : {}} transition={{ duration: pulse === i ? 0.3 : 0.55 }}
            className="rounded-xl px-3 py-2.5 flex flex-col justify-between" style={{ background: "#f6f7f9", borderLeft: `2px solid ${cl.c}` }}>
            <div>
              <div className="text-[11px] font-semibold text-[#0a0a0a]">{cl.t} · {cl.n}</div>
              <div className="text-[10.5px] text-[#9ca3af]">{cl.tr}</div>
            </div>
            <div className="text-[10.5px] font-medium mt-2 tabular-nums" style={{ color: full ? "#dc2626" : "#16a34a" }}>{seats[i]}/{cl.total} мест</div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ── AI (циклично печатает вопросы и отвечает) ───────────────────────────
const QA = [
  { q: "Что сегодня важного?", label: "Выручка сегодня", value: 640000, delta: "▲ 34%", insights: [{ i: "⚠️", t: "12 клиентов под риском оттока", a: "предложите продление" }, { i: "🔔", t: "8 абонементов истекают за 3 дня", a: "отправьте напоминание" }] },
  { q: "Прогноз на месяц?", label: "Прогноз выручки · 30 дней", value: 29500000, delta: "рост", insights: [{ i: "💡", t: "Запустите акцию на «8 посещений»", a: "самый популярный тариф" }, { i: "📈", t: "Пик посещений 18:00–19:00", a: "усильте смену" }] },
]
function AiChat({ qa }: { qa: typeof QA[number] }) {
  const [typed, setTyped] = useState("")
  const [phase, setPhase] = useState<"typing" | "thinking" | "answer">("typing")
  useEffect(() => {
    let i = 0
    const iv = setInterval(() => { i++; setTyped(qa.q.slice(0, i)); if (i >= qa.q.length) { clearInterval(iv); setTimeout(() => setPhase("thinking"), 300) } }, 52)
    return () => clearInterval(iv)
  }, [qa])
  useEffect(() => { if (phase !== "thinking") return; const t = setTimeout(() => setPhase("answer"), 950); return () => clearTimeout(t) }, [phase])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <span className="text-[13px] text-white px-3.5 py-2 rounded-2xl rounded-br-md" style={{ background: "#0065fc" }}>{typed}{phase === "typing" && <span className="opacity-70">▌</span>}</span>
      </div>
      {phase === "thinking" && (
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(124,58,237,0.1)" }}><Sparkles className="w-3.5 h-3.5" style={{ color: "#7c3aed" }} /></span>
          <span className="flex items-center gap-1 px-3 py-2.5 rounded-2xl rounded-bl-md" style={ROW}>
            {[0, 1, 2].map((i) => <motion.span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "#9ca3af" }} animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />)}
          </span>
        </div>
      )}
      {phase === "answer" && (
        <>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="rounded-xl px-4 py-3" style={ROW}>
            <div className="flex items-center gap-1.5 mb-1.5"><Sparkles className="w-3.5 h-3.5" style={{ color: "#7c3aed" }} /><span className="text-[11px] text-[#71717a]">{qa.label}</span></div>
            <div className="flex items-end justify-between">
              <div className="text-[24px] font-semibold text-[#0a0a0a] tabular-nums leading-none"><Counter to={qa.value} on={true} /> <span className="text-[12px] font-normal text-[#9ca3af]">сум</span></div>
              <span className="text-[12px] font-semibold" style={{ color: "#16a34a" }}>{qa.delta}</span>
            </div>
            <svg viewBox="0 0 240 40" className="w-full h-9 mt-2" preserveAspectRatio="none">
              <motion.polyline points="0,32 34,26 68,29 102,16 136,20 170,10 204,13 240,3" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.2 }} />
            </svg>
          </motion.div>
          {qa.insights.map((ins, k) => (
            <motion.div key={ins.t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 + k * 0.15 }} className="rounded-xl px-3.5 py-2.5" style={ROW}>
              <div className="text-[12.5px] font-medium text-[#0a0a0a] leading-snug">{ins.i} {ins.t}</div>
              <div className="text-[11px] text-[#9ca3af] mt-0.5">{ins.a}</div>
            </motion.div>
          ))}
        </>
      )}
    </div>
  )
}
function AiModule({ show }: { show: boolean }) {
  const [cycle, setCycle] = useState(0)
  useEffect(() => {
    if (!show) return
    const iv = setInterval(() => setCycle((c) => c + 1), 7200)
    return () => clearInterval(iv)
  }, [show])
  return <div key={cycle}><AiChat qa={QA[cycle % QA.length]} /></div>
}

const headRise = (d = 0) => ({ initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.6, ease: "easeOut" as const, delay: d } })

export function Features() {
  const t = useT()
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: "-120px" })

  return (
    <section ref={ref} id="features" className="py-24 md:py-32" style={{ background: "#ffffff" }}>
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="max-w-[680px] mx-auto text-center mb-12">
          <motion.h2 {...headRise(0)} className="text-[40px] md:text-[52px] font-normal leading-[1.04] tracking-[-1.4px] text-[#0a0a0a]">
            {t.features.title}
          </motion.h2>
          <motion.p {...headRise(0.08)} className="mt-4 text-[16px] leading-[24px] text-[#52525b]">
            {t.features.subtitle}
          </motion.p>
        </div>

        <motion.div {...headRise(0.12)} className="rounded-[26px] p-2.5 sm:p-3"
          style={{ background: "#f2f3f5", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 24px 70px -30px rgba(0,0,0,0.2)" }}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 sm:gap-3 lg:[grid-template-rows:auto_auto]">
            <Panel title={t.features.clients} icon={Users} tone="#2563eb" delay={0.15} show={inView}><ClientsModule show={inView} /></Panel>
            <Panel title={t.features.payments} icon={Wallet} tone="#16a34a" delay={0.22} show={inView}><PaymentsModule show={inView} /></Panel>
            <Panel title={t.features.ai} icon={Sparkles} tone="#7c3aed" delay={0.3} show={inView}
              className="lg:row-span-2 lg:min-h-[430px]"
              badge={<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-wide" style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed" }}>{t.features.core}</span>}>
              <AiModule show={inView} />
            </Panel>
            <Panel title={t.features.schedule} icon={CalendarClock} tone="#7c3aed" delay={0.38} show={inView} className="lg:col-span-2"><ScheduleModule show={inView} /></Panel>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
