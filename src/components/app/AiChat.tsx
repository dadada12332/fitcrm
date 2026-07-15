"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import Link from "next/link"
import {
  Sparkles, Phone, MessageCircle, ArrowRight, ArrowUpRight,
  TrendingUp, Users, Package, Wallet, CalendarClock, CheckCircle2, Info,
  BarChart3, Activity, Zap,
} from "lucide-react"
import { askAiAction, getBriefingAction, type AiMessage, type AiCard, type AiClientItem, type Briefing } from "@/app/(app)/ai/actions"
import { AiComposer } from "./AiComposer"

const CATEGORIES: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; title: string; desc: string; query: string }[] = [
  { icon: BarChart3, color: "#2563eb", title: "Аналитика", desc: "Выручка, продажи, средний чек", query: "какая выручка за вчера?" },
  { icon: Users, color: "#7c3aed", title: "Клиенты", desc: "Поиск, должники, риск оттока", query: "покажи должников" },
  { icon: CalendarClock, color: "#db2777", title: "Абонементы", desc: "Истекающие, активные, продление", query: "у кого заканчивается абонемент" },
  { icon: Activity, color: "#16a34a", title: "Посещения", desc: "Кто в зале, чек-ины за день", query: "сколько сейчас в зале?" },
  { icon: Package, color: "#d97706", title: "Склад", desc: "Остатки, топ продаж, товары", query: "что заканчивается на складе" },
  { icon: Zap, color: "#4f46e5", title: "Действия", desc: "Клиент, оплата, товар, посещение", query: "добавь клиента" },
]

// ── Карточки ответов ─────────────────────────────────────────────
function SourceBadge({ src }: { src?: { entity: string; count: number; period?: string } }) {
  if (!src) return null
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: "var(--card-2)", color: "var(--gray-muted)" }}>
      {src.entity} · {src.count}{src.period ? ` · ${src.period}` : ""}
    </span>
  )
}

function CardShell({ icon, title, src, children, footer, openHref }: {
  icon: React.ReactNode; title: string; src?: { entity: string; count: number; period?: string }
  children: React.ReactNode; footer?: React.ReactNode; openHref?: string
}) {
  return (
    <div className="rounded-2xl overflow-hidden max-w-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <span className="flex-shrink-0">{icon}</span>
        <span className="text-sm font-semibold flex-1 truncate" style={{ color: "var(--on-dark)" }}>{title}</span>
        <SourceBadge src={src} />
      </div>
      <div className="px-4 py-3">{children}</div>
      {(footer || openHref) && (
        <div className="flex items-center gap-2 flex-wrap px-4 py-2.5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {footer}
          {openHref && <Link href={openHref} className="ml-auto inline-flex items-center gap-1 text-xs font-medium" style={{ color: "#2563eb" }}>Открыть раздел <ArrowRight className="w-3.5 h-3.5" /></Link>}
        </div>
      )}
    </div>
  )
}

function Followups({ items, onPick }: { items?: string[]; onPick: (t: string) => void }) {
  if (!items?.length) return null
  return <>{items.map((f) => (
    <button key={f} onClick={() => onPick(f)} className="text-xs px-2.5 py-1 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ background: "var(--card-2)", color: "var(--on-dark-soft)" }}>{f}</button>
  ))}</>
}

