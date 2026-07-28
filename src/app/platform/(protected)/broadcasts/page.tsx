import { notFound } from "next/navigation"
import { canPlatform, getPlatformAuth, getPlatformBroadcasts } from "@/lib/platform"
import { PageHeader } from "@/components/platform/parts"
import { PlatformBroadcastManager } from "@/components/platform/PlatformBroadcastManager"

export const dynamic = "force-dynamic"

export default async function BroadcastsPage() {
  const auth = await getPlatformAuth()
  if (!auth || !canPlatform(auth, "broadcasts.manage")) notFound()
  const broadcasts = await getPlatformBroadcasts()
  return (
    <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Рассылки" subtitle="Новости и важные сообщения для владельцев прямо внутри CRM" />
      <PlatformBroadcastManager broadcasts={broadcasts} />
    </div>
  )
}
