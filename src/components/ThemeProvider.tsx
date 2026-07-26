"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import { usePathname } from "next/navigation"

const MARKETING_ROUTES = new Set([
  "/",
  "/about",
  "/blog",
  "/consent",
  "/contacts",
  "/cookies",
  "/data-processing",
  "/docs",
  "/privacy",
  "/terms",
])

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMarketingRoute = MARKETING_ROUTES.has(pathname)

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme={isMarketingRoute ? "light" : undefined}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
