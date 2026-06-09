import Link from "next/link"

const productLinks = [
  { label: "Возможности", href: "#features" },
  { label: "Тарифы", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Документация", href: "/docs" },
]

const companyLinks = [
  { label: "О нас", href: "/about" },
  { label: "Блог", href: "/blog" },
  { label: "Контакты", href: "/contact" },
  { label: "Конфиденциальность", href: "/privacy" },
]

const contactLinks = [
  { label: "Telegram", href: "https://t.me/fitcrm_uz" },
  { label: "Instagram", href: "#" },
  { label: "info@fitcrm.uz", href: "mailto:info@fitcrm.uz" },
]

export function Footer() {
  return (
    <footer className="py-16" style={{ background: "var(--cta-dark)" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-14">
          <div className="md:col-span-1">
            <span className="block font-bold text-xl mb-4 tracking-tight" style={{ color: "var(--on-dark)" }}>
              FitCRM
            </span>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--on-dark-soft)" }}>
              CRM-система для фитнес-клубов Узбекистана. Управляйте бизнесом умнее.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center h-9 px-4 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "var(--on-dark)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              Попробовать бесплатно →
            </Link>
          </div>

          {[
            { title: "Продукт", links: productLinks },
            { title: "Компания", links: companyLinks },
            { title: "Контакты", links: contactLinks },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold mb-5" style={{ color: "var(--on-dark)" }}>
                {col.title}
              </h4>
              <ul className="flex flex-col gap-3">
                {col.links.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm transition-opacity hover:opacity-80"
                      style={{ color: "var(--on-dark-soft)" }}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          <p className="text-xs" style={{ color: "var(--on-dark-soft)", opacity: 0.5 }}>
            © 2026 FitCRM. Все права защищены.
          </p>
          <p className="text-xs" style={{ color: "var(--on-dark-soft)", opacity: 0.35 }}>
            Ташкент, Узбекистан
          </p>
        </div>
      </div>
    </footer>
  )
}
