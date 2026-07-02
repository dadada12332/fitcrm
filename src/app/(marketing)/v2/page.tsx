import { Navbar } from "@/components/landing-v2/Navbar"
import { Hero } from "@/components/landing-v2/Hero"
import { Showcase } from "@/components/landing-v2/Showcase"
import { Logos } from "@/components/landing-v2/Logos"
import { Features } from "@/components/landing-v2/Features"
import { LiveFeatures } from "@/components/landing-v2/LiveFeatures"
import { Testimonials } from "@/components/landing-v2/Testimonials"
import { Pricing } from "@/components/landing-v2/Pricing"
import { Faq } from "@/components/landing-v2/Faq"
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
      <LiveFeatures />
      <Testimonials />
      <Pricing />
      <Faq />
      <CtaBand />
      <Footer />
    </main>
  )
}
