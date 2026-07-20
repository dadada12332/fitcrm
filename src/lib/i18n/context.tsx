"use client"

import { createContext, useContext, useSyncExternalStore, useCallback } from "react"
import { messages, LANGS, type Lang, type Messages } from "./messages"

const STORAGE_KEY = "fitcrm_lang"
const LANGUAGE_EVENT = "fitcrm:language"

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: Messages }
const LangContext = createContext<Ctx | null>(null)

export function LangProvider({ children }: { children: React.ReactNode }) {
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener("storage", onStoreChange)
    window.addEventListener(LANGUAGE_EVENT, onStoreChange)
    return () => {
      window.removeEventListener("storage", onStoreChange)
      window.removeEventListener(LANGUAGE_EVENT, onStoreChange)
    }
  }, [])
  const lang = useSyncExternalStore<Lang>(
    subscribe,
    () => {
      const stored = localStorage.getItem(STORAGE_KEY) as Lang | null
      return stored && LANGS.includes(stored) ? stored : "ru"
    },
    () => "ru" as Lang,
  )

  const setLang = useCallback((l: Lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, l)
      document.cookie = `${STORAGE_KEY}=${l}; path=/; max-age=31536000; samesite=lax`
      document.documentElement.lang = l
      window.dispatchEvent(new Event(LANGUAGE_EVENT))
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
