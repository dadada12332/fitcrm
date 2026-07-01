"use client"

import { Send, Wallet, CreditCard, Database, QrCode, BarChart3 } from "lucide-react"
import { Marquee } from "@/components/landing/motion"

const logos = [
  { icon: Send, label: "Telegram" },
  { icon: Wallet, label: "Payme" },
  { icon: CreditCard, label: "Click" },
  { icon: Database, label: "Supabase" },
  { icon: QrCode, label: "QR-чекин" },
  { icon: BarChart3, label: "Аналитика" },
]

export function Logos() {
  return (
    <section className="py-14 px-4">
      <p className="text-center text-xs text-zinc-400 mb-7">Интегрируется с вашими сервисами</p>
      <Marquee>
        {logos.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 text-zinc-400 px-8">
            <Icon className="w-5 h-5" />
            <span className="text-base font-medium whitespace-nowrap">{label}</span>
          </div>
        ))}
      </Marquee>
    </section>
  )
}
