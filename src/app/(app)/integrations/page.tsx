import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getCurrentClub } from "@/lib/club"
import { redirect } from "next/navigation"
import { IntegrationsCatalog, type IntegrationStatus } from "@/components/app/IntegrationsCatalog"

export const metadata = { title: "Интеграции — FitCRM" }

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!club.permissions.settings.integrations) redirect("/dashboard")

  const statuses: IntegrationStatus[] = []

  {
    const service = createServiceClient()
    const [{ data }, { data: telegramIntegration }, { data: instagramIntegration }] = await Promise.all([supabase
      .from("clubs")
      .select("settings")
      .eq("id", club.clubId)
      .single(), service.from("telegram_integrations").select("club_id").eq("club_id", club.clubId).maybeSingle(),
      service.from("integration_connections").select("username,last_synced_at").eq("club_id", club.clubId).eq("provider", "instagram").maybeSingle()])

    if (data) {
      if (telegramIntegration) {
        const { count } = await supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("club_id", club.clubId)

        statuses.push({
          key: "telegram",
          connected: true,
          handle: "@бот",
          clientCount: count ?? 0,
          lastSync: new Date().toISOString(),
        })
      }

      if (instagramIntegration) {
        statuses.push({
          key: "instagram",
          connected: true,
          handle: instagramIntegration.username ? `@${instagramIntegration.username}` : "Instagram",
          lastSync: instagramIntegration.last_synced_at ?? undefined,
        })
      }

      // Click/Payme — статус из флоу заявок (payment_connection_requests), а не из settings.
      const { data: pcr } = await supabase
        .from("payment_connection_requests")
        .select("provider, status")
        .eq("club_id", club.clubId)
        .in("status", ["new", "active"])
      for (const pv of ["click", "payme"] as const) {
        const r = (pcr ?? []).find((x) => x.provider === pv)
        if (r?.status === "active") statuses.push({ key: pv, connected: true, handle: "Активно" })
        else if (r?.status === "new") statuses.push({ key: pv, connected: false, handle: "Заявка на рассмотрении" })
      }
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>
          Интеграции
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>
          Подключите платёжные системы и мессенджеры к вашему клубу
        </p>
      </div>

      <IntegrationsCatalog statuses={statuses} />
    </div>
  )
}
