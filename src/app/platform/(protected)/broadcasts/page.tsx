import { Send } from "lucide-react"
import { ComingSoon } from "@/components/platform/parts"

export const dynamic = "force-dynamic"

export default function BroadcastsPage() {
  return (
    <ComingSoon
      title="Массовые рассылки"
      icon={<Send className="w-7 h-7" style={{ color: "#a5b4fc" }} />}
      description="Отправка сообщений всем клубам или по сегменту: только Trial, только Premium, только просроченные, только Узбекистан. Интерфейс сегментации в разработке."
    />
  )
}
