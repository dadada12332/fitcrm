import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getCurrentClub } from "@/lib/club"
import { IntegrationManage } from "@/components/app/IntegrationManage"
import { DEFAULT_TG_SETTINGS, type TelegramSettings } from "@/app/(app)/integrations/types"
import { resolveAudienceOptions, getRecipientsDataset, type AudienceOption, type Recipient } from "@/lib/broadcast"
import type { BroadcastHistoryItem } from "@/components/app/TelegramBroadcast"
import type { TelegramStats } from "@/components/app/IntegrationManage"

export const dynamic = "force-dynamic"

const META: Record<string, { label: string; description: string; color: string }> = {
  telegram: { label: "Telegram Bot", description: "Личный кабинет клиентов, QR-чекин и уведомления", color: "var(--brand)" },
  click:    { label: "Click",        description: "Приём онлайн-платежей через Click",               color: "var(--chart-2)" },
  payme:    { label: "Payme",        description: "Приём онлайн-платежей через Payme",               color: "var(--chart-4)" },
}

export default async function IntegrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const meta = META[slug]
  if (!meta) notFound()

  // Click/Payme подключаются через рабочий блок «Приём онлайн-оплат» в Настройках → Финансы
  // (единый флоу заявок). Ведём туда из маркетплейса интеграций.
  if (slug === "click" || slug === "payme") redirect("/settings/finance")

  const supabase = await createClient()
  const club = await getCurrentClub()

  let connected = false
  const currentValue = ""
  let clientCount = 0
  let subscribers = 0
  let audienceOptions: AudienceOption[] = []
  let recipients: Recipient[] = []
  let history: BroadcastHistoryItem[] = []
  let tgSettings: TelegramSettings = DEFAULT_TG_SETTINGS
  let botUsername = ""
  let botFirstName = ""
  let botAvatarUrl = ""
  let connectedAt: string | null = null
  let webhookReady = false
  let telegramStats: TelegramStats = {
    messagesMonth: 0,
    activeUsers7d: 0,
    newUsersMonth: 0,
    qrCheckinsToday: 0,
    failedMonth: 0,
  }

  if (club) {
    const [{ data }, { data: telegramIntegration }] = await Promise.all([supabase
      .from("clubs")
      .select("settings")
      .eq("id", club.clubId)
      .single(),
      slug === "telegram"
        ? createServiceClient().from("telegram_integrations").select("club_id").eq("club_id", club.clubId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    if (data) {
      if (slug === "telegram" && telegramIntegration) {
        connected = true
        const settings = (data.settings as Record<string, unknown> | null) ?? {}
        const tgBot = (settings.tg_bot as { username?: string; firstName?: string; avatar_url?: string; connected_at?: string; webhook_registered?: boolean } | undefined) ?? {}
        botUsername = tgBot.username ?? ""
        botFirstName = tgBot.firstName ?? "Telegram Bot"
        botAvatarUrl = tgBot.avatar_url ?? ""
        connectedAt = tgBot.connected_at ?? null
        webhookReady = tgBot.webhook_registered === true
        tgSettings = { ...DEFAULT_TG_SETTINGS, ...((settings.tg_settings as Partial<TelegramSettings> | undefined) ?? {}) }
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

        const tashkentDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date())
        const monthStart = `${tashkentDate.slice(0, 7)}-01T00:00:00+05:00`
        const todayStart = `${tashkentDate}T00:00:00+05:00`
        const weekStart = new Date(new Date(`${tashkentDate}T00:00:00+05:00`).getTime() - 7 * 86_400_000).toISOString()

        const [opts, ds, hist, monthBroadcasts, monthEvents, activeEvents, qrVisits] = await Promise.all([
          resolveAudienceOptions(supabase, club.clubId),
          getRecipientsDataset(supabase, club.clubId),
          supabase
            .from("broadcasts")
            .select("id, message, image_url, audience_label, status, scheduled_at, sent_at, total, delivered")
            .eq("club_id", club.clubId)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase.from("broadcasts").select("delivered").eq("club_id", club.clubId)
            .eq("status", "sent").gte("sent_at", monthStart),
          supabase.from("telegram_events").select("event_type, status").eq("club_id", club.clubId)
            .gte("created_at", monthStart),
          supabase.from("telegram_events").select("telegram_id").eq("club_id", club.clubId)
            .gte("created_at", weekStart).not("telegram_id", "is", null),
          supabase.from("visits").select("id", { count: "exact", head: true }).eq("club_id", club.clubId)
            .eq("method", "qr").gte("checked_in_at", todayStart),
        ])
        audienceOptions = opts
        recipients = ds
        history = (hist.data ?? []).map((b) => ({
          id: b.id as string,
          message: b.message as string | null,
          imageUrl: b.image_url as string | null,
          audienceLabel: b.audience_label as string | null,
          status: b.status as string,
          scheduledAt: b.scheduled_at as string | null,
          sentAt: b.sent_at as string | null,
          total: (b.total as number) ?? 0,
          delivered: (b.delivered as number) ?? 0,
        }))
        const automatedSent = (monthEvents.data ?? []).filter((event) => event.status === "sent").length
        telegramStats = {
          messagesMonth: (monthBroadcasts.data ?? []).reduce((sum, item) => sum + (item.delivered ?? 0), 0) + automatedSent,
          activeUsers7d: new Set((activeEvents.data ?? []).map((event) => event.telegram_id)).size,
          newUsersMonth: (monthEvents.data ?? []).filter((event) => event.event_type === "client_linked").length,
          qrCheckinsToday: qrVisits.count ?? 0,
          failedMonth: (monthEvents.data ?? []).filter((event) => event.status === "failed").length,
        }
      }
    }
  }

  return (
    <div className={`${slug === "telegram" ? "max-w-[1400px]" : "max-w-2xl"} space-y-5`}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/integrations" className="flex items-center gap-1 hover:underline">
          <ArrowLeft size={14} />
          Интеграции
        </Link>
        <span>/</span>
        <span className="text-foreground">{meta.label}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-14 h-14 rounded-lg flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
          style={{ background: meta.color }}>
          {meta.label[0]}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground">
            {meta.label}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{meta.description}</p>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${connected ? "bg-chart-2/10 text-chart-2" : "border border-border bg-muted text-muted-foreground"}`}>
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
        botAvatarUrl={botAvatarUrl}
        connectedAt={connectedAt}
        webhookReady={webhookReady}
        telegramStats={telegramStats}
        clubName={club?.clubName ?? "Клуб"}
        audienceOptions={audienceOptions}
        recipients={recipients}
        history={history}
      />
    </div>
  )
}
