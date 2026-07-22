import { Navbar }       from "@/components/landing/v2/Navbar"
import { Hero }         from "@/components/landing/v2/Hero"
import { Clients }      from "@/components/landing/v2/Clients"
import { Features }     from "@/components/landing/v2/Features"
import { WhyDifferent } from "@/components/landing/v2/WhyDifferent"
import { HowItWorks }   from "@/components/landing/v2/HowItWorks"
import { Stats }        from "@/components/landing/v2/Stats"
import { GrowthRetention } from "@/components/landing/v2/GrowthRetention"
import { Pricing }      from "@/components/landing/v2/Pricing"
import { Faq }          from "@/components/landing/v2/Faq"
import { CtaBand }      from "@/components/landing/v2/CtaBand"
import { Footer }       from "@/components/landing/v2/Footer"

// Основной лендинг (светлая тема). Тарифы читаются из БД (ISR 5 мин).
export const revalidate = 300

// JSON-LD для поисковиков
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FitCRM",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "CRM для фитнес-клубов: клиенты, абонементы, расписание, оплаты, QR-чекин, Telegram-бот и AI-аналитика в одной платформе.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "UZS" },
  aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", ratingCount: "120" },
}

export default function Home() {
  return (
    <main className="min-h-screen" style={{ background: "#ffffff" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <Hero />
      <Clients />
      <Features />
      <WhyDifferent />
      <HowItWorks />
      <Stats />
      <GrowthRetention />
      <Pricing />
      <Faq />
      <CtaBand />
      <Footer />
    </main>
  )
}
