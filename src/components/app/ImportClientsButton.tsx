"use client"

import { useRef, useState, useTransition } from "react"
import { Upload, X, CheckCircle, AlertCircle, FileText } from "lucide-react"
import { importClientsAction, type ImportClientRow } from "@/app/(app)/clients/actions"

type ParsedRow = ImportClientRow & { _valid: boolean; _error?: string }

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []

  // Detect header row
  const firstLine = lines[0].toLowerCase()
  const hasHeader =
    firstLine.includes("имя") || firstLine.includes("name") ||
    firstLine.includes("телефон") || firstLine.includes("phone")
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines.map((line) => {
    // Handle quoted CSV fields
    const fields: string[] = []
    let cur = ""
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuote = !inQuote; continue }
      if (ch === "," && !inQuote) { fields.push(cur); cur = ""; continue }
      cur += ch
    }
    fields.push(cur)

    const [full_name = "", phone = "", email = "", notes = "", gender = ""] = fields.map((f) => f.trim())
    const valid = full_name.length > 0
    return { full_name, phone, email, notes, gender, _valid: valid, _error: valid ? undefined : "Нет имени" }
  }).filter((r) => r.full_name || r.phone)
}

export function ImportClientsButton() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState("")
  const [result, setResult] = useState<{ ok?: boolean; error?: string; imported?: number } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setRows(parseCSV(text))
      setOpen(true)
    }
    reader.readAsText(file, "utf-8")
    e.target.value = ""
  }

  function handleClose() {
    setOpen(false)
    setRows([])
    setResult(null)
  }

  function handleImport() {
    const valid = rows.filter((r) => r._valid)
    startTransition(async () => {
      const res = await importClientsAction(valid.map(({ _valid, _error, ...r }) => r))
      setResult(res)
      if (res.ok) setRows([])
    })
  }

  const validCount = rows.filter((r) => r._valid).length

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />

      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        style={{ background: "var(--card)", color: "var(--on-dark)", border: "1px solid var(--border)" }}
      >
        <Upload className="w-4 h-4" />
        Импорт клиентов
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-lg rounded-2xl flex flex-col"
            style={{ background: "var(--card)", border: "1px solid var(--border)", maxHeight: "80vh" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" style={{ color: "#2563eb" }} />
                <span className="font-semibold text-sm" style={{ color: "var(--on-dark)" }}>
                  Импорт клиентов
                </span>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <X className="w-4 h-4" style={{ color: "var(--on-dark-soft)" }} />
              </button>
            </div>

            {/* Result state */}
            {result ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10 px-5">
                {result.ok ? (
                  <>
                    <CheckCircle className="w-12 h-12" style={{ color: "#16a34a" }} />
                    <p className="text-base font-semibold" style={{ color: "var(--on-dark)" }}>
                      Импорт завершён!
                    </p>
                    <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>
                      Добавлено клиентов: <strong>{result.imported}</strong>
                    </p>
                    <button onClick={handleClose}
                      className="mt-2 h-9 px-5 rounded-lg text-sm font-medium text-white"
                      style={{ background: "#2563eb" }}>
                      Готово
                    </button>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-12 h-12" style={{ color: "#dc2626" }} />
                    <p className="text-sm text-center" style={{ color: "var(--on-dark-soft)" }}>{result.error}</p>
                    <button onClick={() => setResult(null)}
                      className="mt-2 h-9 px-5 rounded-lg text-sm font-medium"
                      style={{ border: "1px solid var(--border)", color: "var(--on-dark)" }}>
                      Назад
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* Info */}
                <div className="px-5 py-3 text-xs" style={{ color: "var(--on-dark-soft)", borderBottom: "1px solid var(--border)", background: "var(--card-2)" }}>
                  <span className="font-medium" style={{ color: "var(--on-dark)" }}>{fileName}</span>
                  {" · "}Найдено строк: <strong>{rows.length}</strong>
                  {" · "}Готово к импорту: <strong style={{ color: validCount > 0 ? "#16a34a" : "#dc2626" }}>{validCount}</strong>
                  <br />
                  <span className="mt-1 block">Формат CSV: <code>Имя, Телефон, Email, Заметки</code></span>
                </div>

                {/* Preview */}
                <div className="flex-1 overflow-y-auto">
                  {rows.slice(0, 50).map((r, i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-2.5 text-sm"
                      style={{ borderBottom: "1px solid var(--border)", background: r._valid ? undefined : "rgba(220,38,38,0.04)" }}>
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r._valid ? "bg-green-500" : "bg-red-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate" style={{ color: "var(--on-dark)" }}>{r.full_name || "—"}</p>
                        <p className="text-xs truncate" style={{ color: "var(--on-dark-soft)" }}>
                          {[r.phone, r.email].filter(Boolean).join(" · ") || "нет контактов"}
                        </p>
                      </div>
                      {!r._valid && (
                        <span className="text-xs flex-shrink-0" style={{ color: "#dc2626" }}>{r._error}</span>
                      )}
                    </div>
                  ))}
                  {rows.length > 50 && (
                    <p className="px-5 py-3 text-xs" style={{ color: "var(--on-dark-soft)" }}>
                      + ещё {rows.length - 50} строк…
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <button onClick={handleClose}
                    className="flex-1 h-10 rounded-xl text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    style={{ border: "1px solid var(--border)", color: "var(--on-dark)" }}>
                    Отмена
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={validCount === 0 || isPending}
                    className="flex-1 h-10 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: "#2563eb" }}>
                    {isPending ? "Импортирую…" : `Импортировать ${validCount}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
