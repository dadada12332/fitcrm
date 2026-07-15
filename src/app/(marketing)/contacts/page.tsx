import Link from "next/link"
import { PageShell, PageHero } from "@/components/landing/v2/PageShell"
import { Mail, Send, Phone, MapPin, ArrowRight } from "lucide-react"

export const metadata = { title: "Контакты — FitCRM" }

const CONTACTS = [
  { icon: Mail, title: "Почта", value: "hello@fitcrm.uz", href: "mailto:hello@fitcrm.uz", note: "Ответим в течение дня" },
  { icon: Send, title: "Telegram", value: "@fitcrm_support", href: "https://t.me/fitcrm", note: "Самый быстрый ответ" },
  { icon: Phone, title: "Телефон", value: "+998 (71) 200-00-00", href: "tel:+998712000000", note: "Пн–Сб, 9:00–19:00" },
  { icon: MapPin, title: "Офис", value: "Ташкент, Узбекистан", href: "#", note: "По записи" },
]

export default function ContactsPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="КОНТАКТЫ"
        title="Мы всегда на связи"
        subtitle="Есть вопрос по платформе, тарифам или хотите живую демонстрацию? Выберите удобный способ — мы на связи каждый день."
      />

      <section className="py-20 md:py-24">
        <div className="mx-auto max-w-[1080px] px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {CONTACTS.map(({ icon: Icon, title, value, href, note }) => (
              <Link key={title} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
                className="group rounded-[18px] p-7 flex items-start gap-5 transition-all hover:-translate-y-1"
                style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.08)" }}>
                <div className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0" style={{ background: "#f4f5f7", border: "1px solid rgba(0,0,0,0.05)" }}>
                  <Icon className="w-5 h-5" style={{ color: "#27272a" }} strokeWidth={1.75} />
                </div>
                <div>
                  <div className="text-[13px]" style={{ color: "#9ca3af" }}>{title}</div>
                  <div className="text-[19px] font-semibold text-[#0a0a0a] mt-0.5">{value}</div>
                  <div className="text-[13px] mt-1" style={{ color: "#52525b" }}>{note}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* CTA-плашка */}
          <div className="relative overflow-hidden rounded-[24px] mt-8 px-8 py-12 text-center" style={{ background: "#0e1117" }}>
            <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 55% 60% at 50% 0%, rgba(0,101,252,0.32), transparent 62%)" }} />
            <div className="relative">
              <h2 className="text-[26px] md:text-[32px] font-semibold tracking-[-0.8px] text-white">Готовы попробовать FitCRM?</h2>
              <p className="mt-3 text-[15px] max-w-[440px] mx-auto" style={{ color: "#a1a1aa" }}>Запустите клуб бесплатно уже сегодня — карта не нужна.</p>
              <Link href="/register" className="group inline-flex items-center gap-2 mt-7 h-11 px-6 rounded-full text-[15px] font-semibold" style={{ background: "#ffffff", color: "#0a0a0a" }}>
                Начать бесплатно <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
