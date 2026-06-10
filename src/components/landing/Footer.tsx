import Link from "next/link"
import { Zap, ArrowRight } from "lucide-react"

const productLinks = [
  { label: "Возможности", href: "#features" },
  { label: "Тарифы", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Скачать", href: "#download" },
]

const companyLinks = [
  { label: "О нас", href: "/about" },
  { label: "Блог", href: "/blog" },
  { label: "Контакты", href: "/contact" },
  { label: "Конфиденциальность", href: "/privacy" },
]

const socialLinks = [
  { label: "Telegram", href: "https://t.me/fitcrm_uz" },
  { label: "Instagram", href: "#" },
  { label: "info@fitcrm.uz", href: "mailto:info@fitcrm.uz" },
]

export function Footer() {
  return (
    <footer className="px-4 pb-10 pt-16" style={{ background: "var(--bg)" }}>
      <div
        className="max-w-[1500px] mx-auto rounded-3xl p-10 md:p-14"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr_1.5fr] gap-12 mb-14">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: "var(--orange)" }}>
                <Zap className="w-4 h-4 text-white" fill="white" />
              </span>
              <span className="text-lg text-white" style={{ fontFamily: "var(--font-display)", textTransform: "uppercase" }}>
                FitCRM
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: "var(--on-dark-soft)" }}>
              CRM-система для фитнес-клубов Узбекистана. Управляйте бизнесом умнее.
            </p>
          </div>

          {/* Links */}
          {[
            { title: "Продукт", links: productLinks },
            { title: "Компания", links: companyLinks },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="text-sm mb-5 text-white" style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {col.title}
              </h4>
              <ul className="flex flex-col gap-3">
                {col.links.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="text-sm transition-colors hover:text-white" style={{ color: "var(--on-dark-soft)" }}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Subscribe */}
          <div>
            <h4 className="text-sm mb-3 text-white" style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Подпишитесь на обновления
            </h4>
            <p className="text-sm mb-4" style={{ color: "var(--on-dark-soft)" }}>
              Новости продукта и подборки фич.
            </p>
            <form className="flex items-center gap-2 p-1 rounded-full" style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
              <input
                type="email"
                placeholder="Ваш email"
                className="flex-1 bg-transparent px-4 py-2 text-sm outline-none"
                style={{ color: "var(--on-dark)" }}
              />
              <button
                type="submit"
                aria-label="Подписаться"
                className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0"
                style={{ background: "var(--orange)" }}
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>
            © 2026 FitCRM. Все права защищены. · Ташкент, Узбекистан
          </p>
          <div className="flex gap-5">
            {socialLinks.map((s) => (
              <Link key={s.label} href={s.href} className="text-xs transition-colors hover:text-white" style={{ color: "var(--on-dark-soft)" }}>
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
