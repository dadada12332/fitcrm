import { createServiceClient } from "@/lib/supabase/service"

export type PlatformAnnouncementCategory = "news" | "maintenance" | "update" | "important"

export type PlatformAnnouncement = {
  deliveryId: string
  broadcastId: string
  title: string
  body: string
  category: PlatformAnnouncementCategory
  publishedAt: string
  readAt: string | null
}

async function visibleBroadcastIds() {
  const service = createServiceClient()
  const { data, error } = await service
    .from("platform_broadcasts")
    .select("id")
    .in("status", ["scheduled", "sent"])
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map((row) => row.id)
}

export async function getUnreadPlatformAnnouncementCount(clubId: string, userId: string) {
  const ids = await visibleBroadcastIds()
  if (!ids.length) return 0
  const service = createServiceClient()
  const { count, error } = await service
    .from("platform_broadcast_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .is("read_at", null)
    .neq("status", "skipped")
    .in("broadcast_id", ids)
  if (error) throw error
  return count ?? 0
}

export async function getPlatformAnnouncements(clubId: string, userId: string): Promise<PlatformAnnouncement[]> {
  const ids = await visibleBroadcastIds()
  if (!ids.length) return []
  const service = createServiceClient()
  const [{ data: deliveries, error: deliveriesError }, { data: broadcasts, error: broadcastsError }] = await Promise.all([
    service
      .from("platform_broadcast_deliveries")
      .select("id, broadcast_id, read_at")
      .eq("club_id", clubId)
      .eq("user_id", userId)
      .neq("status", "skipped")
      .in("broadcast_id", ids),
    service
      .from("platform_broadcasts")
      .select("id, title, body, category, scheduled_at")
      .in("id", ids),
  ])
  if (deliveriesError || broadcastsError) throw deliveriesError ?? broadcastsError

  const campaignById = new Map((broadcasts ?? []).map((row) => [row.id, row]))
  return (deliveries ?? []).flatMap((delivery) => {
    const campaign = campaignById.get(delivery.broadcast_id)
    if (!campaign) return []
    return [{
      deliveryId: delivery.id,
      broadcastId: campaign.id,
      title: campaign.title,
      body: campaign.body,
      category: campaign.category as PlatformAnnouncementCategory,
      publishedAt: campaign.scheduled_at,
      readAt: delivery.read_at,
    }]
  }).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}

export async function markPlatformAnnouncementRead(clubId: string, userId: string, deliveryId: string) {
  const service = createServiceClient()
  const { data, error } = await service
    .from("platform_broadcast_deliveries")
    .update({ read_at: new Date().toISOString() })
    .eq("id", deliveryId)
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .is("read_at", null)
    .select("id")
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}
