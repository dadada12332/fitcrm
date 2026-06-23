"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "@/lib/utils"

export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full outline-none transition-colors",
        "bg-[#cbd5e1] data-[checked]:bg-[#0f172a]",
        "focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-1",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block h-5 w-5 rounded-full bg-white shadow transition-transform translate-x-0.5 data-[checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  )
}
