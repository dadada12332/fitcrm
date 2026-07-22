import { redirect } from "next/navigation"
import { getCurrentClub } from "@/lib/club"
import { createServiceClient } from "@/lib/supabase/service"
import { getInstagramConfig } from "@/lib/instagram"
import { InstagramIntegration, type InstagramPageData } from "@/components/app/InstagramIntegration"
import { planFeatureEnabled } from "@/lib/plan-access"

export const dynamic = "force-dynamic"
export const metadata = { title: "Instagram — Интеграции FitCRM" }

export default async function InstagramPage({ searchParams }: { searchParams: Promise<{ oauth?: string }> }) {
  const club = await getCurrentClub()
  if (!club) redirect("/login")
  if (!club.permissions.settings.integrations) redirect("/dashboard")
  if (!planFeatureEnabled(club.planAccess, "instagram")) redirect("/integrations")

  const service = createServiceClient()
  const [{ data: connection }, { data: media }, { data: insights }, { data: touches }] = await Promise.all([
    service.from("integration_connections").select("username,display_name,account_type,status,metadata,last_synced_at,last_error")
      .eq("club_id", club.clubId).eq("provider", "instagram").maybeSingle(),
    service.from("instagram_media").select("id,media_type,caption,media_url,thumbnail_url,permalink,published_at,like_count,comments_count,insights")
      .eq("club_id", club.clubId).order("published_at", { ascending: false }).limit(12),
    service.from("instagram_daily_insights").select("metrics").eq("club_id", club.clubId)
      .order("insight_date", { ascending: false }).limit(1).maybeSingle(),
    service.from("marketing_touchpoints").select("client_id").eq("club_id", club.clubId).eq("source", "instagram"),
  ])
  const attributedClients = [...new Set((touches ?? []).map((item) => item.client_id).filter(Boolean))] as string[]
  const { data: payments } = attributedClients.length
    ? await service.from("payments").select("amount").eq("club_id", club.clubId).eq("status", "completed").in("client_id", attributedClients)
    : { data: [] as Array<{ amount: number }> }
  const metadata = (connection?.metadata as Record<string, unknown> | null) ?? {}
  const metricData = (insights?.metrics as Record<string, unknown> | null) ?? {}
  const data: InstagramPageData = {
    configured: getInstagramConfig().configured,
    connected: Boolean(connection),
    username: connection?.username ?? null,
    displayName: connection?.display_name ?? null,
    accountType: connection?.account_type ?? null,
    status: connection?.status ?? null,
    followers: Number(metadata.followers_count ?? 0),
    mediaCount: Number(metadata.media_count ?? media?.length ?? 0),
    lastSyncedAt: connection?.last_synced_at ?? null,
    lastError: connection?.last_error ?? null,
    reach: Number(metricData.reach ?? 0),
    views: Number(metricData.views ?? 0),
    crmLeads: touches?.length ?? 0,
    crmClients: attributedClients.length,
    crmRevenue: (payments ?? []).reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    media: (media ?? []).map((item) => ({
      id: item.id,
      mediaType: item.media_type,
      caption: item.caption,
      imageUrl: item.thumbnail_url || item.media_url,
      permalink: item.permalink,
      publishedAt: item.published_at,
      likes: item.like_count ?? 0,
      comments: item.comments_count ?? 0,
      insights: (item.insights as Record<string, unknown> | null) ?? {},
    })),
  }
  const { oauth } = await searchParams
  return <InstagramIntegration data={data} oauth={oauth} />
}
