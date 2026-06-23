"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center flex-shrink-0 transition-colors outline-none",
        "border-[#cbd5e1] data-[checked]:bg-[#0f172a] data-[checked]:border-[#0f172a]",
        "focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-1",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
        <Check className="w-3 h-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
