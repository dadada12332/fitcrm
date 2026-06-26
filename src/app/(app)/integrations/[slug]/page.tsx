import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { IntegrationManage } from "@/components/app/IntegrationManage"
import { DEFAULT_TG_SETTINGS, type TelegramSettings } from "@/app/(app)/integrations/types"

const META: Record<string, { label: string; description: string; color: string }> = {
  telegram: { label: "Telegram Bot", description: "Личный кабинет клиентов, QR-чекин и уведомления", color: "#2AABEE" },
  click:    { label: "Click",        description: "Приём онлайн-платежей через Click",               color: "#16a34a" },
  payme:    { label: "Payme",        description: "Приём онлайн-платежей через Payme",               color: "#7c3aed" },
}

export default async function IntegrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const meta = META[slug]
  if (!meta) notFound()

  const supabase = await createClient()
  const club = await getCurrentClub()

  let connected = false
  let currentValue = ""
  let clientCount = 0
  let subscribers = 0
  let tgSettings: TelegramSettings = DEFAULT_TG_SETTINGS
  let botUsername = ""
  let botFirstName = ""
  let connectedAt: string | null = null

  if (club) {
    const { data } = await supabase
      .from("clubs")
      .select("tg_token, settings")
      .eq("id", club.clubId)
      .single()

    if (data) {
      if (slug === "telegram" && data.tg_token) {
        connected = true
        currentValue = data.tg_token as string
        const settings = data.settings as any
        const tgBot = settings?.tg_bot ?? {}
        botUsername = tgBot.username ?? ""
        botFirstName = tgBot.firstName ?? "Telegram Bot"
        connectedAt = tgBot.connected_at ?? null
        tgSettings = { ...DEFAULT_TG_SETTINGS, ...(settings?.tg_settings ?? {}) }
      } else {
        const integrations = (data.settings as any)?.integrations ?? {}
        if (integrations[slug]) {
          connected = true
          currentValue = integrations[slug]
        }
      }
    }

    if (connected) {
      const { count } = await supabase
        .from("clients").select("id", { count: "exact", head: true }).eq("club_id", club.clubId)
      clientCount = count ?? 0

      if (slug === "telegram") {
        const { count: subs } = await supabase
          .from("clients").select("id", { count: "exact", head: true })
          .eq("club_id", club.clubId).not("telegram_id", "is", null)
        subscribers = subs ?? 0
      }
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--on-dark-soft)" }}>
        <Link href="/integrations" className="flex items-center gap-1 hover:underline">
          <ArrowLeft size={14} />
          Интеграции
        </Link>
        <span>/</span>
        <span style={{ color: "var(--on-dark)" }}>{meta.label}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
          style={{ background: meta.color }}>
          {meta.label[0]}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>
            {meta.label}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--on-dark-soft)" }}>{meta.description}</p>
        </div>
        <span className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full"
          style={connected
            ? { background: "rgba(22,163,74,0.12)", color: "#16a34a" }
            : { background: "var(--card-2)", color: "var(--on-dark-soft)", border: "1px solid var(--border)" }}>
          {connected ? <><CheckCircle2 size={14} />Подключено</> : <><Circle size={14} />Не подключено</>}
        </span>
      </div>

      {/* Management panel */}
      <IntegrationManage
        slug={slug}
        label={meta.label}
        color={meta.color}
        connected={connected}
        currentValue={currentValue}
        clientCount={clientCount}
        subscribers={subscribers}
        tgSettings={tgSettings}
        botUsername={botUsername}
        botFirstName={botFirstName}
        connectedAt={connectedAt}
      />
    </div>
  )
}
