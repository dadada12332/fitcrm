"use client"

import { useState, useRef, useEffect } from "react"
import { X, ArrowUp, Sparkles } from "lucide-react"

export function AiFloatButton() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Привет! Я ваш AI-ассистент. Спросите меня о состоянии клуба, клиентах или выручке." },
  ])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  function send() {
    const text = value.trim()
    if (!text) return
    setValue("")
    setMessages((m) => [
      ...m,
      { role: "user", text },
      { role: "ai", text: "Функция в разработке. Скоро AI сможет анализировать данные вашего клуба в реальном времени." },
    ])
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 h-11 px-4 rounded-full text-sm font-medium text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", boxShadow: "0 4px 20px rgba(99,102,241,0.4)" }}
        >
          <Sparkles className="w-4 h-4" />
          Спросить AI
        </button>
      )}

      {/* Drawer */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed bottom-6 right-6 z-50 w-[380px] rounded-2xl flex flex-col overflow-hidden"
            style={{
              height: 480,
              background: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", borderBottom: "none" }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white" />
                <span className="text-sm font-semibold text-white">AI Ассистент</span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/20"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "ai" && (
                    <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 text-xs"
                      style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "white" }}>
                      ✦
                    </span>
                  )}
                  <div
                    className="max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                    style={{
                      background: msg.role === "user"
                        ? "linear-gradient(135deg,#6366f1,#a855f7)"
                        : "var(--card-2)",
                      color: msg.role === "user" ? "white" : "var(--on-dark)",
                      borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      border: msg.role === "ai" ? "1px solid var(--border)" : "none",
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="px-3 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") send() }}
                  placeholder="Спросите о клубе..."
                  className="flex-1 h-10 text-sm bg-transparent outline-none"
                  style={{ color: "var(--on-dark)" }}
                />
                <button
                  onClick={send}
                  disabled={!value.trim()}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                  style={{ background: value.trim() ? "linear-gradient(135deg,#6366f1,#a855f7)" : "var(--border)" }}
                >
                  <ArrowUp className="w-3.5 h-3.5" style={{ color: value.trim() ? "white" : "var(--gray-muted)" }} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
