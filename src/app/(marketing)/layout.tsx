import { SmoothScroll } from "@/components/landing/SmoothScroll"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Тёмную тему лендинга задаёт сама страница (main.dark.landing-premium).
  return (
    <>
      <SmoothScroll />
      {children}
    </>
  )
}
