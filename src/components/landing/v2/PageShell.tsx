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

export type LegalBlock = {
  h: string
  body?: string[]
  bullets?: string[]
  note?: string
  table?: {
    headers: string[]
    rows: string[][]
  }
}

// Легальные страницы (условия, конфиденциальность, cookies)
export function LegalArticle({
  updated,
  version,
  intro,
  blocks,
}: {
  updated: string
  version?: string
  intro?: string[]
  blocks: LegalBlock[]
}) {
  return (
    <div className="mx-auto grid max-w-[1120px] gap-12 px-6 py-16 md:grid-cols-[240px_minmax(0,760px)] md:py-20">
      <aside className="self-start md:sticky md:top-24">
        <p className="text-sm text-muted-foreground">Последнее обновление: {updated}</p>
        {version && <p className="mt-1 text-sm text-muted-foreground">Версия: {version}</p>}
        <nav className="mt-7 hidden border-l border-border pl-4 md:block" aria-label="Содержание документа">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Содержание</p>
          <ol className="space-y-2.5">
            {blocks.map((block, index) => (
              <li key={block.h}>
                <a className="text-sm leading-5 text-muted-foreground transition-colors hover:text-foreground" href={`#section-${index + 1}`}>
                  {index + 1}. {block.h}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>

      <article>
        {intro && (
          <div className="mb-12 rounded-2xl border border-border bg-muted/40 p-5 md:p-6">
            {intro.map((paragraph) => (
              <p key={paragraph} className="mb-3 text-[15px] leading-7 text-foreground/80 last:mb-0">{paragraph}</p>
            ))}
          </div>
        )}

        {blocks.map((block, index) => (
          <section id={`section-${index + 1}`} key={block.h} className="mb-12 scroll-mt-28">
            <h2 className="mb-4 text-[22px] font-semibold tracking-[-0.02em] text-foreground">
              {index + 1}. {block.h}
            </h2>
            {block.body?.map((paragraph) => (
              <p key={paragraph} className="mb-3 text-[15px] leading-7 text-muted-foreground">{paragraph}</p>
            ))}
            {block.bullets && (
              <ul className="my-4 list-disc space-y-2 pl-5 text-[15px] leading-7 text-muted-foreground marker:text-foreground/40">
                {block.bullets.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
            {block.table && (
              <div className="my-5 overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                  <thead className="bg-muted/60 text-foreground">
                    <tr>
                      {block.table.headers.map((header) => (
                        <th key={header} className="border-b border-border px-4 py-3 font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.table.rows.map((row, rowIndex) => (
                      <tr key={`${block.h}-${rowIndex}`} className="border-b border-border last:border-0">
                        {row.map((cell, cellIndex) => (
                          <td key={`${cell}-${cellIndex}`} className="px-4 py-3 align-top leading-6 text-muted-foreground">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {block.note && (
              <p className="mt-5 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-foreground/80">
                {block.note}
              </p>
            )}
          </section>
        ))}
      </article>
    </div>
  )
}
