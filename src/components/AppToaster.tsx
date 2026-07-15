"use client"

import { Toaster } from "sonner"
import { useTheme } from "next-themes"

/** Единый тост-слой всего приложения (тема-aware). */
export function AppToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      position="top-center"
      theme={(resolvedTheme as "light" | "dark") ?? "system"}
      richColors
      closeButton
      toastOptions={{ style: { fontFamily: "var(--font-sans)" } }}
    />
  )
}
