"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Paperclip, Command, SendIcon, LoaderIcon, XIcon,
  TrendingUp, Users, CalendarClock, Package, UserPlus, PlusIcon,
} from "lucide-react"

type Cmd = { icon: React.ReactNode; label: string; description: string; prefix: string; query?: string; insert?: string }

const COMMANDS: Cmd[] = [
  { icon: <TrendingUp className="w-4 h-4" />, label: "Выручка", description: "за вчера", prefix: "/выручка", query: "выручка за вчера" },
  { icon: <Users className="w-4 h-4" />, label: "Должники", description: "кто должен", prefix: "/должники", query: "покажи должников" },
  { icon: <CalendarClock className="w-4 h-4" />, label: "Истекающие", description: "заканчивается абонемент", prefix: "/истекают", query: "у кого заканчивается абонемент" },
  { icon: <Package className="w-4 h-4" />, label: "Топ продаж", description: "лучшие товары", prefix: "/топ", query: "топ продаж за месяц" },
  { icon: <UserPlus className="w-4 h-4" />, label: "Добавить клиента", description: "новый клиент", prefix: "/клиент", insert: "добавить клиента " },
  { icon: <PlusIcon className="w-4 h-4" />, label: "Создать товар", description: "новый товар", prefix: "/товар", insert: "создай товар " },
]

function useAutoResize(min: number, max: number) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const adjust = useCallback((reset?: boolean) => {
    const ta = ref.current; if (!ta) return
    if (reset) { ta.style.height = `${min}px`; return }
    ta.style.height = `${min}px`
    ta.style.height = `${Math.max(min, Math.min(ta.scrollHeight, max))}px`
  }, [min, max])
  useEffect(() => { if (ref.current) ref.current.style.height = `${min}px` }, [min])
  return { ref, adjust }
}

export function AiComposer({ onSend, pending, autoFocus }: {
  onSend: (text: string, image: string | null) => void
  pending: boolean
  autoFocus?: boolean
}) {
  const [value, setValue] = useState("")
  const [image, setImage] = useState<{ name: string; url: string } | null>(null)
  const [focused, setFocused] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [active, setActive] = useState(-1)
  const fileRef = useRef<HTMLInputElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const { ref: taRef, adjust } = useAutoResize(56, 200)

  const filtered = value.startsWith("/") && !value.includes(" ")
    ? COMMANDS.filter((c) => c.prefix.startsWith(value.toLowerCase()))
    : COMMANDS

  useEffect(() => {
    if (value.startsWith("/") && !value.includes(" ")) { setShowPalette(true); setActive(filtered.length ? 0 : -1) }
    else setShowPalette(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const btn = document.querySelector("[data-cmd-btn]")
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node) && !btn?.contains(e.target as Node)) setShowPalette(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader(); r.onload = () => setImage({ name: f.name, url: String(r.result) }); r.readAsDataURL(f)
  }

  function runCommand(c: Cmd) {
    setShowPalette(false)
    if (c.query) { doSend(c.query) }
    else if (c.insert) { setValue(c.insert); setTimeout(() => taRef.current?.focus(), 0); adjust() }
  }

  function doSend(text?: string) {
    const content = (text ?? value).trim()
    if ((!content && !image) || pending) return
    onSend(content, image?.url ?? null)
    setValue(""); setImage(null); adjust(true)
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showPalette && filtered.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((p) => (p < filtered.length - 1 ? p + 1 : 0)); return }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((p) => (p > 0 ? p - 1 : filtered.length - 1)); return }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); if (active >= 0) runCommand(filtered[active]); return }
      if (e.key === "Escape") { e.preventDefault(); setShowPalette(false); return }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend() }
  }

  return (
    <div className="w-full relative">
      <motion.div
        className="relative rounded-2xl border overflow-visible"
        style={{ background: "color-mix(in srgb, var(--card) 78%, transparent)", backdropFilter: "blur(14px)", borderColor: focused ? "rgba(124,58,237,0.45)" : "var(--border)", boxShadow: focused ? "0 8px 40px rgba(124,58,237,0.10)" : "0 6px 24px rgba(0,0,0,0.05)" }}
        initial={{ scale: 0.99, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3 }}
      >
        {/* Командная палитра */}
        <AnimatePresence>
          {showPalette && filtered.length > 0 && (
            <motion.div ref={paletteRef}
              className="absolute left-3 right-3 bottom-full mb-2 rounded-xl overflow-hidden z-50"
              style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.15 }}>
              <div className="py-1">
                {filtered.map((c, i) => (
                  <div key={c.prefix} onClick={() => runCommand(c)}
                    className={cn("flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition-colors", active === i ? "" : "")}
                    style={{ background: active === i ? "var(--card-2)" : "transparent", color: "var(--on-dark)" }}
                    onMouseEnter={() => setActive(i)}>
                    <span style={{ color: "var(--on-dark-soft)" }}>{c.icon}</span>
                    <span className="font-medium">{c.label}</span>
                    <span className="text-xs" style={{ color: "var(--gray-muted)" }}>{c.description}</span>
                    <span className="ml-auto text-xs" style={{ color: "var(--gray-muted)" }}>{c.prefix}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Превью фото */}
        <AnimatePresence>
          {image && (
            <motion.div className="flex items-center gap-2 px-4 pt-3" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.name} className="w-11 h-11 rounded-lg object-cover" />
              <span className="text-xs truncate flex-1" style={{ color: "var(--on-dark-soft)" }}>{image.name}</span>
              <button onClick={() => setImage(null)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"><XIcon className="w-3.5 h-3.5" style={{ color: "var(--gray-muted)" }} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <textarea
          ref={taRef} value={value} autoFocus={autoFocus}
          onChange={(e) => { setValue(e.target.value); adjust() }}
          onKeyDown={onKey} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          rows={1} placeholder="Спросите или дайте команду… (/ — быстрые команды)"
          className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm outline-none"
          style={{ color: "var(--on-dark)", overflow: "hidden" }}
        />

        <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-1">
          <div className="flex items-center gap-1">
            <motion.button type="button" whileTap={{ scale: 0.92 }} onClick={() => fileRef.current?.click()} title="Прикрепить фото"
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "var(--on-dark-soft)" }}>
              <Paperclip className="w-4 h-4" />
            </motion.button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
            <motion.button type="button" data-cmd-btn whileTap={{ scale: 0.92 }} onClick={(e) => { e.stopPropagation(); setShowPalette((p) => !p); setValue((v) => (v.startsWith("/") ? v : "/")) }}
              title="Команды" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              style={{ color: showPalette ? "#7c3aed" : "var(--on-dark-soft)", background: showPalette ? "color-mix(in srgb,#7c3aed 12%,transparent)" : "transparent" }}>
              <Command className="w-4 h-4" />
            </motion.button>
          </div>
          <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => doSend()} disabled={pending || (!value.trim() && !image)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ background: "#2563eb" }}>
            {pending ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <SendIcon className="w-4 h-4" />}
            Отправить
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}
