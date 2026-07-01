import { Navbar } from "@/components/landing-v2/Navbar"
import { Hero } from "@/components/landing-v2/Hero"
import { Showcase } from "@/components/landing-v2/Showcase"
import { Logos } from "@/components/landing-v2/Logos"
import { Features } from "@/components/landing-v2/Features"
import { Pricing } from "@/components/landing-v2/Pricing"
import { CtaBand } from "@/components/landing-v2/CtaBand"
import { Footer } from "@/components/landing-v2/Footer"

export default function V2() {
  return (
    <main className="landing-v2 min-h-screen">
      <Navbar />
      <Hero />
      <Showcase />
      <Logos />
      <Features />
      <Pricing />
      <CtaBand />
      <Footer />
    </main>
  )
}
