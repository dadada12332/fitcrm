import { PageHeader } from "@/components/platform/parts"
import { PlatformSupportConsole } from "@/components/platform/PlatformSupportConsole"
import { pfListTicketsAction } from "./actions"

export const dynamic = "force-dynamic"

export default async function SupportPage() {
  const { rows, counts } = await pfListTicketsAction({ status: "all" })
  return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto">
      <PageHeader
        title="Поддержка"
        subtitle={`${counts.all ?? 0} обращений · ${counts.new ?? 0} новых, ${counts.in_progress ?? 0} в работе`}
      />
      <PlatformSupportConsole initialRows={rows} initialCounts={counts} />
    </div>
  )
}
