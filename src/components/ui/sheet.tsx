"use client"

import * as React from "react"
import { Dialog } from "@base-ui/react/dialog"
import { cn } from "@/lib/utils"

export const Sheet = Dialog.Root
export const SheetTrigger = Dialog.Trigger
export const SheetClose = Dialog.Close

export function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Dialog.Popup>) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop
        className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
      />
      <Dialog.Popup
        className={cn(
          "fixed right-0 top-0 z-50 h-dvh w-full max-w-[440px] flex flex-col bg-white outline-none",
          "border-l shadow-2xl transition-transform duration-300 ease-out",
          "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
          className,
        )}
        style={{ borderColor: "#e2e8f0" }}
        {...props}
      >
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  )
}

export function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-between px-6 h-16 flex-shrink-0", className)}
      style={{ borderBottom: "1px solid #e2e8f0" }}
      {...props}
    />
  )
}

export function SheetTitle({ className, ...props }: React.ComponentProps<typeof Dialog.Title>) {
  return (
    <Dialog.Title
      className={cn("text-xl font-semibold tracking-[-0.12px]", className)}
      style={{ color: "#020617" }}
      {...props}
    />
  )
}

export function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex-1 overflow-y-auto px-6 py-5", className)} {...props} />
}

export function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-3 px-6 h-20 flex-shrink-0", className)}
      style={{ borderTop: "1px solid #e2e8f0" }}
      {...props}
    />
  )
}
