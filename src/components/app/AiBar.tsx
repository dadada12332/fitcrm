"use client"

import { Sparkles, ArrowRight } from "lucide-react"

export function AiBar() {
  return (
    <div
      className="flex items-center gap-3 rounded-lg p-2 pl-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: "#2563eb" }} />
      <input
        disabled
        placeholder="Спросите AI-помощника о показателях клуба, клиентах, посещаемости или остатках на складе."
        className="flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
        style={{ color: "var(--on-dark)" }}
      />
      <button
        disabled
        className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 disabled:opacity-90"
        style={{ background: "var(--on-dark)", color: "var(--bg)" }}
        aria-label="Отправить"
      >
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}