function ClientRow({ c }: { c: AiClientItem }) {
  const digits = (c.phone ?? "").replace(/\D/g, "")
  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0" style={{ background: "#3b82f6" }}>{c.name.charAt(0).toUpperCase()}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" style={{ color: "var(--on-dark)" }}>{c.name}</p>
        <p className="text-xs truncate" style={{ color: "var(--gray-muted)" }}>{c.phone ? `${c.phone} · ` : ""}{c.line1 ?? ""}</p>
      </div>
      {c.right && <span className="text-xs font-semibold whitespace-nowrap" style={{ color: "#dc2626" }}>{c.right}</span>}
      <div className="flex items-center gap-1 shrink-0">
        {digits && <a href={`tel:${digits}`} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Позвонить"><Phone className="w-3.5 h-3.5" style={{ color: "var(--on-dark-soft)" }} /></a>}
        {digits && <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800" title="WhatsApp"><MessageCircle className="w-3.5 h-3.5" style={{ color: "#16a34a" }} /></a>}
        {c.id && <Link href={`/clients/${c.id}`} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Открыть"><ArrowUpRight className="w-3.5 h-3.5" style={{ color: "var(--on-dark-soft)" }} /></Link>}
      </div>
    </div>
  )
}

function CardView({ card, onFollow }: { card: AiCard; onFollow: (t: string) => void }) {
  if (card.type === "success") return (
    <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl max-w-lg" style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.25)" }}>
      <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#16a34a" }} />
      <div className="flex-1">
        <p className="text-sm" style={{ color: "var(--on-dark)" }}>{card.text.replace(/^✅\s*/, "")}</p>
        {card.followups && <div className="flex gap-2 flex-wrap mt-2"><Followups items={card.followups} onPick={onFollow} /></div>}
      </div>
    </div>
  )
  if (card.type === "info") return (
    <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl max-w-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <Info className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#2563eb" }} /><p className="text-sm" style={{ color: "var(--on-dark)" }}>{card.text}</p>
    </div>
  )
  if (card.type === "kpi") return (
    <CardShell icon={<Wallet className="w-4 h-4" style={{ color: "#2563eb" }} />} title={card.title} src={card.source}
      footer={<Followups items={card.followups} onPick={onFollow} />}>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-[-0.4px]" style={{ color: "var(--on-dark)" }}>{card.value}</span>
        {card.delta && <span className="text-sm font-semibold" style={{ color: card.deltaUp ? "#16a34a" : "#dc2626" }}>{card.delta}</span>}
      </div>
      {card.sub && <p className="text-xs mt-1" style={{ color: "var(--gray-muted)" }}>{card.sub}</p>}
    </CardShell>
  )
  if (card.type === "client_list") return (
    <CardShell icon={<Users className="w-4 h-4" style={{ color: "#7c3aed" }} />} title={card.title} src={card.source} openHref={card.openHref}
      footer={<Followups items={card.followups} onPick={onFollow} />}>
      {card.clients.length === 0 ? <p className="text-sm" style={{ color: "var(--gray-muted)" }}>Ничего не найдено.</p> :
        <div className="flex flex-col">{card.clients.map((c, i) => <ClientRow key={c.id || i} c={c} />)}</div>}
    </CardShell>
  )
  if (card.type === "table") return (
    <CardShell icon={<TrendingUp className="w-4 h-4" style={{ color: "#16a34a" }} />} title={card.title} src={card.source} openHref={card.openHref}
      footer={<Followups items={card.followups} onPick={onFollow} />}>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead><tr>{card.columns.map((c) => <th key={c} className="text-left font-medium px-1 pb-2 text-xs" style={{ color: "var(--gray-muted)" }}>{c}</th>)}</tr></thead>
          <tbody>{card.rows.map((r, i) => <tr key={i} style={{ borderTop: "1px solid var(--border-subtle)" }}>{r.map((cell, j) => <td key={j} className="px-1 py-1.5 whitespace-nowrap" style={{ color: "var(--on-dark)" }}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </CardShell>
  )
  if (card.type === "list") return (
    <CardShell icon={<Package className="w-4 h-4" style={{ color: "#d97706" }} />} title={card.title} src={card.source} openHref={card.openHref}
      footer={<Followups items={card.followups} onPick={onFollow} />}>
      {card.items.length === 0 ? <p className="text-sm" style={{ color: "var(--gray-muted)" }}>Пусто.</p> :
        <div className="flex flex-col">{card.items.map((it, i) => (
          <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: i < card.items.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
            <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate" style={{ color: "var(--on-dark)" }}>{it.title}</p>{it.subtitle && <p className="text-xs" style={{ color: "var(--gray-muted)" }}>{it.subtitle}</p>}</div>
            {it.badge && <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: "var(--card-2)", color: it.badgeColor ?? "var(--on-dark-soft)" }}>{it.badge}</span>}
          </div>
        ))}</div>}
    </CardShell>
  )
  return null
}

// ── Основной чат ─────────────────────────────────────────────────
export function AiChat() {
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [pending, start] = useTransition()
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const empty = messages.length === 0

  useEffect(() => { getBriefingAction().then(setBriefing).catch(() => {}) }, [])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }) }, [messages, pending])

  function send(text: string, image: string | null = null) {
    const content = text.trim()
    if ((!content && !image) || pending) return
    const next: AiMessage[] = [...messages, { role: "user", content, image }]
    setMessages(next)
    start(async () => {
      const res = await askAiAction(next.map((m) => ({ role: m.role, content: m.content, image: m.image })))
      setMessages((m) => [...m, { role: "assistant", content: res.error ? `⚠️ ${res.error}` : res.reply, cards: res.cards }])
    })
  }

  return (
    <div className="flex flex-col relative" style={{ height: "calc(100vh - 132px)" }}>
      {/* Мягкие градиентные блобы (в обеих темах, низкая непрозрачность) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute top-4 left-1/4 w-80 h-80 rounded-full blur-[120px]" style={{ background: "rgba(124,58,237,0.10)" }} />
        <div className="absolute bottom-8 right-1/4 w-80 h-80 rounded-full blur-[120px]" style={{ background: "rgba(37,99,235,0.10)" }} />
      </div>
      {empty ? (
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 py-8 relative">
          <div className="w-full max-w-3xl">
            {/* Приветствие */}
            <div className="text-center mb-7">
              <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg,#7c3aed,#2563eb)", boxShadow: "0 10px 30px rgba(124,58,237,0.25)" }}>
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] mb-1.5" style={{ color: "var(--gray-muted)" }}>{briefing ? `${briefing.greeting}` : "AI Помощник"}</p>
              <h1 className="text-3xl font-semibold tracking-[-0.3px]" style={{ color: "var(--on-dark)" }}>Чем помочь сегодня?</h1>
              <p className="text-sm mt-2 max-w-xl mx-auto" style={{ color: "var(--on-dark-soft)" }}>
                Спросите про метрики и клиентов или дайте команду — считаю выручку, нахожу должников, работаю со складом и выполняю действия.
              </p>
            </div>

            {/* Широкое поле чата */}
            <AiComposer onSend={send} pending={pending} autoFocus />

            {/* Карточки быстрого действия */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
              {CATEGORIES.map(({ icon: Icon, color, title, desc, query }) => (
                <button key={title} onClick={() => send(query)}
                  className="group text-left rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                      <Icon className="w-[18px] h-[18px]" style={{ color }} />
                    </div>
                    <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: "var(--gray-muted)" }} />
                  </div>
                  <p className="text-sm font-semibold mt-3" style={{ color: "var(--on-dark)" }}>{title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }}>{desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && <div className="w-7 h-7 rounded-lg flex items-center justify-center mr-2 mt-0.5 shrink-0" style={{ background: "linear-gradient(135deg,#7c3aed,#2563eb)" }}><Sparkles className="w-4 h-4 text-white" /></div>}
                  <div className={m.role === "user" ? "max-w-[80%]" : "flex-1 min-w-0 space-y-2"}>
                    {m.image && m.role === "user" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.image} alt="" className="rounded-lg mb-1 max-h-48 object-cover ml-auto" />
                    )}
                    {m.content && (
                      <div className={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap inline-block ${m.role === "user" ? "" : ""}`}
                        style={m.role === "user" ? { background: "#2563eb", color: "white" } : { background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}>{m.content}</div>
                    )}
                    {m.cards?.map((c, j) => <CardView key={j} card={c} onFollow={send} />)}
                  </div>
                </div>
              ))}
              {pending && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center mr-2 mt-0.5 shrink-0" style={{ background: "linear-gradient(135deg,#7c3aed,#2563eb)" }}><Sparkles className="w-4 h-4 text-white" /></div>
                  <div className="px-3.5 py-2.5 rounded-2xl inline-flex items-center gap-2" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <CalendarClock className="w-4 h-4 animate-pulse" style={{ color: "var(--gray-muted)" }} />
                    <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>Анализирую…</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="px-4 pt-2 pb-4 relative" style={{ borderTop: "1px solid var(--border-subtle)" }}><div className="max-w-2xl mx-auto"><AiComposer onSend={send} pending={pending} /></div></div>
        </>
      )}
    </div>
  )
}
