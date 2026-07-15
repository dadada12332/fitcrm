import { SmoothScroll } from "@/components/landing/SmoothScroll"
import { LangProvider } from "@/lib/i18n/context"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <SmoothScroll>{children}</SmoothScroll>
    </LangProvider>
  )
}
