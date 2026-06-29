"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import {
  Search, Star, Sparkles, ArrowLeft, ThumbsUp, ThumbsDown, ChevronRight,
  Clock, Zap, Play, X, Send, CheckCircle, MessageCircle, Video,
  BookOpen, AlertCircle, GraduationCap, RotateCcw, FileText,
} from "lucide-react"
import {
  KB_CATEGORIES, KB_SCENARIOS, KB_VIDEOS, searchKnowledge,
  getPopularArticles, getNewArticles, getArticleById, aiAnswer,
  type KbArticle, type KbCategory,
} from "@/lib/knowledge"

// ── Local storage helpers ──────────────────────────────────────────────

function useFavorites() {
  const [favs, setFavs] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("kb_favs") ?? "[]")) } catch { return new Set() }
  })
  const toggle = (id: string) => setFavs(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id)
    try { localStorage.setItem("kb_favs", JSON.stringify([...n])) } catch {}
    return n
  })
  return { favs, toggle }
}

function useHistory() {
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("kb_history") ?? "[]") } catch { return [] }
  })
  const push = (id: string) => setHistory(prev => {
    const n = [id, ...prev.filter(h => h !== id)].slice(0, 6)
    try { localStorage.setItem("kb_history", JSON.stringify(n)) } catch {}
    return n
  })
  return { history, push }
}

// ── Types ──────────────────────────────────────────────────────────────

type Tab = "popular" | "favorites" | "new" | "videos" | "scenarios"
type View =
  | { kind: "home" }
  | { kind: "category"; catId: string }
  | { kind: "article"; articleId: string }
  | { kind: "scenario"; scenarioId: string }

// ── Shared UI atoms ────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {label}
    </span>
  )
}

function ArticleRow({ article, catIcon, catTitle, isFav, onToggleFav, onClick }: {
  article: KbArticle & { categoryId?: string }
  catIcon?: string
  catTitle?: string
  isFav: boolean
  onToggleFav: () => void
  onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      style={{ borderBottom: "1px solid var(--border)" }}>
      {catIcon && <span className="text-lg shrink-0">{catIcon}</span>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate" style={{ color: "var(--on-dark)" }}>{article.title}</span>
          {article.isNew && <Badge label="Новое" color="#10b981" />}
          {article.popular && !article.isNew && <Badge label="Топ" color="#f59e0b" />}
        </div>
        {catTitle && <span className="text-xs" style={{ color: "var(--on-dark-soft)" }}>{catTitle}</span>}
      </div>
      <button onClick={e => { e.stopPropagation(); onToggleFav() }}
        className="p-1 rounded hover:bg-white/10 transition-colors shrink-0">
        <Star size={13} fill={isFav ? "#f59e0b" : "none"}
          style={{ color: isFav ? "#f59e0b" : "var(--on-dark-soft)" }} />
      </button>
      <ChevronRight size={13} className="shrink-0" style={{ color: "var(--on-dark-soft)" }} />
    </button>
  )
}

// ── Category card (large) ──────────────────────────────────────────────

function CategoryCard({ cat, onClick }: { cat: KbCategory; onClick: () => void }) {
  const lastUpdated = useMemo(() => {
    const dates = cat.articles.map(a => a.updatedAt).sort().reverse()
    if (!dates[0]) return ""
    const d = new Date(dates[0])
    const days = Math.round((Date.now() - d.getTime()) / 86_400_000)
    return days === 0 ? "сегодня" : days === 1 ? "вчера" : `${days} дн. назад`
  }, [cat])

  return (
    <button onClick={onClick}
      className="flex flex-col gap-3 p-4 rounded-xl text-left transition-all duration-150 hover:scale-[1.02] active:scale-[0.99]"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
          style={{ background: `${cat.color}18` }}>
          {cat.icon}
        </div>
        <span className="text-[10px] mt-1 shrink-0" style={{ color: "var(--on-dark-soft)" }}>
          {lastUpdated}
        </span>
      </div>
      <div>
        <div className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{cat.title}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--on-dark-soft)" }}>{cat.description}</div>
      </div>
      <div className="text-xs font-medium" style={{ color: cat.color }}>
        {cat.articles.length} статей →
      </div>
    </button>
  )
}

