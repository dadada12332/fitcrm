import { notFound } from "next/navigation"
import { canPlatform, getPlatformAuth, getPlatformPromoCodes } from "@/lib/platform"
import { PageHeader } from "@/components/platform/parts"
import { PromoManager } from "@/components/platform/PromoManager"

export const dynamic = "force-dynamic"

export default async function PromoPage() {
  const auth = await getPlatformAuth()
  if (!auth || !canPlatform(auth, "promos.manage")) notFound()
  const promos = await getPlatformPromoCodes()
  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Промокоды" subtitle="Скидки, бесплатные дни, ограничения и история использования" />
      <PromoManager promos={promos} />
    </div>
  )
}
