"use client"

import { useState } from "react"
import { Upload } from "lucide-react"
import { ImportWizard } from "./ImportWizard"

export function ImportClientsButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        style={{ background: "var(--card)", color: "var(--on-dark)", border: "1px solid var(--border)" }}
      >
        <Upload className="w-4 h-4" />
        Импорт клиентов
      </button>

      {open && <ImportWizard onClose={() => setOpen(false)} />}
    </>
  )
}
