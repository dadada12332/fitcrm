"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { initDiagnostics, setDiagnosticsRoute } from "@/lib/diagnostics"

/** Включает чёрный ящик диагностики и трекает текущий route (для client_meta обращений). */
export function DiagnosticsProvider() {
  const pathname = usePathname()
  useEffect(() => { initDiagnostics() }, [])
  useEffect(() => { setDiagnosticsRoute(pathname) }, [pathname])
  return null
}
