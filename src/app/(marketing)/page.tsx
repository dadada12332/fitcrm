import { Navbar } from "@/components/landing/Navbar"
import { Hero } from "@/components/landing/Hero"
import { Clients } from "@/components/landing/Clients"
import { Features } from "@/components/landing/Features"
import { Capabilities } from "@/components/landing/Capabilities"
import { UseCases } from "@/components/landing/UseCases"
import { Testimonials } from "@/components/landing/Testimonials"
import { Pricing } from "@/components/landing/Pricing"
import { CtaBand } from "@/components/landing/CtaBand"
import { Footer } from "@/components/landing/Footer"

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Clients />
      <Features />
      <Capabilities />
      <UseCases />
      <Testimonials />
      <Pricing />
      <CtaBand />
      <Footer />
    </main>
  )
}
