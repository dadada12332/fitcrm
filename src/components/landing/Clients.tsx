"use client"

import { Send, Wallet, CreditCard, Database, QrCode, BarChart3, Bell } from "lucide-react"
import { Reveal, Marquee } from "./motion"

const logos = [
  { icon: Send, label: "Telegram" },
  { icon: Wallet, label: "Payme" },
  { icon: CreditCard, label: "Click" },
  { icon: Database, label: "Supabase" },
  { icon: QrCode, label: "QR-чекин" },
  { icon: BarChart3, label: "Аналитика" },
  { icon: Bell, label: "Уведомления" },
]

export function Clients() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-[1200px] mx-auto">
        <Reveal>
          <p className="text-center text-xs text-white/40 mb-8">Работает с вашими сервисами</p>
        </Reveal>
        <Marquee>
          {logos.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-white/40 px-8">
              <Icon className="w-5 h-5" />
              <span className="text-base font-medium whitespace-nowrap">{label}</span>
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  )
}
