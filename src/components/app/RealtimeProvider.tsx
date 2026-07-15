"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

// Таблицы, изменения которых должны мгновенно отражаться на всех открытых страницах клуба.
const TABLES = ["clients", "subscriptions", "payments", "visits", "inventory", "products", "staff"] as const

/**
 * Шина мгновенной синхронизации. Один канал на клуб: любое изменение в ключевых
 * таблицах (ручное, из AI, с другого устройства, из Platform Admin) → дебаунс-refresh
 * серверных компонентов текущего маршрута. Пользователь не нажимает F5.
 */
export function RealtimeProvider({ clubId }: { clubId: string }) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!clubId) return
    const supabase = createClient()

    const scheduleRefresh = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => router.refresh(), 600)
    }

    const channel = supabase.channel(`club-${clubId}`)
    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `club_id=eq.${clubId}` }, scheduleRefresh)
    }
    // clubs фильтруется по id, а не club_id
    channel.on("postgres_changes", { event: "*", schema: "public", table: "clubs", filter: `id=eq.${clubId}` }, scheduleRefresh)
    channel.subscribe()

    return () => {
      if (timer.current) clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [clubId, router])

  return null
}
