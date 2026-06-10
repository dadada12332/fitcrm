import { Navbar } from "@/components/landing/Navbar"
import { Hero } from "@/components/landing/Hero"
import { Clients } from "@/components/landing/Clients"
import { Features } from "@/components/landing/Features"
import { Testimonials } from "@/components/landing/Testimonials"
import { Pricing } from "@/components/landing/Pricing"
import { Faq } from "@/components/landing/Faq"
import { Download } from "@/components/landing/Download"
import { Footer } from "@/components/landing/Footer"

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Clients />
      <Features />
      <Testimonials />
      <Pricing />
      <Faq />
      <Download />
      <Footer />
    </main>
  )
}
