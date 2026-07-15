import Link from "next/link"
import { PageShell, PageHero } from "@/components/landing/v2/PageShell"
import { Target, Heart, Zap, ShieldCheck, ArrowRight } from "lucide-react"

export const metadata = { title: "О нас — FitCRM" }

const VALUES = [
  { icon: Target, title: "Фокус на результат", desc: "Мы делаем не «ещё одну CRM», а инструмент, который экономит время и растит выручку клуба." },
  { icon: Heart, title: "Забота о клиентах", desc: "Каждая функция рождается из реальных запросов владельцев залов и администраторов." },
  { icon: Zap, title: "Скорость", desc: "Импорт базы, настройка и первый чекин — за один день. Без внедренцев и долгих интеграций." },
  { icon: ShieldCheck, title: "Надёжность", desc: "Шифрование, изоляция данных и автобэкапы. Данные клуба принадлежат только клубу." },
]

const STATS = [
  { n: "1000+", l: "клубов на платформе" },
  { n: "2 млн+", l: "клиентов в системе" },
  { n: "99.9%", l: "аптайм за год" },
  { n: "24/7", l: "поддержка" },
]

export default function AboutPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="О КОМПАНИИ"
        title="Мы строим операционную систему для фитнеса"
        subtitle="FitCRM появилась из простой идеи: у владельца клуба должно оставаться время на клиентов, а не на таблицы. Мы объединили клиентов, абонементы, расписание, оплаты и аналитику в одну платформу."
      />

      {/* Миссия */}
      <section className="py-20 md:py-24">
        <div className="mx-auto max-w-[820px] px-6 text-center">
          <div className="font-mono text-[12.5px] tracking-[0.1em] mb-4" style={{ color: "#0065fc" }}>НАША МИССИЯ</div>
          <p className="text-[24px] md:text-[30px] leading-[1.35] tracking-[-0.5px] text-[#0a0a0a]">
            Сделать управление фитнес-клубом таким же простым, как заказ такси — понятным с первого экрана и работающим из коробки.
          </p>
        </div>
      </section>

      {/* Ценности */}
      <section className="pb-20 md:pb-24">
        <div className="mx-auto max-w-[1080px] px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-[18px] p-7" style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.08)" }}>
                <div className="w-11 h-11 rounded-[13px] flex items-center justify-center mb-5" style={{ background: "#f4f5f7", border: "1px solid rgba(0,0,0,0.05)" }}>
                  <Icon className="w-5 h-5" style={{ color: "#27272a" }} strokeWidth={1.75} />
                </div>
                <h3 className="text-[18px] font-semibold text-[#0a0a0a] mb-2">{title}</h3>
                <p className="text-[14px] leading-[21px]" style={{ color: "#52525b" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Цифры */}
      <section className="pb-20 md:pb-28">
        <div className="mx-auto max-w-[1080px] px-6">
          <div className="rounded-[24px] px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-8" style={{ background: "#f6f7f9", border: "1px solid rgba(0,0,0,0.06)" }}>
            {STATS.map((s) => (
              <div key={s.l} className="text-center">
                <div className="text-[36px] md:text-[42px] font-semibold tracking-[-1.2px] text-[#0a0a0a]">{s.n}</div>
                <div className="text-[14px] mt-1" style={{ color: "#52525b" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <div className="mx-auto max-w-[1080px] px-6 text-center">
          <h2 className="text-[30px] md:text-[38px] font-semibold tracking-[-1px] text-[#0a0a0a]">Хотите присоединиться?</h2>
          <p className="mt-3 text-[16px]" style={{ color: "#52525b" }}>Начните бесплатно или напишите нам — покажем платформу вживую.</p>
          <div className="flex items-center justify-center gap-3 mt-7">
            <Link href="/register" className="group h-11 flex items-center gap-2 px-6 rounded-full text-[15px] font-semibold text-white transition-opacity hover:opacity-90" style={{ background: "#0065fc" }}>
              Начать бесплатно <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link href="/contacts" className="h-11 flex items-center px-6 rounded-full text-[15px] font-semibold text-[#0a0a0a]" style={{ border: "1px solid rgba(0,0,0,0.15)" }}>
              Связаться
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
