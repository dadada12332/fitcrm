import { SmoothScroll } from "@/components/landing/SmoothScroll"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Тему задаёт каждый вариант сам (у / — тёмный, у /v2 — светлый и т.д.).
  return (
    <>
      <SmoothScroll />
      {children}
    </>
  )
}
