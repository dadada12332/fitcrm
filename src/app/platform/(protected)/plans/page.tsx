import { getPlans } from "@/lib/plans"
import { PageHeader } from "@/components/platform/parts"
import { PlansManager } from "@/components/platform/PlansManager"

export const dynamic = "force-dynamic"

export default async function PlansPage() {
  const plans = await getPlans({ includeArchived: true })
  const active = plans.filter((p) => !p.is_archived).length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto">
      <PageHeader
        title="Тарифы"
        subtitle={`${active} активных тарифов · управление ценами, лимитами и возможностями`}
      />
      <PlansManager plans={plans} />
    </div>
  )
}
