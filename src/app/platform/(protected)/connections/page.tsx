import { getConnectionRequests } from "@/lib/payments-connect"
import { PageHeader } from "@/components/platform/parts"
import { ConnectionsManager } from "@/components/platform/ConnectionsManager"

export const dynamic = "force-dynamic"

export default async function ConnectionsPage() {
  const { pending, resolved } = await getConnectionRequests()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.fitcrm.uz"

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto">
      <PageHeader
        title="Приём оплат"
        subtitle="Заявки клубов на подключение Payme / Click. Введите данные мерчанта и активируйте."
      />
      <ConnectionsManager pending={pending} resolved={resolved} appUrl={appUrl} />
    </div>
  )
}
