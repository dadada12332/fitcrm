import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors resize-none",
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

export { Textarea }
