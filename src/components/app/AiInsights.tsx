"use client"

import { useState } from "react"
import { ArrowUp, ArrowRight } from "lucide-react"
import Link from "next/link"

type Props = {
  attendanceChangePct: number
  churnCount: number
  expiringCount: number
}

type Severity = "ok" | "warn" | "info"

type Message = {
  severity: Severity
  emoji: string
  title: string
  body: string
  href: string
  linkLabel: string
}

function buildMessages(attendanceChangePct: number, churnCount: number, expiringCount: number): Message[] {
  const msgs: Message[] = []

  if (attendanceChangePct >= 10) {
    msgs.push({
      severity: "ok",
      emoji: "📈",
      title: `Посещаемость +${attendanceChangePct.toFixed(0)}%`,
      body: `За последние 7 дней зал посетили значительно больше людей, чем неделю назад. Хороший момент для продления акций.`,
      href: "/visits",
      linkLabel: "Перейти к посещениям",
    })
  } else if (attendanceChangePct < 0) {
    msgs.push({
      severity: "warn",
      emoji: "📉",
      title: `Посещаемость ${attendanceChangePct.toFixed(0)}%`,
      body: `За 7 дней посещаемость снизилась на ${Math.abs(attendanceChangePct).toFixed(0)}%. Рекомендую связаться с клиентами, которые давно не заходили.`,
      href: "/visits",
      linkLabel: "Посмотреть отчёт",
    })
  } else {
    msgs.push({
      severity: "info",
      emoji: "📊",
      title: "Посещаемость стабильна",
      body: `Количество визитов за неделю держится на прежнем уровне. Продолжайте в том же темпе.`,
      href: "/visits",
      linkLabel: "Перейти к посещениям",
    })
  }

  if (churnCount > 3) {
    msgs.push({
      severity: "warn",
      emoji: "⚠️",
      title: `${churnCount} клиентов под угрозой ухода`,
      body: `У этих клиентов абонемент истёк или истекает в ближайшие дни, и они не продлевали. Самое время сделать напоминание или специальное предложение.`,
      href: "/clients",
      linkLabel: "Посмотреть клиентов",
    })
  } else if (churnCount > 0) {
    msgs.push({
      severity: "info",
      emoji: "🔔",
      title: `${churnCount} клиента могут уйти`,
      body: `Небольшая группа клиентов не продлила абонемент. Одно сообщение может вернуть их.`,
      href: "/clients",
      linkLabel: "Открыть список",
    })
  } else {
    msgs.push({
      severity: "ok",
      emoji: "✅",
      title: "Риск ухода минимальный",
      body: `Все активные клиенты держатся. Продолжайте поддерживать качество обслуживания.`,
      href: "/clients",
      linkLabel: "К клиентам",
    })
  }

  if (expiringCount > 0) {
    msgs.push({
      severity: "warn",
      emoji: "⏳",
      title: `${expiringCount} абонементов истекают`,
      body: `В ближайшие 7 дней у ${expiringCount} клиентов заканчивается действующий абонемент. Самое время предложить продление.`,
      href: "/payments",
      linkLabel: "Принять оплаты",
    })
  }

  msgs.push({
    severity: "info",
    emoji: "🕕",
    title: "Пиковое время: 18:00 – 21:00",
    body: `Зал наиболее загружен в вечернее время. Если мест не хватает — рассмотрите дополнительный слот или ограничение записи.`,
    href: "/schedule",
    linkLabel: "Открыть расписание",
  })

  return msgs
}

const SEVERITY_STYLES: Record<Severity, { dot: string; border: string; bg: string }> = {
  ok:   { dot: "#16a34a", border: "rgba(22,163,74,0.2)",   bg: "rgba(22,163,74,0.05)"   },
  warn: { dot: "#d97706", border: "rgba(217,119,6,0.2)",   bg: "rgba(217,119,6,0.05)"   },
  info: { dot: "#2563eb", border: "rgba(37,99,235,0.15)",  bg: "rgba(37,99,235,0.04)"   },
}

function ChatBubble({ msg, delay }: { msg: Message; delay: number }) {
  const s = SEVERITY_STYLES[msg.severity]
  return (
    <div className="flex gap-2.5" style={{ animationDelay: `${delay}ms` }}>
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", fontSize: 13 }}>
        ✦
      </div>

      {/* Bubble */}
      <div className="flex-1 rounded-2xl rounded-tl-sm px-4 py-3"
        style={{ background: s.bg, border: `1px solid ${s.border}` }}>
        <div className="flex items-center gap-1.5 mb-1">
          <span style={{ fontSize: 14 }}>{msg.emoji}</span>
          <span className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{msg.title}</span>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 ml-auto" style={{ background: s.dot }} />
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "var(--on-dark-soft)" }}>{msg.body}</p>
        <Link
          href={msg.href}
          className="inline-flex items-center gap-1 mt-2.5 text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: s.dot }}
        >
          {msg.linkLabel}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}

export function AiInsights({ attendanceChangePct, churnCount, expiringCount }: Props) {
  const [chatValue, setChatValue] = useState("")
  const hasText = chatValue.trim().length > 0
  const messages = buildMessages(attendanceChangePct, churnCount, expiringCount)

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <style>{`
            .ai-shimmer-label {
              background: linear-gradient(135deg,#6366f1,#a855f7,#ec4899,#6366f1);
              background-size: 300% 300%;
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              animation: ai-shimmer 4s ease infinite;
            }
            @keyframes ai-shimmer {
              0%   { background-position: 0% 50% }
              50%  { background-position: 100% 50% }
              100% { background-position: 0% 50% }
            }
          `}</style>
          <span className="font-semibold ai-shimmer-label" style={{ fontSize: 15 }}>ИИ Аналитика</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--card-2)", color: "var(--on-dark-soft)" }}>
            За 7 дней
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#a855f7" }} />
          <span className="text-xs" style={{ color: "var(--gray-muted)" }}>онлайн</span>
        </div>
      </div>

      {/* Chat feed — scrollable, never overflows screen */}
      <div className="px-4 flex flex-col gap-3 overflow-y-auto" style={{ paddingBottom: 4, maxHeight: 320 }}>
        {messages.map((msg, i) => (
          <ChatBubble key={i} msg={msg} delay={i * 80} />
        ))}
      </div>

      {/* Divider */}
      <div className="mx-4 mt-4" style={{ borderTop: "1px solid var(--border-subtle)" }} />

      {/* Chat input */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
          <span className="text-sm flex-shrink-0 select-none">✨</span>
          <input
            value={chatValue}
            onChange={(e) => setChatValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && hasText) setChatValue("") }}
            placeholder="Спросите ИИ о состоянии клуба..."
            className="flex-1 h-10 text-sm bg-transparent outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
            style={{ color: "var(--on-dark)" }}
          />
          <button
            onClick={() => { if (hasText) setChatValue("") }}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
            style={{ background: hasText ? "#6366f1" : "var(--border)" }}
          >
            <ArrowUp className="w-3.5 h-3.5" style={{ color: hasText ? "white" : "var(--gray-muted)" }} />
          </button>
        </div>
      </div>
    </div>
  )
}
