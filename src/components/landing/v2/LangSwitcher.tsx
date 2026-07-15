"use client"

import { useState, useRef, useEffect } from "react"
import { Globe, Check } from "lucide-react"
import { useLang } from "@/lib/i18n/context"
import { LANGS, LANG_LABELS, LANG_SHORT } from "@/lib/i18n/messages"

export function LangSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-label="Язык"
        className="flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-medium transition-colors"
        style={{ color: "#0a0a0a", border: "1px solid rgba(0,0,0,0.1)", background: open ? "rgba(0,0,0,0.04)" : "transparent" }}>
        <Globe className="w-4 h-4" strokeWidth={1.75} />
        {LANG_SHORT[lang]}
      </button>

      {open && (
        <div className={`absolute ${compact ? "left-0" : "right-0"} mt-2 w-[168px] rounded-xl p-1.5 z-50`}
          style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.1)", boxShadow: "0 16px 40px -12px rgba(0,0,0,0.2)" }}>
          {LANGS.map((l) => (
            <button key={l} onClick={() => { setLang(l); setOpen(false) }}
              className="flex items-center justify-between w-full px-3 h-10 rounded-lg text-[14px] transition-colors"
              style={{ color: "#0a0a0a", background: lang === l ? "rgba(0,101,252,0.06)" : "transparent" }}
              onMouseEnter={(e) => { if (lang !== l) e.currentTarget.style.background = "rgba(0,0,0,0.04)" }}
              onMouseLeave={(e) => { if (lang !== l) e.currentTarget.style.background = "transparent" }}>
              {LANG_LABELS[l]}
              {lang === l && <Check className="w-4 h-4" style={{ color: "#0065fc" }} strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
