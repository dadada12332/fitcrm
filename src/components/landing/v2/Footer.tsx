"use client"

import Link from "next/link"
import { Zap, Send, MessageCircle, Camera } from "lucide-react"
import { useT } from "@/lib/i18n/context"

const SOCIALS = [
  { icon: Send,          href: "https://t.me/fitcrm",  label: "Telegram" },
  { icon: MessageCircle, href: "https://wa.me/998",     label: "WhatsApp" },
  { icon: Camera,        href: "https://instagram.com", label: "Instagram" },
]

export function Footer() {
  const t = useT()
  const l = t.footer.l

  const COLS = [
    { title: t.footer.product, links: [
      { label: l.features, href: "/#features" },
      { label: l.pricing,  href: "/#pricing" },
      { label: l.security, href: "/#howitworks" },
      { label: l.faq,      href: "/#faq" },
    ] },
    { title: t.footer.resources, links: [
      { label: l.docs, href: "/docs" },
      { label: l.blog, href: "/blog" },
      { label: l.help, href: "/contacts" },
    ] },
    { title: t.footer.company, links: [
      { label: l.about,    href: "/about" },
      { label: l.contacts, href: "/contacts" },
      { label: l.terms,    href: "/terms" },
      { label: l.privacy,  href: "/privacy" },
    ] },
  ]

  return (
    <footer style={{ background: "#ffffff" }}>
      <div className="h-px w-full" style={{ background: "linear-gradient(to right, transparent, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.1) 70%, transparent)" }} />

      <div className="mx-auto max-w-[1280px] px-6 md:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 pb-16">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-6">
              <span className="w-7 h-7 rounded-md flex items-center justify-center bg-neutral-900">
                <Zap className="w-4 h-4 text-white" fill="currentColor" />
              </span>
              <span className="text-[15px] font-semibold text-[#0a0a0a]">FitCRM</span>
            </Link>
            <p className="text-[14px] font-normal leading-[21px] text-[#52525b] max-w-[300px]">
              {t.footer.brand}
            </p>
            <div className="flex items-center gap-2.5 mt-8">
              {SOCIALS.map(({ icon: Icon, href, label }) => (
                <Link key={label} href={href} aria-label={label} target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: "#f4f5f7", border: "1px solid rgba(0,0,0,0.06)", color: "#52525b" }}>
                  <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                </Link>
              ))}
            </div>
          </div>

          {COLS.map(col => (
            <div key={col.title}>
              <p className="text-[13px] font-semibold text-[#0a0a0a] mb-5">{col.title}</p>
              <ul className="flex flex-col gap-3">
                {col.links.map(link => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-[14px] font-normal text-[#52525b] hover:text-[#0a0a0a] transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="h-px w-full" style={{ background: "rgba(0,0,0,0.08)" }} />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-8">
          <p className="text-[14px] font-normal text-[#52525b]">© FitCRM, {new Date().getFullYear()}. {t.footer.rights}</p>
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
            </span>
            <span className="text-[14px] font-normal text-[#52525b]">{t.footer.status}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
