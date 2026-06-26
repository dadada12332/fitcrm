import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { IntegrationsCatalog, type IntegrationStatus } from "@/components/app/IntegrationsCatalog"
import { Plug } from "lucide-react"

export const metadata = { title: "Интеграции — FitCRM" }

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const club = await getCurrentClub()

  const statuses: IntegrationStatus[] = []

  if (club) {
    const { data } = await supabase
      .from("clubs")
      .select("tg_token, settings")
      .eq("id", club.clubId)
      .single()

    if (data) {
      const integrations = (data.settings as any)?.integrations ?? {}

      if (data.tg_token) {
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

      if (integrations.click) {
        statuses.push({ key: "click", connected: true, handle: `ID: ${integrations.click}` })
      }

      if (integrations.payme) {
        statuses.push({ key: "payme", connected: true, handle: `ID: ${integrations.payme}` })
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(37,99,235,0.1)" }}>
          <Plug className="w-5 h-5" style={{ color: "#2563eb" }} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>
            Интеграции
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--on-dark-soft)" }}>
            Подключите платёжные системы и мессенджеры к вашему клубу
          </p>
        </div>
      </div>

      <IntegrationsCatalog statuses={statuses} />
    </div>
  )
}
