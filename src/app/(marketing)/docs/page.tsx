import Link from "next/link"
import { PageShell, PageHero } from "@/components/landing/v2/PageShell"
import { Rocket, Users, CreditCard, CalendarClock, Plug, ShieldCheck, ArrowUpRight, ArrowRight } from "lucide-react"

export const metadata = { title: "Документация — FitCRM" }

const CATS = [
  { icon: Rocket, title: "Быстрый старт", desc: "Регистрация, создание клуба, импорт базы из Excel и первый QR-чекин.", href: "/register" },
  { icon: Users, title: "Клиенты и абонементы", desc: "Профили, история визитов, баланс, продление и заморозка абонементов.", href: "/#features" },
  { icon: CreditCard, title: "Оплаты", desc: "Подключение Payme, Click и приём платежей прямо в карточке клиента.", href: "/#features" },
  { icon: CalendarClock, title: "Расписание", desc: "Групповые занятия, тренеры, залы и запись клиентов в один календарь.", href: "/#features" },
  { icon: Plug, title: "Интеграции", desc: "Telegram-бот, WhatsApp, QR-чекин и другие инструменты из коробки.", href: "/#faq" },
  { icon: ShieldCheck, title: "Безопасность", desc: "Роли и права доступа, журнал действий, шифрование и автобэкапы.", href: "/#howitworks" },
]

export default function DocsPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="ДОКУМЕНТАЦИЯ"
        title="Всё, что нужно знать о FitCRM"
        subtitle="Пошаговые руководства по настройке и работе с платформой. Начните с быстрого старта — большинство клубов запускаются за один день."
      />

      <section className="py-20 md:py-24">
        <div className="mx-auto max-w-[1080px] px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CATS.map(({ icon: Icon, title, desc, href }) => (
              <Link key={title} href={href}
                className="group rounded-[18px] p-7 transition-all hover:-translate-y-1"
                style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.08)" }}>
                <div className="flex items-start justify-between">
                  <div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "#f4f5f7", border: "1px solid rgba(0,0,0,0.05)" }}>
                    <Icon className="w-5 h-5" style={{ color: "#27272a" }} strokeWidth={1.75} />
                  </div>
                  <ArrowUpRight className="w-4 h-4 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all" style={{ color: "#a1a1aa" }} />
                </div>
                <h3 className="text-[17px] font-semibold text-[#0a0a0a] mt-5">{title}</h3>
                <p className="text-[14px] leading-[21px] mt-2" style={{ color: "#52525b" }}>{desc}</p>
              </Link>
            ))}
          </div>

          {/* Не нашли ответ */}
          <div className="rounded-[20px] mt-8 px-8 py-9 flex flex-wrap items-center justify-between gap-5" style={{ background: "#f6f7f9", border: "1px solid rgba(0,0,0,0.06)" }}>
            <div>
              <h3 className="text-[19px] font-semibold text-[#0a0a0a]">Не нашли ответ?</h3>
              <p className="text-[14px] mt-1" style={{ color: "#52525b" }}>Команда поддержки поможет с настройкой и переносом данных.</p>
            </div>
            <Link href="/contacts" className="group h-11 flex items-center gap-2 px-6 rounded-full text-[15px] font-semibold text-white shrink-0" style={{ background: "#0065fc" }}>
              Написать в поддержку <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
