"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { messages, LANGS, type Lang, type Messages } from "./messages"

const STORAGE_KEY = "fitcrm_lang"

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: Messages }
const LangContext = createContext<Ctx | null>(null)

export function LangProvider({ children }: { children: React.ReactNode }) {
  // Стартуем с "ru" (совпадает с серверным рендером → нет hydration mismatch),
  // затем на клиенте читаем сохранённый выбор.
  const [lang, setLangState] = useState<Lang>("ru")

  useEffect(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) as Lang | null
    if (stored && LANGS.includes(stored) && stored !== "ru") setLangState(stored)
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
      document.cookie = `${STORAGE_KEY}=${l}; path=/; max-age=31536000; samesite=lax`
      document.documentElement.lang = l
    } catch {}
  }, [])

  return <LangContext.Provider value={{ lang, setLang, t: messages[lang] }}>{children}</LangContext.Provider>
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error("useLang must be used within LangProvider")
  return ctx
}

// Короткий доступ к текущему словарю
export function useT() {
  return useLang().t
}
