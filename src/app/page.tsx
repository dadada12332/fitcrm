import { Navbar } from "@/components/landing/Navbar"
import { Hero } from "@/components/landing/Hero"
import { Features } from "@/components/landing/Features"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { Pricing } from "@/components/landing/Pricing"
import { CtaBand } from "@/components/landing/CtaBand"
import { Faq } from "@/components/landing/Faq"
import { Footer } from "@/components/landing/Footer"

export default function Home() {
  return (
    <main style={{ background: "#f5fbff" }}>
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <CtaBand />
      <Faq />
      <Footer />
    </main>
  )
}
