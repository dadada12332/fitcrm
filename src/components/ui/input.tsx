import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl px-4 text-sm outline-none transition-colors",
        "placeholder:text-[var(--on-dark-soft)] disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-[var(--orange)]",
        className,
      )}
      style={{
        background: "var(--card-2)",
        border: "1px solid var(--border)",
        color: "var(--on-dark)",
      }}
      {...props}
    />
  )
}

export { Input }
