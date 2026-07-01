import { SmoothScroll } from "@/components/landing/SmoothScroll"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    // Лендинг всегда тёмный — независимо от темы приложения.
    // .dark даёт тёмные токены дизайн-системы, .landing-premium — палитру концепта Solaris.
    <div className="dark landing-premium min-h-screen">
      <SmoothScroll />
      {children}
    </div>
  )
}
