import type { Metadata } from "next"
import Script from "next/script"
import { TelegramMiniApp } from "@/components/telegram/TelegramMiniApp"

export const metadata: Metadata = {
  title: "Личный кабинет",
  robots: { index: false, follow: false },
}

export default async function TelegramMiniAppPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js?63" strategy="beforeInteractive" />
      <TelegramMiniApp clubId={clubId} />
    </>
  )
}
