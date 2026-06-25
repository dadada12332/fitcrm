import type { Metadata } from "next"
import { Inter, Oswald } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/ThemeProvider"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800", "900"],
})

const oswald = Oswald({
  variable: "--font-display",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
})

export const metadata: Metadata = {
  title: "FitCRM — CRM для фитнес-клубов Узбекистана",
  description:
    "Управляйте клиентами, абонементами и расписанием в одном месте. QR-чекин, Telegram-бот и аналитика для вашего фитнес-клуба.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={`${inter.variable} ${oswald.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
