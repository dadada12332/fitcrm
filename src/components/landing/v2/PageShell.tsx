import Link from "next/link"
import { Zap } from "lucide-react"
import { Footer } from "./Footer"

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#ffffff" }}>
      {/* Шапка */}
      <header className="sticky top-0 z-50" style={{ background: "rgba(255,255,255,0.8)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
        <div className="mx-auto max-w-[1280px] px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-md flex items-center justify-center bg-neutral-900">
              <Zap className="w-4 h-4 text-white" fill="currentColor" />
            </span>
            <span className="text-[15px] font-semibold text-[#0a0a0a]">FitCRM</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-[14px]" style={{ color: "#52525b" }}>
            <Link href="/#features" className="hover:text-[#0a0a0a] transition-colors">Возможности</Link>
            <Link href="/#pricing" className="hover:text-[#0a0a0a] transition-colors">Тарифы</Link>
            <Link href="/#faq" className="hover:text-[#0a0a0a] transition-colors">FAQ</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:flex text-[14px] font-medium text-[#0a0a0a]">Войти</Link>
            <Link href="/register" className="h-9 px-4 flex items-center rounded-full text-[14px] font-medium text-white transition-opacity hover:opacity-90" style={{ background: "#0065fc" }}>
              Начать бесплатно
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>
      <Footer />
    </div>
  )
}

export function PageHero({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <section className="relative overflow-hidden" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 50% 65% at 50% 0%, rgba(0,101,252,0.09), transparent 60%)" }} />
      <div className="relative mx-auto max-w-[900px] px-6 py-20 md:py-28 text-center">
        {eyebrow && <div className="font-mono text-[12.5px] tracking-[0.1em] mb-4" style={{ color: "#0065fc" }}>{eyebrow}</div>}
        <h1 className="text-[40px] md:text-[52px] font-normal leading-[1.05] tracking-[-1.4px] text-[#0a0a0a]">{title}</h1>
        {subtitle && <p className="mt-5 text-[17px] leading-[27px] max-w-[640px] mx-auto" style={{ color: "#52525b" }}>{subtitle}</p>}
      </div>
    </section>
  )
}

// Легальные страницы (условия, конфиденциальность)
export function LegalArticle({ updated, blocks }: { updated: string; blocks: { h: string; body: string[] }[] }) {
  return (
    <div className="mx-auto max-w-[760px] px-6 py-16 md:py-20">
      <p className="text-[13px] mb-12" style={{ color: "#9ca3af" }}>Последнее обновление: {updated}</p>
      {blocks.map((b, i) => (
        <div key={i} className="mb-10">
          <h2 className="text-[21px] font-semibold text-[#0a0a0a] mb-3">{i + 1}. {b.h}</h2>
          {b.body.map((p, j) => (
            <p key={j} className="text-[15px] leading-[26px] mb-3" style={{ color: "#52525b" }}>{p}</p>
          ))}
        </div>
      ))}
    </div>
  )
}
