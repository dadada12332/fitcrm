import type { Metadata } from "next"
import { Onest, Oswald, Playfair_Display } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/ThemeProvider"
import { AppToaster } from "@/components/AppToaster"
import { CookieNotice } from "@/components/legal/CookieNotice"

const onest = Onest({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
})

const oswald = Oswald({
  variable: "--font-display",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
})

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin", "cyrillic"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
})

const SITE_URL = "https://fitcrm-three.vercel.app"
const DESCRIPTION = "Управляйте клиентами, абонементами и расписанием в одном месте. QR-чекин, Telegram-бот, оплаты и AI-аналитика для вашего фитнес-клуба."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Zalkins — CRM для фитнес-клубов Узбекистана",
    template: "%s — Zalkins",
  },
  description: DESCRIPTION,
  applicationName: "Zalkins",
  keywords: [
    "CRM для фитнес-клуба", "программа для фитнес-клуба", "учёт клиентов фитнес",
    "абонементы CRM", "QR чекин зал", "CRM для тренажёрного зала", "фитнес CRM Узбекистан",
    "fitness CRM", "gym management software",
  ],
  authors: [{ name: "Zalkins" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    alternateLocale: ["en_US", "uz_UZ"],
    url: SITE_URL,
    siteName: "Zalkins",
    title: "Zalkins — CRM для фитнес-клубов",
    description: DESCRIPTION,
    images: [{ url: "/screens/hero-dashboard.png", width: 1200, height: 630, alt: "Zalkins" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zalkins — CRM для фитнес-клубов",
    description: DESCRIPTION,
    images: ["/screens/hero-dashboard.png"],
  },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={`${onest.variable} ${oswald.variable} ${playfair.variable} h-full antialiased overflow-x-hidden`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <ThemeProvider>
          {children}
          <CookieNotice />
          <AppToaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
