"use client"

import { useCallback, useSyncExternalStore } from "react"
import Link from "next/link"
import { Cookie, X } from "lucide-react"

const NOTICE_KEY = "fitcrm_cookie_notice_v1"
const NOTICE_EVENT = "fitcrm:cookie-notice"

export function CookieNotice() {
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener("storage", onStoreChange)
    window.addEventListener(NOTICE_EVENT, onStoreChange)
    return () => {
      window.removeEventListener("storage", onStoreChange)
      window.removeEventListener(NOTICE_EVENT, onStoreChange)
    }
  }, [])
  const visible = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(NOTICE_KEY) !== "acknowledged"
      } catch {
        return true
      }
    },
    () => false,
  )

  function acknowledge() {
    try {
      localStorage.setItem(NOTICE_KEY, "acknowledged")
    } catch {}
    window.dispatchEvent(new Event(NOTICE_EVENT))
  }

  if (!visible) return null

  return (
    <section
      aria-label="Уведомление об использовании cookies"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-[720px] rounded-2xl border border-border bg-card/95 p-4 text-card-foreground shadow-2xl backdrop-blur-xl sm:bottom-5 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Cookie className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Cookies для работы FitCRM</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Мы используем только необходимые cookies для входа и безопасности, а также функциональные настройки.
            Рекламных и аналитических трекеров сейчас нет. Подробнее — в{" "}
            <Link href="/cookies" className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/75">
              Cookie Policy
            </Link>{" "}
            и{" "}
            <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/75">
              Политике конфиденциальности
            </Link>.
          </p>
          <button
            type="button"
            onClick={acknowledge}
            className="mt-3 h-9 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Понятно
          </button>
        </div>
        <button
          type="button"
          onClick={acknowledge}
          aria-label="Закрыть уведомление"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
