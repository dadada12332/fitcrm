import { Navbar } from "@/components/landing-v3/Navbar"
import { Hero } from "@/components/landing-v3/Hero"
import { Logos } from "@/components/landing-v3/Logos"
import { Bento } from "@/components/landing-v3/Bento"
import { Pricing } from "@/components/landing-v3/Pricing"
import { CtaBand } from "@/components/landing-v3/CtaBand"
import { Footer } from "@/components/landing-v3/Footer"

export default function V3() {
  return (
    <main className="dark landing-v3 min-h-screen">
      <Navbar />
      <Hero />
      <Logos />
      <Bento />
      <Pricing />
      <CtaBand />
      <Footer />
    </main>
  )
}