// ── Article View ───────────────────────────────────────────────────────

function ArticleView({ articleId, isFav, onToggleFav, onBack, onNavigate, onAiOpen }: {
  articleId: string
  isFav: boolean
  onToggleFav: () => void
  onBack: () => void
  onNavigate: (id: string) => void
  onAiOpen: () => void
}) {
  const data = useMemo(() => getArticleById(articleId), [articleId])
  const [rating, setRating] = useState<"up" | "down" | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [tourOpen, setTourOpen] = useState(false)
  const [tourStep, setTourStep] = useState(0)

  if (!data) return null
  const { category } = data

  return (
    <div className="max-w-2xl mx-auto">
      {/* Интерактивный тур */}
      {tourOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-lg overflow-hidden"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid var(--border)", background: "rgba(37,99,235,0.08)" }}>
              <div className="flex items-center gap-2">
                <GraduationCap size={16} style={{ color: "#2563eb" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>
                  Интерактивный тур
                </span>
              </div>
              <button onClick={() => { setTourOpen(false); setTourStep(0) }}
                className="p-1 hover:opacity-70"><X size={15} style={{ color: "var(--on-dark-soft)" }} /></button>
            </div>

            {/* Имитация экрана CRM */}
            <div className="p-4">
              <div className="rounded-xl overflow-hidden mb-4"
                style={{ background: "var(--card-2)", border: "1px solid var(--border)", aspectRatio: "16/9", position: "relative" }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl mb-2">{category.icon}</div>
                    <div className="text-xs" style={{ color: "var(--on-dark-soft)" }}>
                      Шаг {tourStep + 1} из {data.steps.length}
                    </div>
                  </div>
                </div>
                {/* Пульсирующий индикатор */}
                <div className="absolute bottom-4 right-4">
                  <div className="w-4 h-4 rounded-full animate-ping"
                    style={{ background: "rgba(37,99,235,0.4)" }} />
                  <div className="w-4 h-4 rounded-full absolute inset-0"
                    style={{ background: "#2563eb" }} />
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl mb-4"
                style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "#2563eb", color: "white" }}>{tourStep + 1}</div>
                <p className="text-sm" style={{ color: "var(--on-dark)" }}>{data.steps[tourStep].text}</p>
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => setTourStep(Math.max(0, tourStep - 1))}
                  disabled={tourStep === 0}
                  className="px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-30"
                  style={{ background: "var(--card-2)", color: "var(--on-dark)", border: "1px solid var(--border)" }}>
                  ← Назад
                </button>
                <span className="text-xs" style={{ color: "var(--on-dark-soft)" }}>
                  {tourStep + 1} / {data.steps.length}
                </span>
                {tourStep < data.steps.length - 1 ? (
                  <button onClick={() => setTourStep(tourStep + 1)}
                    className="px-4 py-2 rounded-lg text-sm"
                    style={{ background: "#2563eb", color: "white" }}>
                    Далее →
                  </button>
                ) : (
                  <button onClick={() => { setTourOpen(false); setTourStep(0) }}
                    className="px-4 py-2 rounded-lg text-sm"
                    style={{ background: "#10b981", color: "white" }}>
                    ✓ Готово
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5 text-sm flex-wrap" style={{ color: "var(--on-dark-soft)" }}>
        <button onClick={onBack} className="flex items-center gap-1 hover:opacity-70 transition-opacity">
          <ArrowLeft size={14} /> Назад
        </button>
        <ChevronRight size={12} />
        <span>{category.icon} {category.title}</span>
        <ChevronRight size={12} />
        <span className="truncate" style={{ color: "var(--on-dark)" }}>{data.title}</span>
      </div>

      {/* Title row */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {data.isNew && <Badge label="Новое" color="#10b981" />}
            {data.popular && <Badge label="Популярное" color="#f59e0b" />}
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--on-dark)" }}>{data.title}</h1>
          <div className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>
            Обновлено {new Date(data.updatedAt).toLocaleDateString("ru-RU")}
          </div>
        </div>
        <button onClick={onToggleFav}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs shrink-0 transition-colors"
          style={{
            background: isFav ? "rgba(245,158,11,0.12)" : "var(--card)",
            border: `1px solid ${isFav ? "rgba(245,158,11,0.3)" : "var(--border)"}`,
            color: isFav ? "#f59e0b" : "var(--on-dark-soft)",
          }}>
          <Star size={12} fill={isFav ? "#f59e0b" : "none"} /> {isFav ? "Избрано" : "В избранное"}
        </button>
      </div>

      {/* Steps */}
      <div className="space-y-2 mb-6">
        {data.steps.map((step, i) => (
          <div key={i} className="flex gap-3 p-4 rounded-xl"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
              style={{ background: "rgba(37,99,235,0.15)", color: "#2563eb" }}>{i + 1}</div>
            <div className="flex-1">
              <p className="text-sm" style={{ color: "var(--on-dark)" }}>{step.text}</p>
              {step.tip && (
                <div className="mt-2 flex items-start gap-2 p-2 rounded-lg"
                  style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                  <Zap size={11} className="shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
                  <span className="text-xs" style={{ color: "#f59e0b" }}>{step.tip}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* GIF / Video placeholder */}
      {data.hasMedia && (
        <div className="mb-6 rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
          <div className="flex items-center gap-2 px-4 py-2.5"
            style={{ borderBottom: "1px solid var(--border)", background: "rgba(37,99,235,0.06)" }}>
            <Video size={13} style={{ color: "#2563eb" }} />
            <span className="text-xs font-medium" style={{ color: "var(--on-dark)" }}>
              GIF / Видео — 30 секунд
            </span>
          </div>
          <div className="flex flex-col items-center justify-center gap-3 py-10"
            style={{ background: "var(--card-2)" }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.25)" }}>
              <Play size={22} style={{ color: "#2563eb" }} />
            </div>
            <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>
              Видеоинструкция скоро появится
            </span>
          </div>
        </div>
      )}

      {/* FAQ */}
      {data.faq && data.faq.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-semibold mb-3 px-1" style={{ color: "var(--on-dark-soft)" }}>ЧАСТЫЕ ВОПРОСЫ</div>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {data.faq.map((item, i) => (
              <div key={i} style={{ borderBottom: i < data.faq!.length - 1 ? "1px solid var(--border)" : undefined }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors">
                  <span className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{item.q}</span>
                  <ChevronRight size={14} className="shrink-0 transition-transform duration-200"
                    style={{ color: "var(--on-dark-soft)", transform: openFaq === i ? "rotate(90deg)" : "none" }} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-3">
                    <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tour + Rating */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <button onClick={() => { setTourStep(0); setTourOpen(true) }}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium flex-1 transition-all hover:scale-[1.01]"
          style={{ background: "rgba(37,99,235,0.1)", color: "#2563eb", border: "1px solid rgba(37,99,235,0.25)" }}>
          <GraduationCap size={15} /> Показать в интерфейсе
        </button>
        <button onClick={onAiOpen}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium flex-1 transition-all hover:scale-[1.01]"
          style={{ background: "rgba(236,72,153,0.1)", color: "#ec4899", border: "1px solid rgba(236,72,153,0.25)" }}>
          <Sparkles size={15} /> Спросить AI
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 p-5 rounded-xl mb-8"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {rating ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--on-dark-soft)" }}>
            <CheckCircle size={15} style={{ color: "#10b981" }} /> Спасибо за отзыв!
          </div>
        ) : (
          <>
            <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>Была ли статья полезной?</span>
            <div className="flex gap-3">
              {([["up", ThumbsUp, "Да, помогло"], ["down", ThumbsDown, "Нет"]] as const).map(([val, Icon, label]) => (
                <button key={val} onClick={() => setRating(val)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors"
                  style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Related */}
      {(() => {
        const related = category.articles.filter(a => a.id !== articleId).slice(0, 3)
        if (!related.length) return null
        return (
          <div className="mb-10">
            <div className="text-xs font-semibold mb-3 px-1" style={{ color: "var(--on-dark-soft)" }}>
              ЕЩЁ В «{category.title.toUpperCase()}»
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {related.map(a => (
                <button key={a.id} onClick={() => onNavigate(a.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                  style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--on-dark)" }}>{a.title}</span>
                  <ChevronRight size={13} style={{ color: "var(--on-dark-soft)" }} />
                </button>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Scenario View ──────────────────────────────────────────────────────

function ScenarioView({ scenarioId, onBack }: { scenarioId: string; onBack: () => void }) {
  const sc = useMemo(() => KB_SCENARIOS.find(s => s.id === scenarioId), [scenarioId])
  const [done, setDone] = useState<Set<number>>(new Set())
  if (!sc) return null
  const toggleDone = (i: number) => setDone(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack}
        className="flex items-center gap-1 text-sm mb-5 hover:opacity-70 transition-opacity"
        style={{ color: "var(--on-dark-soft)" }}>
        <ArrowLeft size={14} /> К сценариям
      </button>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)" }}>
          {sc.icon}
        </div>
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--on-dark)" }}>{sc.title}</h1>
          <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>{sc.summary}</p>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        {sc.steps.map((step, i) => (
          <div key={i} onClick={() => toggleDone(i)}
            className="flex gap-3 p-3.5 rounded-xl cursor-pointer transition-all select-none"
            style={{
              background: done.has(i) ? "rgba(16,185,129,0.06)" : "var(--card)",
              border: `1px solid ${done.has(i) ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
            }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all"
              style={{ background: done.has(i) ? "#10b981" : "rgba(37,99,235,0.15)" }}>
              {done.has(i)
                ? <CheckCircle size={13} className="text-white" />
                : <span className="text-xs font-bold" style={{ color: "#2563eb" }}>{i + 1}</span>}
            </div>
            <p className="text-sm flex-1" style={{ color: done.has(i) ? "var(--on-dark-soft)" : "var(--on-dark)" }}>
              {step}
            </p>
          </div>
        ))}
      </div>

      {done.size === sc.steps.length && (
        <div className="flex items-center gap-3 p-4 rounded-xl"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
          <CheckCircle size={16} style={{ color: "#10b981" }} />
          <span className="text-sm font-medium" style={{ color: "#10b981" }}>Все шаги выполнены!</span>
          <button onClick={() => setDone(new Set())} className="ml-auto hover:opacity-70">
            <RotateCcw size={13} style={{ color: "var(--on-dark-soft)" }} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── AI Chat Panel ──────────────────────────────────────────────────────

function AiPanel({ isOpen, onClose, onNavigate }: {
  isOpen: boolean
  onClose: () => void
  onNavigate: (id: string) => void
}) {
  const [messages, setMessages] = useState<Array<{
    role: "user" | "ai"; text: string
    links?: Array<{ id: string; title: string }>
    action?: string
  }>>([{ role: "ai", text: "Привет! Напишите вопрос — и я сразу отвечу. Без открытия статей." }])
  const [input, setInput] = useState("")
  const [ticketMode, setTicketMode] = useState(false)
  const [ticket, setTicket] = useState("")
  const [ticketSent, setTicketSent] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  const send = () => {
    const q = input.trim(); if (!q) return
    setInput("")
    setMessages(prev => [...prev, { role: "user", text: q }])
    setTimeout(() => {
      const res = aiAnswer(q)
      setMessages(prev => [...prev, { role: "ai", text: res.answer, links: res.links, action: res.action }])
    }, 350)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)", maxHeight: "80vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(236,72,153,0.15)" }}>
              <Sparkles size={13} style={{ color: "#ec4899" }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>AI-помощник</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>онлайн</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X size={15} style={{ color: "var(--on-dark-soft)" }} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "ai" ? (
                <div className="flex items-start gap-2 max-w-[92%]">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "rgba(236,72,153,0.15)" }}>
                    <Sparkles size={10} style={{ color: "#ec4899" }} />
                  </div>
                  <div>
                    <div className="px-3 py-2.5 rounded-2xl rounded-tl-none text-sm whitespace-pre-line"
                      style={{ background: "var(--card-2)", color: "var(--on-dark)", lineHeight: 1.6 }}>
                      {msg.text}
                    </div>
                    {(msg.links?.length || msg.action) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.links?.map(l => (
                          <button key={l.id} onClick={() => { onClose(); onNavigate(l.id) }}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors hover:opacity-80"
                            style={{ background: "rgba(37,99,235,0.12)", color: "#60a5fa", border: "1px solid rgba(37,99,235,0.2)" }}>
                            <BookOpen size={10} /> {l.title}
                          </button>
                        ))}
                        {msg.action && (
                          <button className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors"
                            style={{ background: "rgba(37,99,235,0.2)", color: "#2563eb", border: "1px solid rgba(37,99,235,0.3)" }}>
                            → {msg.action}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="px-3 py-2.5 rounded-2xl rounded-tr-none text-sm max-w-[80%]"
                  style={{ background: "rgba(37,99,235,0.2)", color: "var(--on-dark)" }}>
                  {msg.text}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Ticket form */}
        {ticketMode && (
          <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--border)" }}>
            {ticketSent ? (
              <div className="flex items-center gap-2 py-3 text-sm" style={{ color: "#10b981" }}>
                <CheckCircle size={14} /> Обращение отправлено! Ответим в течение 2 часов.
              </div>
            ) : (
              <div className="pt-3 space-y-2">
                <div className="text-xs font-medium" style={{ color: "var(--on-dark-soft)" }}>Создать обращение в поддержку</div>
                <textarea value={ticket} onChange={e => setTicket(e.target.value)}
                  placeholder="Опишите проблему подробно..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                  style={{ background: "var(--card-2)", color: "var(--on-dark)", border: "1px solid var(--border)" }} />
                <div className="flex gap-2">
                  <button onClick={() => setTicketMode(false)}
                    className="px-3 py-2 rounded-lg text-xs flex-1"
                    style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
                    Отмена
                  </button>
                  <button onClick={() => { setTicketSent(true) }}
                    disabled={!ticket.trim()}
                    className="px-3 py-2 rounded-lg text-xs flex-1 disabled:opacity-40"
                    style={{ background: "#2563eb", color: "white" }}>
                    Отправить
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input */}
        {!ticketMode && (
          <div className="p-3 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && send()}
                placeholder="Как вернуть деньги клиенту?"
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--card-2)", color: "var(--on-dark)", border: "1px solid var(--border)" }}
                autoFocus />
              <button onClick={send} disabled={!input.trim()}
                className="px-3 py-2 rounded-xl disabled:opacity-40"
                style={{ background: "#2563eb" }}>
                <Send size={13} className="text-white" />
              </button>
            </div>
            <button onClick={() => setTicketMode(true)}
              className="w-full text-xs py-1.5 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: "var(--on-dark-soft)", border: "1px solid var(--border)" }}>
              AI не помог? Создать обращение в поддержку →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Videos Tab ─────────────────────────────────────────────────────────

function VideosTab() {
  return (
    <div className="space-y-3">
      {KB_VIDEOS.map(v => (
        <div key={v.id}
          className="flex gap-4 p-4 rounded-xl"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          {/* Thumbnail */}
          <div className="w-24 h-16 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden"
            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)" }}>
            <Play size={20} style={{ color: "#2563eb" }} />
            <div className="absolute bottom-1 right-1 text-[10px] px-1 py-0.5 rounded"
              style={{ background: "rgba(0,0,0,0.6)", color: "white" }}>{v.duration}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium mb-1" style={{ color: "var(--on-dark)" }}>{v.title}</div>
            <div className="text-xs mb-2" style={{ color: "var(--on-dark-soft)" }}>{v.description}</div>
            <div className="text-[10px] px-2 py-0.5 rounded inline-block"
              style={{ background: "rgba(37,99,235,0.1)", color: "#60a5fa" }}>
              {v.category}
            </div>
          </div>
          <button className="shrink-0 self-center px-3 py-2 rounded-lg text-xs transition-colors"
            style={{ background: "rgba(37,99,235,0.12)", color: "#2563eb", border: "1px solid rgba(37,99,235,0.2)" }}>
            Смотреть
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────

export function KnowledgeClient() {
  const [view, setView] = useState<View>({ kind: "home" })
  const [tab, setTab] = useState<Tab>("popular")
  const [query, setQuery] = useState("")
  const [aiOpen, setAiOpen] = useState(false)
  const { favs, toggle: toggleFav } = useFavorites()
  const { history, push: pushHistory } = useHistory()

  const searchResults = useMemo(() => query.length > 1 ? searchKnowledge(query) : [], [query])
  const popular = useMemo(() => getPopularArticles(), [])
  const newArticles = useMemo(() => getNewArticles(), [])

  const favArticles = useMemo(() => {
    const all = KB_CATEGORIES.flatMap(cat =>
      cat.articles.map(a => ({ ...a, categoryId: cat.id, categoryTitle: cat.title, categoryIcon: cat.icon })))
    return all.filter(a => favs.has(a.id))
  }, [favs])

  const historyArticles = useMemo(() => {
    const all = KB_CATEGORIES.flatMap(cat =>
      cat.articles.map(a => ({ ...a, categoryId: cat.id, categoryTitle: cat.title, categoryIcon: cat.icon })))
    return history.map(id => all.find(a => a.id === id)).filter(Boolean) as typeof all
  }, [history])

  // Last update
  const lastUpdate = useMemo(() => {
    const allDates = KB_CATEGORIES.flatMap(cat => cat.articles.map(a => a.updatedAt)).sort().reverse()
    if (!allDates[0]) return ""
    const days = Math.round((Date.now() - new Date(allDates[0]).getTime()) / 86_400_000)
    return days === 0 ? "сегодня" : days === 1 ? "вчера" : `${days} дня назад`
  }, [])

  function goArticle(id: string) {
    pushHistory(id)
    setView({ kind: "article", articleId: id })
    setQuery("")
    window.scrollTo(0, 0)
  }

  function goBack() {
    if (view.kind === "article") {
      const art = getArticleById(view.articleId)
      if (art) { setView({ kind: "category", catId: art.category.id }); return }
    }
    setView({ kind: "home" })
    window.scrollTo(0, 0)
  }

  const TABS: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: "popular",   label: "Популярное", icon: <Zap size={12} /> },
    { key: "favorites", label: "Избранное",  icon: <Star size={12} /> },
    { key: "new",       label: "Новое",       icon: <Sparkles size={12} /> },
    { key: "videos",    label: "Видео",       icon: <Video size={12} /> },
    { key: "scenarios", label: "Сценарии",    icon: <Play size={12} /> },
  ]

  // ── Scenario view ──────────────────────────────────────────────────
  if (view.kind === "scenario") {
    return (
      <>
        <AiPanel isOpen={aiOpen} onClose={() => setAiOpen(false)} onNavigate={goArticle} />
        <ScenarioView scenarioId={view.scenarioId}
          onBack={() => { setView({ kind: "home" }); setTab("scenarios") }} />
        <FloatingAiBtn onClick={() => setAiOpen(true)} />
      </>
    )
  }

  // ── Category view ──────────────────────────────────────────────────
  if (view.kind === "category") {
    const cat = KB_CATEGORIES.find(c => c.id === view.catId)
    if (!cat) return null
    return (
      <>
        <AiPanel isOpen={aiOpen} onClose={() => setAiOpen(false)} onNavigate={goArticle} />
        <div>
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setView({ kind: "home" })}
              className="flex items-center gap-1 text-sm hover:opacity-70 transition-opacity"
              style={{ color: "var(--on-dark-soft)" }}>
              <ArrowLeft size={14} /> Назад
            </button>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xl"
              style={{ background: `${cat.color}18` }}>{cat.icon}</div>
            <div>
              <div className="text-base font-bold" style={{ color: "var(--on-dark)" }}>{cat.title}</div>
              <div className="text-xs" style={{ color: "var(--on-dark-soft)" }}>{cat.articles.length} статей</div>
            </div>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {cat.articles.map(a => (
              <ArticleRow key={a.id} article={a}
                isFav={favs.has(a.id)} onToggleFav={() => toggleFav(a.id)} onClick={() => goArticle(a.id)} />
            ))}
          </div>
        </div>
        <FloatingAiBtn onClick={() => setAiOpen(true)} />
      </>
    )
  }

  // ── Article view ───────────────────────────────────────────────────
  if (view.kind === "article") {
    return (
      <>
        <AiPanel isOpen={aiOpen} onClose={() => setAiOpen(false)} onNavigate={goArticle} />
        <ArticleView articleId={view.articleId}
          isFav={favs.has(view.articleId)} onToggleFav={() => toggleFav(view.articleId)}
          onBack={goBack} onNavigate={goArticle} onAiOpen={() => setAiOpen(true)} />
        <FloatingAiBtn onClick={() => setAiOpen(true)} />
      </>
    )
  }

  // ── Home view ──────────────────────────────────────────────────────
  return (
    <>
      <AiPanel isOpen={aiOpen} onClose={() => setAiOpen(false)} onNavigate={goArticle} />

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--on-dark)" }}>База знаний</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--on-dark-soft)" }}>
            Инструкции, сценарии и ответы на вопросы
          </p>
        </div>
        {lastUpdate && (
          <div className="text-right shrink-0">
            <div className="text-[10px] mb-0.5" style={{ color: "var(--on-dark-soft)" }}>Последнее обновление</div>
            <div className="text-xs font-medium" style={{ color: "var(--on-dark)" }}>{lastUpdate}</div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--on-dark-soft)" }} />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Поиск по вопросам..."
          className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }} />
        {query && (
          <button onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70">
            <X size={14} style={{ color: "var(--on-dark-soft)" }} />
          </button>
        )}
      </div>

      {/* Search Results */}
      {query.length > 1 ? (
        <div className="mb-6">
          {searchResults.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12" style={{ color: "var(--on-dark-soft)" }}>
              <AlertCircle size={22} />
              <p className="text-sm">Ничего не найдено по «{query}»</p>
              <button onClick={() => setAiOpen(true)}
                className="text-sm px-4 py-2 rounded-xl mt-1"
                style={{ background: "rgba(236,72,153,0.1)", color: "#ec4899", border: "1px solid rgba(236,72,153,0.2)" }}>
                Спросить AI
              </button>
            </div>
          ) : (
            <>
              <div className="text-xs mb-2" style={{ color: "var(--on-dark-soft)" }}>Найдено: {searchResults.length}</div>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {searchResults.map(a => (
                  <ArticleRow key={a.id} article={a}
                    catIcon={a.categoryIcon} catTitle={a.categoryTitle}
                    isFav={favs.has(a.id)} onToggleFav={() => toggleFav(a.id)}
                    onClick={() => goArticle(a.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all shrink-0"
                style={{
                  background: tab === t.key ? "#2563eb" : "var(--card)",
                  color: tab === t.key ? "#fff" : "var(--on-dark-soft)",
                  border: `1px solid ${tab === t.key ? "#2563eb" : "var(--border)"}`,
                }}>
                {t.icon} {t.label}
              </button>
            ))}
            <button onClick={() => setAiOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap shrink-0 transition-all"
              style={{ background: "rgba(236,72,153,0.1)", color: "#ec4899", border: "1px solid rgba(236,72,153,0.25)" }}>
              <Sparkles size={12} /> Спросить AI
            </button>
          </div>

          {/* Popular */}
          {tab === "popular" && (
            <div className="space-y-6">
              {historyArticles.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium mb-3"
                    style={{ color: "var(--on-dark-soft)" }}>
                    <Clock size={11} /> НЕДАВНО ПРОСМОТРЕННЫЕ
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    {historyArticles.map(a => (
                      <ArticleRow key={a.id} article={a}
                        catIcon={a.categoryIcon} catTitle={a.categoryTitle}
                        isFav={favs.has(a.id)} onToggleFav={() => toggleFav(a.id)}
                        onClick={() => goArticle(a.id)} />
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium mb-3"
                  style={{ color: "var(--on-dark-soft)" }}>
                  <Zap size={11} /> ПОПУЛЯРНЫЕ СТАТЬИ
                </div>
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  {popular.map(a => (
                    <ArticleRow key={a.id} article={a}
                      catIcon={a.categoryIcon} catTitle={a.categoryTitle}
                      isFav={favs.has(a.id)} onToggleFav={() => toggleFav(a.id)}
                      onClick={() => goArticle(a.id)} />
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium mb-3"
                  style={{ color: "var(--on-dark-soft)" }}>
                  <BookOpen size={11} /> ВСЕ КАТЕГОРИИ
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {KB_CATEGORIES.map(cat => (
                    <CategoryCard key={cat.id} cat={cat}
                      onClick={() => setView({ kind: "category", catId: cat.id })} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Favorites */}
          {tab === "favorites" && (
            favArticles.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16" style={{ color: "var(--on-dark-soft)" }}>
                <Star size={26} />
                <p className="text-sm">Избранных статей пока нет</p>
                <p className="text-xs text-center max-w-xs">
                  Нажмите ⭐ рядом с любой статьёй
                </p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {favArticles.map(a => (
                  <ArticleRow key={a.id} article={a}
                    catIcon={a.categoryIcon} catTitle={a.categoryTitle}
                    isFav={true} onToggleFav={() => toggleFav(a.id)}
                    onClick={() => goArticle(a.id)} />
                ))}
              </div>
            )
          )}

          {/* New */}
          {tab === "new" && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {newArticles.map(a => (
                <ArticleRow key={a.id} article={a}
                  catIcon={a.categoryIcon} catTitle={a.categoryTitle}
                  isFav={favs.has(a.id)} onToggleFav={() => toggleFav(a.id)}
                  onClick={() => goArticle(a.id)} />
              ))}
            </div>
          )}

          {/* Videos */}
          {tab === "videos" && <VideosTab />}

          {/* Scenarios */}
          {tab === "scenarios" && (
            <div className="space-y-3">
              <p className="text-sm mb-4" style={{ color: "var(--on-dark-soft)" }}>
                Реальные ситуации — пошаговые решения. Выберите свою:
              </p>
              {KB_SCENARIOS.map(sc => (
                <button key={sc.id}
                  onClick={() => setView({ kind: "scenario", scenarioId: sc.id })}
                  className="w-full flex items-center gap-3 p-4 rounded-xl text-left hover:scale-[1.01] transition-all"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <span className="text-2xl shrink-0">{sc.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{sc.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--on-dark-soft)" }}>{sc.summary}</div>
                  </div>
                  <ChevronRight size={14} className="shrink-0" style={{ color: "var(--on-dark-soft)" }} />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <FloatingAiBtn onClick={() => setAiOpen(true)} />
    </>
  )
}

function FloatingAiBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-full shadow-xl transition-all hover:scale-105 z-40"
      style={{ background: "#ec4899", color: "white" }}>
      <Sparkles size={14} />
      <span className="text-sm font-medium">Спросить AI</span>
    </button>
  )
}
