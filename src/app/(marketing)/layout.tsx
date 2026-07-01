export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    // Лендинг всегда тёмный — независимо от темы приложения.
    // .dark даёт тёмные токены дизайн-системы, .landing-premium — премиум-палитру и утилиты.
    <div className="dark landing-premium min-h-screen">
      <div className="lp-glows" aria-hidden />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
