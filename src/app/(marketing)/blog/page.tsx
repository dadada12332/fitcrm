import Link from "next/link"
import { PageShell, PageHero } from "@/components/landing/v2/PageShell"
import { ArrowRight } from "lucide-react"

export const metadata = { title: "Блог — FitCRM" }

const POSTS = [
  { tag: "Рост", date: "Скоро", title: "Как удержать клиента: 7 триггеров оттока, которые видит CRM", excerpt: "Разбираем, по каким признакам система понимает, что клиент вот-вот перестанет ходить — и что с этим делать." },
  { tag: "Финансы", date: "Скоро", title: "Абонемент или разовые: какая модель приносит больше выручки", excerpt: "Сравниваем модели монетизации на данных реальных клубов и считаем LTV." },
  { tag: "Автоматизация", date: "Скоро", title: "QR-чекин за 5 минут: как убрать очередь на ресепшене", excerpt: "Пошагово настраиваем вход по QR и разгружаем администратора в час пик." },
  { tag: "Кейс", date: "Скоро", title: "Сеть из 6 залов на одной панели: опыт внедрения FitCRM", excerpt: "Как мультифилиальность помогает управлять сетью без хаоса в таблицах." },
  { tag: "Продукт", date: "Скоро", title: "AI-аналитика: какие вопросы задать своему клубу", excerpt: "Примеры запросов к ассистенту, которые экономят часы работы с отчётами." },
  { tag: "Гайд", date: "Скоро", title: "Переезд с Excel в CRM без потери данных", excerpt: "Готовим таблицу, сопоставляем поля и импортируем базу за несколько минут." },
]

export default function BlogPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="БЛОГ"
        title="Идеи для роста фитнес-клуба"
        subtitle="Практика, кейсы и разборы по управлению клубом, удержанию клиентов и автоматизации. Первые статьи уже готовятся."
      />

      <section className="py-20 md:py-24">
        <div className="mx-auto max-w-[1080px] px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {POSTS.map((p) => (
              <div key={p.title} className="rounded-[18px] overflow-hidden flex flex-col" style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.08)" }}>
                <div className="h-[150px] relative overflow-hidden" style={{ background: "linear-gradient(135deg, #e9f0ff 0%, #f4f6fb 60%, #eef1f6 100%)" }}>
                  <div className="pointer-events-none absolute rounded-full blur-[40px]" style={{ background: "rgba(0,101,252,0.16)", inset: "20% 40% 30% 10%" }} />
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(0,101,252,0.1)", color: "#0065fc" }}>{p.tag}</span>
                    <span className="text-[12px]" style={{ color: "#9ca3af" }}>{p.date}</span>
                  </div>
                  <h3 className="text-[16px] font-semibold leading-[22px] text-[#0a0a0a]">{p.title}</h3>
                  <p className="text-[13.5px] leading-[20px] mt-2" style={{ color: "#52525b" }}>{p.excerpt}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[20px] mt-8 px-8 py-9 flex flex-wrap items-center justify-between gap-5" style={{ background: "#f6f7f9", border: "1px solid rgba(0,0,0,0.06)" }}>
            <div>
              <h3 className="text-[19px] font-semibold text-[#0a0a0a]">Хотите узнать о запуске блога первыми?</h3>
              <p className="text-[14px] mt-1" style={{ color: "#52525b" }}>Напишите нам — пришлём подборку материалов, как только выйдут.</p>
            </div>
            <Link href="/contacts" className="group h-11 flex items-center gap-2 px-6 rounded-full text-[15px] font-semibold text-white shrink-0" style={{ background: "#0065fc" }}>
              Оставить контакт <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
