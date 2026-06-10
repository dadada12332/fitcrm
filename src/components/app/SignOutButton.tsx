"use client"

import { LogOut } from "lucide-react"
import { signOut } from "@/app/(auth)/actions"

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-xs font-medium transition-colors"
        style={{ background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}
      >
        <LogOut className="w-4 h-4" />
        Выйти
      </button>
    </form>
  )
}
