"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, SendHorizontal, BookOpen, Loader2, ThumbsUp, MessageSquarePlus } from "lucide-react"
import { aiAnswer, searchKnowledge } from "@/lib/knowledge"
import { askSupportAction, createTicketAction, type SupportChatTurn } from "@/app/(app)/support/actions"
import { collectClientMeta } from "@/lib/diagnostics"

type Turn = {
  role: "user" | "ai"
  text: string
  links?: { id: string; title: string }[]
  resolved?: boolean          // показать блок «Получилось решить?»
}

const SUGGESTIONS = [
  "Как импортировать клиентов?",
  "Не работает оплата через Payme",
  "Клиент не может пройти на тренировку",
  "Как сделать возврат?",
]

export function SupportAi({ onCreateTicket }: { onCreateTicket: () => void }) {
  const router = useRouter()
  const [turns, setTurns] = useState<Turn[]>([])
  const [value, setValue] = useState("")
  const [thinking, setThinking] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }) }, [turns.length, thinking])

  // Локальный ответчик (fallback, если Gemini недоступен).
  function localAnswer(question: string): { text: string; links: { id: string; title: string }[] } {
    const a = aiAnswer(question)
    if (a.answer) return { text: a.answer, links: a.links }
    const found = searchKnowledge(question)
    if (found.length) return { text: "Вот что нашлось в базе знаний по вашему вопросу:", links: found.slice(0, 4).map((f) => ({ id: f.id, title: f.title })) }
    return { text: "Не нашёл точного ответа. Опишите проблему подробнее — или создайте обращение, и наша команда поможет.", links: [] }
  }

  async function ask(q: string) {
    const question = q.trim()
    if (!question || thinking) return
    setValue("")
    const nextTurns: Turn[] = [...turns, { role: "user", text: question }]
    setTurns(nextTurns)
    setThinking(true)

    // Gemini + RAG по базе знаний; при недоступности — локальный ответчик.
    const history: SupportChatTurn[] = nextTurns.map((t) => ({ role: t.role, text: t.text }))
    const res = await askSupportAction(history)

    if (res.error && res.error !== "no_key") {
      setTurns((t) => [...t, { role: "ai", text: res.error!, resolved: true }])
    } else if (res.reply) {
      setTurns((t) => [...t, { role: "ai", text: res.reply, links: res.links, resolved: true }])
    } else {
      const local = localAnswer(question)
      setTurns((t) => [...t, { role: "ai", text: local.text, links: local.links, resolved: true }])
    }
    setThinking(false)
  }

  async function escalate() {
    if (escalating) return
    setEscalating(true)
    // тема = первый вопрос пользователя; тело = вся переписка с AI
    const firstQuestion = turns.find((t) => t.role === "user")?.text ?? "Обращение из AI Помощника"
    const transcript = turns
      .map((t) => `${t.role === "user" ? "Клиент" : "AI"}: ${t.text}`)
      .join("\n\n")
    const body = `${transcript}\n\n— Клиент не смог решить вопрос через AI Помощника.`
    const { id } = await createTicketAction({
      category: "other",
      subject: firstQuestion.slice(0, 120),
      body,
      clientMeta: collectClientMeta({ from: "ai_assistant" }),
      source: "ai_escalation",
    })
    setEscalating(false)
    if (id) router.replace(`/support?tab=tickets&id=${id}`)
    else onCreateTicket()
  }

  const empty = turns.length === 0

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ border: "1px solid var(--border)", height: "calc(100vh - 230px)", minHeight: 480, background: "var(--card)" }}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {empty ? (
          <div className="max-w-md mx-auto text-center flex flex-col items-center justify-center h-full">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg,#7c3aed,#2563eb)" }}>
              <Sparkles size={26} className="text-white" />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: "var(--on-dark)" }}>Чем помочь?</h3>
            <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>
              Опишите проблему — я постараюсь решить сразу. Если не получится, создадим обращение в поддержку.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5 w-full">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)}
                  className="text-left text-sm px-3.5 py-2.5 rounded-xl transition-colors"
                  style={{ background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {turns.map((t, i) => (
              <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%]">
                  <div className="px-3.5 py-2.5 text-sm whitespace-pre-wrap"
                    style={{
                      borderRadius: t.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: t.role === "user" ? "#2563eb" : "var(--card-2)",
                      color: t.role === "user" ? "#fff" : "var(--on-dark)",
                      border: t.role === "user" ? "none" : "1px solid var(--border)",
                    }}>
                    {t.text}
                  </div>
                  {t.links && t.links.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {t.links.map((l) => (
                        <button key={l.id} onClick={() => router.push(`/support?tab=kb&article=${l.id}`)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                          style={{ background: "rgba(37,99,235,0.1)", color: "#2563eb" }}>
                          <BookOpen size={12} /> {l.title}
                        </button>
                      ))}
                    </div>
                  )}
                  {t.resolved && i === turns.length - 1 && (
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Получилось решить?</span>
                      <button onClick={() => setTurns((prev) => [...prev, { role: "ai", text: "Отлично! Рады помочь 🙌" }])}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
                        <ThumbsUp size={13} /> Да
                      </button>
                      <button onClick={escalate} disabled={escalating}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-60"
                        style={{ background: "#2563eb" }}>
                        {escalating ? <Loader2 size={13} className="animate-spin" /> : <MessageSquarePlus size={13} />} Нет, создать обращение
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="px-3.5 py-2.5 rounded-2xl inline-flex items-center gap-2" style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
                  <Loader2 size={14} className="animate-spin" style={{ color: "var(--gray-muted)" }} />
                  <span className="text-sm" style={{ color: "var(--gray-muted)" }}>Думаю…</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ввод */}
      <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="max-w-2xl mx-auto flex items-end gap-2 rounded-xl px-3 py-2" style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
          <textarea value={value} onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(value) } }}
            rows={1} placeholder="Опишите проблему…"
            className="flex-1 resize-none bg-transparent text-sm outline-none py-1 max-h-32" style={{ color: "var(--on-dark)" }} />
          <button onClick={() => ask(value)} disabled={!value.trim() || thinking}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white disabled:opacity-40 flex-shrink-0" style={{ background: "#2563eb" }}>
            <SendHorizontal size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
