import { Ticket } from "lucide-react"
import { ComingSoon } from "@/components/platform/parts"

export const dynamic = "force-dynamic"

export default function PromoPage() {
  return (
    <ComingSoon
      title="Промокоды"
      icon={<Ticket className="w-7 h-7" style={{ color: "#a5b4fc" }} />}
      description="Создание и учёт промокодов: скидки, бесплатные дни, лимит использований, срок действия. Таблица platform_promo_codes уже создана миграцией."
    />
  )
}
