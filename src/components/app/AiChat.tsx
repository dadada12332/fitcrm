"use client"

import { useState, useRef } from "react"
import { ArrowUp } from "lucide-react"

export function AiChat() {
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const hasText = value.trim().length > 0

  return (
    <div
      className="rounded-lg p-3"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div
        className="flex items-center gap-2 rounded-lg px-3"
        style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
      >
        {/* AI icon */}
        <span className="text-base flex-shrink-0 select-none">✨</span>

        {/* Input */}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hasText) setValue("")
          }}
          placeholder="Спросите ИИ о состоянии клуба..."
          className="flex-1 h-10 text-sm bg-transparent outline-none placeholder:text-[#94a3b8]"
          style={{ color: "var(--on-dark)" }}
        />

        {/* Send button */}
        <button
          onClick={() => { if (hasText) setValue("") }}
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
          style={{
            background: hasText ? "#0f172a" : "var(--border)",
            cursor: hasText ? "pointer" : "default",
          }}
        >
          <ArrowUp
            className="w-3.5 h-3.5"
            style={{ color: hasText ? "white" : "var(--gray-muted)" }}
          />
        </button>
      </div>
    </div>
  )
}
