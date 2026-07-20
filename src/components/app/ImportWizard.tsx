"use client"

import { useState, useRef, useMemo } from "react"
import {
  X, ArrowLeft, ArrowRight, Download,
  CheckCircle, AlertCircle, AlertTriangle,
  FileSpreadsheet, ChevronDown, Search, Zap, Info,
  Lock, Cpu,
} from "lucide-react"
import {
  buildAutoMapping, CLIENT_FIELDS, getColCategory,
  type FieldKey, type MappingEntry, type ParsedFile,
  type ValidatedRow, type DuplicateStrategy, type ColStatus,
} from "@/lib/import-wizard"
import {
  checkPhonesAction, batchImportClientsAction,
  type ImportClientRow, type BatchImportResult, type ImportAudit,
} from "@/app/(app)/clients/import-actions"

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024) return `${b} Б`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} КБ`
  return `${(b / 1024 / 1024).toFixed(1)} МБ`
}

function parseCSVLine(line: string, delim: string): string[] {
  const fields: string[] = []; let cur = "", inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQ = !inQ; continue }
    if (c === delim && !inQ) { fields.push(cur.trim()); cur = ""; continue }
    cur += c
  }
  fields.push(cur.trim())
  return fields
}

function detectDelim(line: string) {
  return (line.match(/;/g)?.length ?? 0) > (line.match(/,/g)?.length ?? 0) ? ";" : ","
}

function fieldLabel(k: FieldKey) {
  return CLIENT_FIELDS.find((f) => f.key === k)?.label ?? k
}

function excelCellText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text
    if ("result" in value) return excelCellText(value.result)
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => typeof part === "object" && part && "text" in part ? String(part.text) : "").join("")
    }
  }
  return String(value)
}

// ── Step bar ──────────────────────────────────────────────────────────────────

const STEP_LABELS = ["Загрузка", "Колонки", "Предпросмотр", "Импорт", "Отчёт"]

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center px-6 py-3 gap-1 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
      {STEP_LABELS.map((label, i) => {
        const done = i < current, active = i === current
        return (
          <div key={i} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{
                  background: done ? "#22c55e" : active ? "#0f172a" : "var(--card-2)",
                  color: done || active ? "#fff" : "var(--gray-muted)",
                  border: done || active ? "none" : "1px solid var(--border)",
                }}>
                {done ? "✓" : i + 1}
              </div>
              <span className="text-xs font-medium"
                style={{ color: active ? "var(--on-dark)" : done ? "#22c55e" : "var(--gray-muted)" }}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className="w-6 h-px mx-2 flex-shrink-0" style={{ background: done ? "#22c55e" : "var(--border)" }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1: Upload ────────────────────────────────────────────────────────────

function Step1Upload({ onParsed }: { onParsed: (f: ParsedFile) => void }) {
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function process(file: File) {
    setError(null); setParsing(true)
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
      if (!["csv", "xlsx"].includes(ext)) { setError("Поддерживаются: XLSX, CSV"); setParsing(false); return }
      if (file.size > 25 * 1024 * 1024) { setError("Файл слишком большой (макс. 25 МБ)"); setParsing(false); return }

      let headers: string[] = [], rawRows: string[][] = []

      if (ext === "csv") {
        const text = await file.text()
        const lines = text.split(/\r?\n/).filter((l) => l.trim())
        if (!lines.length) { setError("Файл пустой"); setParsing(false); return }
        const delim = detectDelim(lines[0])
        headers = parseCSVLine(lines[0], delim)
        rawRows = lines.slice(1).map((l) => parseCSVLine(l, delim))
      } else {
        const ExcelJS = (await import("exceljs")).default
        const buf = await file.arrayBuffer()
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(buf)
        const worksheet = workbook.worksheets[0]
        const data: string[][] = []
        worksheet?.eachRow({ includeEmpty: true }, (row) => {
          const values = Array.from({ length: worksheet.columnCount }, (_, index) => excelCellText(row.getCell(index + 1).value))
          data.push(values)
        })
        if (!data.length) { setError("Файл пустой"); setParsing(false); return }
        headers = data[0].map(String)
        rawRows = data.slice(1).map((r) => r.map(String))
      }

      const rows = rawRows.filter((r) => r.some((v) => String(v ?? "").trim()))
      if (!headers.filter((h) => h.trim()).length) { setError("Не удалось прочитать заголовки"); setParsing(false); return }
      if (!rows.length) { setError("В файле нет данных (только заголовок)"); setParsing(false); return }
      if (rows.length > 15_000) { setError("Слишком много строк (максимум 15 000)"); setParsing(false); return }
      onParsed({ headers, rows, totalRows: rows.length, fileName: file.name, fileSize: file.size })
    } catch { setError("Ошибка чтения файла — проверьте формат") }
    setParsing(false)
  }

  async function downloadTemplate() {
    const ExcelJS = (await import("exceljs")).default
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Клиенты")
    worksheet.addRows([
      ["Имя", "Телефон", "Email", "Дата рождения", "Пол", "Источник", "Заметки"],
      ["Иванов Иван Иванович", "+998901234567", "ivan@example.com", "1990-05-15", "м", "Instagram", ""],
      ["Сидорова Мария", "+998909876543", "maria@example.com", "1995-08-22", "ж", "Реклама", "VIP"],
    ])
    worksheet.columns = [24, 16, 24, 14, 6, 14, 20].map((width) => ({ width }))
    const buffer = await workbook.xlsx.writeBuffer()
    const url = URL.createObjectURL(new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "fitcrm_clients_template.xlsx"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h2 className="text-base font-semibold" style={{ color: "var(--on-dark)" }}>Загрузите файл с клиентами</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--on-dark-soft)" }}>Любой Excel или CSV — CRM сама разберётся с колонками</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) process(f) }}
        onClick={() => !parsing && fileRef.current?.click()}
        className="flex flex-col items-center justify-center gap-4 rounded-2xl cursor-pointer transition-all select-none"
        style={{
          border: `2px dashed ${dragging ? "#0f172a" : "var(--border)"}`,
          background: dragging ? "rgba(15,23,42,0.03)" : "var(--card-2)",
          padding: "52px 24px",
        }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {parsing
            ? <div className="w-6 h-6 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
            : <FileSpreadsheet className="w-7 h-7" style={{ color: "#0f172a" }} />}
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>
            {parsing ? "Читаю файл…" : "Перетащите файл или нажмите"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>
            XLSX · CSV &nbsp;·&nbsp; до 25 МБ &nbsp;·&nbsp; до 15 000 строк
          </p>
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) process(f); e.target.value = "" }} />

      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
          style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#dc2626" }} />
          <p className="text-sm" style={{ color: "#dc2626" }}>{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Не знаете какой формат нужен?</p>
        <button onClick={downloadTemplate}
          className="flex items-center gap-1.5 text-xs font-medium hover:opacity-70 transition-opacity"
          style={{ color: "#2563eb" }}>
          <Download className="w-3.5 h-3.5" />Скачать шаблон XLSX
        </button>
      </div>
    </div>
  )
}

// ── Step 2: Column Mapping ────────────────────────────────────────────────────

// Status visual config
const STATUS_CONFIG: Record<ColStatus, { dot: string; badge: string; badgeBg: string; label: string }> = {
  auto:      { dot: "#22c55e", badge: "#15803d", badgeBg: "rgba(22,163,74,0.14)", label: "Авто" },
  suggested: { dot: "#f59e0b", badge: "#92400e", badgeBg: "rgba(217,119,6,0.14)", label: "Вероятно" },
  manual:    { dot: "#3b82f6", badge: "#1d4ed8", badgeBg: "rgba(37,99,235,0.14)", label: "Вручную" },
  unknown:   { dot: "#f97316", badge: "#c2410c", badgeBg: "rgba(249,115,22,0.14)", label: "?" },
  skip:      { dot: "var(--border)", badge: "var(--gray-muted)", badgeBg: "var(--card-2)", label: "Пропуск" },
}

function Step2Mapping({
  parsed, mapping, autoAtParseCols, manualCols, autoMode, onChange, onCustomLabel, onAutoToggle,
}: {
  parsed: ParsedFile
  mapping: MappingEntry[]
  autoAtParseCols: Set<string>
  manualCols: Set<string>
  autoMode: boolean
  onChange: (col: string, key: FieldKey) => void
  onCustomLabel: (col: string, label: string) => void
  onAutoToggle: () => void
}) {
  const [search, setSearch] = useState("")

  // ── status per column ──
  function getStatus(m: MappingEntry): ColStatus {
    if (m.fieldKey === "custom") return "manual"
    if (manualCols.has(m.fileCol)) {
      return m.fieldKey === "__skip__" ? "skip" : "manual"
    }
    if (m.fieldKey === "__skip__") {
      // Has a detection hint stored → show as "suggested" so user knows there's a suggestion
      if (m.detection && m.detection.confidence >= 55) return "suggested"
      return "unknown"
    }
    if (autoAtParseCols.has(m.fileCol)) {
      // Auto-assigned: mark as "suggested" if detection confidence was below 90
      return (!m.detection || m.detection.confidence >= 90) ? "auto" : "suggested"
    }
    return "manual"
  }

  // ── badge label (shows confidence for suggested) ──
  function getBadgeLabel(m: MappingEntry, status: ColStatus): string {
    if (status === "suggested") {
      const conf = m.detection?.confidence ?? 0
      if (m.fieldKey === "__skip__" && m.detection) {
        const label = CLIENT_FIELDS.find((f) => f.key === m.detection!.key)?.label ?? ""
        return `${label}? ${conf}%`
      }
      return `${conf}%`
    }
    return STATUS_CONFIG[status].label
  }

  // ── aggregate stats (only importable columns; system/computed are excluded) ──
  const stats = useMemo(() => {
    let auto = 0, suggested = 0, manual = 0, unknown = 0, skip = 0
    for (const m of mapping) {
      if (getColCategory(m.fileCol) !== "importable") continue
      const s = getStatus(m)
      if (s === "auto")           auto++
      else if (s === "suggested") suggested++
      else if (s === "manual")    manual++
      else if (s === "unknown")   unknown++
      else                        skip++
    }
    const importableTotal = mapping.filter(m => getColCategory(m.fileCol) === "importable").length
    return { auto, suggested, manual, unknown, skip, mapped: auto + suggested + manual, importableTotal }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping, autoAtParseCols, manualCols])

  // ── dropdown: which fields are already used in OTHER columns ──
  const usedFieldKeys = useMemo(() => {
    const used = new Set<FieldKey>()
    for (const m of mapping) {
      if (m.fieldKey !== "__skip__") used.add(m.fieldKey)
    }
    return used
  }, [mapping])

  // Returns whether a field is already taken by ANOTHER column (just for label hint, NOT disabled)
  function isTakenByOther(optKey: FieldKey, currentKey: FieldKey): boolean {
    if (optKey === "__skip__" || optKey === currentKey) return false
    const def = CLIENT_FIELDS.find((f) => f.key === optKey)
    if (!def?.unique) return false
    return usedFieldKeys.has(optKey)
  }

  // ── internal duplicates (by phone column) ──
  const internalDups = useMemo(() => {
    const phoneEntry = mapping.find((m) => m.fieldKey === "phone")
    if (!phoneEntry) return 0
    const idx = parsed.headers.indexOf(phoneEntry.fileCol)
    if (idx < 0) return 0
    const counts: Record<string, number> = {}
    for (const row of parsed.rows) {
      const p = row[idx]?.trim()
      if (p) counts[p] = (counts[p] || 0) + 1
    }
    return Object.values(counts).filter((c) => c > 1).length
  }, [mapping, parsed])

  // ── required fields not yet mapped ──
  const unmappedRequired = CLIENT_FIELDS.filter(
    (f) => f.required && !mapping.some((m) => m.fieldKey === f.key)
  )
  const hasNameMapped = mapping.some((m) => ["full_name", "first_name", "last_name"].includes(m.fieldKey))
  const nameMapped = unmappedRequired.length === 0 && hasNameMapped
  const filtered = search
    ? mapping.filter((m) => m.fileCol.toLowerCase().includes(search.toLowerCase()))
    : mapping

  // ── preview values for a column ──
  function preview(col: string) {
    const idx = parsed.headers.indexOf(col)
    return parsed.rows.slice(0, 3).map((r) => String(r[idx] ?? "").trim()).filter(Boolean).slice(0, 2).join(", ")
  }

  const pct = Math.round((stats.mapped / (stats.importableTotal || 1)) * 100)

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--on-dark)" }}>Сопоставление колонок</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--on-dark-soft)" }}>
            Проверьте автоматические соответствия и скорректируйте вручную при необходимости
          </p>
        </div>
        <button onClick={onAutoToggle}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold flex-shrink-0 transition-all"
          style={autoMode
            ? { background: "#0f172a", color: "#fff", border: "1px solid #0f172a" }
            : { background: "var(--card)", color: "var(--on-dark)", border: "1px solid var(--border)" }
          }>
          <Zap className="w-3 h-3" style={{ fill: autoMode ? "#facc15" : "none" }} />
          {autoMode ? "Авто ВКЛ" : "Включить авто"}
        </button>
      </div>

      {/* File info cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Строк",   value: parsed.totalRows.toLocaleString("ru-RU"), color: "var(--on-dark)" },
          { label: "Колонок", value: String(parsed.headers.length), color: "var(--on-dark)" },
          { label: "Размер",  value: fmtBytes(parsed.fileSize), color: "var(--on-dark)" },
          {
            label: "Авто",
            value: `${stats.auto}/${parsed.headers.length}`,
            color: pct >= 70 ? "#16a34a" : pct >= 40 ? "#d97706" : "#dc2626",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-3 text-center"
            style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
            <p className="text-base font-semibold tabular-nums" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--on-dark-soft)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Status summary strip */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs flex-wrap"
        style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
        {[
          { dot: STATUS_CONFIG.auto.dot,      count: stats.auto,      label: "авто" },
          { dot: STATUS_CONFIG.suggested.dot, count: stats.suggested, label: "вероятно" },
          { dot: STATUS_CONFIG.manual.dot,    count: stats.manual,    label: "вручную" },
          { dot: STATUS_CONFIG.unknown.dot,   count: stats.unknown,   label: "не определено" },
          { dot: "var(--border)",             count: stats.skip,      label: "пропущено" },
        ].filter(i => i.count > 0).map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: item.dot, border: item.label === "пропущено" ? "1px solid var(--gray-muted)" : "none" }} />
            <span style={{ color: "var(--on-dark)" }}><strong>{item.count}</strong> {item.label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, background: nameMapped ? "#22c55e" : "#f97316" }} />
          </div>
          <span style={{ color: nameMapped ? "#16a34a" : "#d97706", fontWeight: 600 }}>
            {stats.mapped}/{stats.importableTotal}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--gray-muted)" }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={`Поиск по ${mapping.length} колонкам…`}
          className="w-full h-9 pl-9 pr-3 rounded-lg text-sm outline-none"
          style={{ border: "1px solid var(--border)", color: "var(--on-dark)", background: "var(--card)" }} />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <X className="w-3.5 h-3.5" style={{ color: "var(--gray-muted)" }} />
          </button>
        )}
      </div>

      {/* Mapping table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {/* Table header */}
        <div className="grid px-4 py-2.5"
          style={{ gridTemplateColumns: "8px 1fr 1fr 1fr auto", gap: "12px", background: "var(--card-2)", borderBottom: "1px solid var(--border)" }}>
          <div />
          {["Колонка в файле", "Примеры данных", "Поле FitCRM", ""].map((h, i) => (
            <span key={i} className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--on-dark-soft)", letterSpacing: "0.06em" }}>{h}</span>
          ))}
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "min(320px, 38vh)" }}>
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--on-dark-soft)" }}>Ничего не найдено</p>
          )}
          {filtered.map((m, i) => {
            const category = getColCategory(m.fileCol)
            const status   = getStatus(m)
            const cfg      = STATUS_CONFIG[status]
            const ex       = preview(m.fileCol)
            const fieldDef = CLIENT_FIELDS.find((f) => f.key === m.fieldKey)
            const rowBorderBottom = i < filtered.length - 1 ? "1px solid var(--border)" : "none"

            // ── System / Computed rows (locked, no dropdown) ──────────────────
            if (category !== "importable") {
              const isSystem = category === "system"
              return (
                <div key={m.fileCol}
                  className="grid items-center px-4 py-2.5"
                  style={{ gridTemplateColumns: "8px 1fr 1fr 1fr auto", gap: "12px", borderBottom: rowBorderBottom, opacity: 0.55 }}>
                  {/* Icon instead of dot */}
                  <div className="flex items-center justify-center w-2 h-2 flex-shrink-0">
                    {isSystem
                      ? <Lock style={{ width: 10, height: 10, color: "#94a3b8" }} />
                      : <Cpu  style={{ width: 10, height: 10, color: "#94a3b8" }} />}
                  </div>
                  {/* Column name */}
                  <div className="min-w-0">
                    <span className="text-sm font-mono block truncate" style={{ color: "var(--gray-muted)" }}>{m.fileCol}</span>
                  </div>
                  {/* Examples */}
                  <span className="text-xs truncate" style={{ color: "var(--gray-muted)" }}>
                    {ex || "—"}
                  </span>
                  {/* Info badge spanning last 2 columns */}
                  <div style={{ gridColumn: "4 / 6", display: "flex", alignItems: "center", gap: 5 }}>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={isSystem
                        ? { background: "var(--card-2)", color: "var(--on-dark-soft)", border: "1px solid var(--border)" }
                        : { background: "rgba(2,132,199,0.12)", color: "#0284c7", border: "1px solid rgba(2,132,199,0.3)" }}>
                      {isSystem ? "🔒 Создаётся системой" : "⚙ Вычисляется системой"}
                    </span>
                  </div>
                </div>
              )
            }

            // ── Normal importable row ─────────────────────────────────────────
            return (
              <div key={m.fileCol}
                className="grid items-center px-4 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                style={{
                  gridTemplateColumns: "8px 1fr 1fr 1fr auto",
                  gap: "12px",
                  borderBottom: rowBorderBottom,
                }}>
                {/* Status dot */}
                <div className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                  style={{ background: cfg.dot, boxShadow: status !== "skip" && status !== "unknown" ? `0 0 0 3px ${cfg.dot}22` : "none" }} />

                {/* Column name */}
                <div className="min-w-0">
                  <span className="text-sm font-mono block truncate"
                    style={{ color: status === "skip" || status === "unknown" ? "var(--gray-muted)" : "var(--on-dark)" }}>
                    {m.fileCol}
                  </span>
                  {status === "unknown" && (
                    <span className="text-[10px]" style={{ color: "#f97316" }}>Не определено</span>
                  )}
                  {status === "suggested" && m.fieldKey === "__skip__" && m.detection && (
                    <span className="text-[10px]" style={{ color: "#d97706" }}>
                      Возможно: {CLIENT_FIELDS.find(f => f.key === m.detection!.key)?.label}
                    </span>
                  )}
                </div>

                {/* Examples */}
                <span className="text-xs truncate" style={{ color: "var(--on-dark-soft)" }}>
                  {ex || <span style={{ color: "var(--gray-muted)" }}>нет данных</span>}
                </span>

                {/* Dropdown */}
                <div className="relative">
                  <select
                    value={m.fieldKey}
                    onChange={(e) => onChange(m.fileCol, e.target.value as FieldKey)}
                    className="w-full h-8 pl-3 pr-7 rounded-lg text-xs appearance-none outline-none transition-all"
                    style={{
                      border: `1px solid ${
                        m.fieldKey === "custom" ? "#8b5cf6"
                        : fieldDef?.required ? "#22c55e"
                        : status === "unknown" ? "#fed7aa"
                        : status === "manual" ? "rgba(37,99,235,0.3)"
                        : "var(--border)"
                      }`,
                      color: status === "unknown" && m.fieldKey === "__skip__" ? "#c2410c" : "var(--on-dark)",
                      background: "var(--card)",
                    }}>
                    {(status === "unknown" || status === "suggested") && m.fieldKey === "__skip__" && (
                      <option value="__skip__" disabled>↓ Выберите поле</option>
                    )}
                    <option value="__skip__">— Не импортировать —</option>
                    <optgroup label="── Данные клиента ──">
                      {CLIENT_FIELDS.filter(f => f.group === "client").map((f) => {
                        const taken = isTakenByOther(f.key, m.fieldKey)
                        return (
                          <option key={f.key} value={f.key}>
                            {f.label}{f.required ? " *" : ""}{taken ? " (занято → переместится)" : ""}
                          </option>
                        )
                      })}
                    </optgroup>
                    <optgroup label="── Абонемент ──">
                      {CLIENT_FIELDS.filter(f => f.group === "subscription").map((f) => {
                        const taken = isTakenByOther(f.key, m.fieldKey)
                        return (
                          <option key={f.key} value={f.key}>
                            {f.label}{taken ? " (занято → переместится)" : ""}
                          </option>
                        )
                      })}
                    </optgroup>
                    <option value="custom">✎ Вписать название вручную</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
                    style={{ color: "var(--gray-muted)" }} />
                </div>

                {/* Status badge OR custom label input */}
                <div className="flex-shrink-0">
                  {m.fieldKey === "custom" ? (
                    <input
                      type="text"
                      value={m.customLabel ?? ""}
                      onChange={(e) => onCustomLabel(m.fileCol, e.target.value)}
                      placeholder="Название…"
                      className="h-7 w-28 px-2 rounded-lg text-xs outline-none"
                      style={{ border: "1.5px solid #8b5cf6", color: "var(--on-dark)", background: "var(--card)" }}
                    />
                  ) : (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      style={{ color: cfg.badge, background: cfg.badgeBg }}>
                      {getBadgeLabel(m, status)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Warnings */}
      <div className="flex flex-col gap-2">
        {!hasNameMapped && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
            style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)" }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#dc2626" }} />
            <p className="text-xs" style={{ color: "#dc2626" }}>
              Назначьте колонку с именем клиента (<strong>Имя</strong>, <strong>Фамилия</strong> или <strong>ФИО</strong>) — без неё импорт невозможен
            </p>
          </div>
        )}
        {unmappedRequired.length > 0 && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
            style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)" }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#dc2626" }} />
            <p className="text-xs" style={{ color: "#dc2626" }}>
              Не выбрано обязательное поле:{" "}
              <strong>{unmappedRequired.map((f) => f.label + " *").join(", ")}</strong> — импорт невозможен
            </p>
          </div>
        )}
        {internalDups > 0 && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
            style={{ background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.25)" }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#d97706" }} />
            <p className="text-xs" style={{ color: "#92400e" }}>
              В файле <strong>{internalDups}</strong> повторяющихся телефонов — стратегию можно выбрать на следующем шаге
            </p>
          </div>
        )}
        {stats.unknown > 0 && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
            style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
            <Info className="w-4 h-4 flex-shrink-0" style={{ color: "#f97316" }} />
            <p className="text-xs" style={{ color: "#c2410c" }}>
              <strong>{stats.unknown}</strong> {stats.unknown === 1 ? "колонка" : "колонок"} не определились автоматически — назначьте поля вручную или оставьте «Не импортировать»
            </p>
          </div>
        )}
        {stats.skip > 0 && nameMapped && stats.unknown === 0 && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
            style={{ background: "rgba(100,116,139,0.06)", border: "1px solid rgba(100,116,139,0.2)" }}>
            <Info className="w-4 h-4 flex-shrink-0" style={{ color: "#64748b" }} />
            <p className="text-xs" style={{ color: "var(--on-dark-soft)" }}>
              <strong>{stats.skip}</strong> {stats.skip === 1 ? "колонка будет пропущена" : "колонок будут пропущены"} при импорте
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Step 3: Preview ───────────────────────────────────────────────────────────

function Step3Preview({
  parsed, mapping, validated, dupStrategy, onStrategyChange, loading,
}: {
  parsed: ParsedFile; mapping: MappingEntry[]; validated: ValidatedRow[]
  dupStrategy: DuplicateStrategy
  onStrategyChange: (s: DuplicateStrategy) => void; loading: boolean
}) {
  const errorRows = validated.filter((r) => r.errors.length)
  const dupRows   = validated.filter((r) => r.dupPhone && !r.errors.length)
  const okRows    = validated.filter((r) => !r.errors.length && !r.dupPhone)
  const colKeys   = mapping.filter((m) => m.fieldKey !== "__skip__")
  const preview   = validated.slice(0, 20)

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h2 className="text-base font-semibold" style={{ color: "var(--on-dark)" }}>Предпросмотр</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--on-dark-soft)" }}>Первые 20 строк из {parsed.totalRows.toLocaleString("ru-RU")}</p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Всего",  value: parsed.totalRows, color: "var(--on-dark)" },
          { label: "Готово", value: okRows.length,    color: "#16a34a" },
          { label: "Дублики",value: dupRows.length,   color: "#d97706" },
          { label: "Ошибок", value: errorRows.length, color: errorRows.length ? "#dc2626" : "#16a34a" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
            <p className="text-xl font-semibold tabular-nums" style={{ color: s.color }}>{s.value.toLocaleString("ru-RU")}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--on-dark-soft)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {!loading && dupRows.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.25)" }}>
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#d97706" }} />
            <p className="text-sm font-medium" style={{ color: "#92400e" }}>
              Найдено <strong>{dupRows.length}</strong> дубликатов по телефону. Что сделать?
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {[
              { key: "skip",   label: "Пропустить дубликаты" },
              { key: "update", label: "Обновить существующих клиентов" },
              { key: "create", label: "Создать новые записи (разрешить дубликаты)" },
            ].map((opt) => (
              <label key={opt.key} className="flex items-center gap-2.5 cursor-pointer">
                <input type="radio" name="dupStrategy" value={opt.key}
                  checked={dupStrategy === opt.key} onChange={() => onStrategyChange(opt.key as DuplicateStrategy)}
                  style={{ accentColor: "#0f172a" }} />
                <span className="text-sm" style={{ color: "var(--on-dark)" }}>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10" style={{ color: "var(--on-dark-soft)" }}>
          <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
          <span className="text-sm">Проверяю дубликаты…</span>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="overflow-x-auto" style={{ maxHeight: "min(280px, 35vh)", overflowY: "auto" }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0">
                <tr style={{ background: "var(--card-2)", borderBottom: "1px solid var(--border)" }}>
                  <th className="px-3 py-2 text-left font-semibold w-10" style={{ color: "var(--on-dark-soft)" }}>#</th>
                  {colKeys.map((c) => (
                    <th key={c.fileCol} className="px-3 py-2 text-left font-semibold" style={{ color: "var(--on-dark-soft)" }}>
                      {fieldLabel(c.fieldKey)}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--on-dark-soft)" }}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => {
                  const hasErr = row.errors.length > 0, isDup = row.dupPhone
                  return (
                    <tr key={row.index} style={{
                      borderBottom: "1px solid var(--border)",
                      background: hasErr ? "rgba(220,38,38,0.04)" : isDup ? "rgba(217,119,6,0.04)" : undefined,
                    }}>
                      <td className="px-3 py-2" style={{ color: "var(--gray-muted)" }}>{row.index}</td>
                      {colKeys.map((c) => (
                        <td key={c.fileCol} className="px-3 py-2 max-w-[150px] truncate" style={{ color: "var(--on-dark)" }}>
                          {row.values[c.fieldKey] || <span style={{ color: "var(--gray-muted)" }}>—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {hasErr ? <span style={{ color: "#dc2626" }}>{row.errors[0]}</span>
                          : isDup ? <span style={{ color: "#d97706" }}>⚠ Дубликат</span>
                          : <span style={{ color: "#16a34a" }}>✓ Готово</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {parsed.totalRows > 20 && (
            <p className="px-4 py-2.5 text-xs" style={{ color: "var(--on-dark-soft)", borderTop: "1px solid var(--border)" }}>
              + ещё {(parsed.totalRows - 20).toLocaleString("ru-RU")} строк…
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Step 4: Progress ──────────────────────────────────────────────────────────

function Step4Progress({ progress, total }: { progress: number; total: number }) {
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 px-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
        <div className="w-7 h-7 rounded-full border-[3px] border-slate-900 border-t-transparent animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold" style={{ color: "var(--on-dark)" }}>Импортирую данные…</p>
        <p className="text-sm mt-1 tabular-nums" style={{ color: "var(--on-dark-soft)" }}>
          {progress.toLocaleString("ru-RU")} из {total.toLocaleString("ru-RU")}
        </p>
      </div>
      <div className="w-full max-w-sm">
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: "#0f172a" }} />
        </div>
        <p className="text-center text-xs mt-2 tabular-nums" style={{ color: "var(--on-dark-soft)" }}>{pct}%</p>
      </div>
    </div>
  )
}

// ── Step 5: Report ────────────────────────────────────────────────────────────

function Step5Report({ result, onClose }: {
  result: BatchImportResult & { validationErrors?: Array<{ row: number; reason: string; name: string }> }
  onClose: () => void
}) {
  const allErrors = [...(result.errors ?? []), ...(result.validationErrors ?? [])].sort((a, b) => a.row - b.row)
  const total = result.imported + result.updated + result.skipped + allErrors.length

  function downloadReport() {
    if (!allErrors.length) return
    const csv = ["Строка,Имя,Причина", ...allErrors.map((e) =>
      `${e.row},"${e.name.replace(/"/g, '""')}","${e.reason.replace(/"/g, '""')}"`
    )]
    const blob = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "import_report.csv"; a.click()
  }

  return (
    <div className="flex flex-col items-center gap-5 py-8 px-6">
      <div className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.3)" }}>
        <CheckCircle className="w-8 h-8" style={{ color: "#16a34a" }} />
      </div>
      <div className="text-center">
        <p className="text-xl font-semibold" style={{ color: "var(--on-dark)" }}>Импорт завершён</p>
        <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>Обработано: {total.toLocaleString("ru-RU")} строк</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
        {[
          { label: "Импортировано", value: result.imported, color: "#16a34a" },
          { label: "Обновлено",     value: result.updated,  color: "#2563eb" },
          { label: "Пропущено",     value: result.skipped,  color: "#64748b" },
          { label: "Ошибок",        value: allErrors.length, color: allErrors.length ? "#dc2626" : "#16a34a" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4 text-center"
            style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
            <p className="text-2xl font-semibold tabular-nums" style={{ color: s.color }}>{s.value.toLocaleString("ru-RU")}</p>
            <p className="text-xs mt-1" style={{ color: "var(--on-dark-soft)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Audit — связанные сущности */}
      {result.audit && (
        <div className="w-full rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="px-4 py-2.5" style={{ background: "var(--card-2)", borderBottom: "1px solid var(--border)" }}>
            <span className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--on-dark-soft)", letterSpacing: "0.06em" }}>Связанные записи</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 px-4 py-3 text-xs">
            {[
              { label: "Абонементов создано", value: result.audit.subscriptionsCreated + result.audit.subscriptionsUpdated },
              { label: "Тарифов найдено", value: result.audit.membershipsMatched },
              { label: "Тарифов создано", value: result.audit.membershipsCreated },
              { label: "Посещений записано", value: result.audit.visitsCreated },
              { label: "Тренеров связано", value: result.audit.trainersLinked },
              { label: "Финансы заполнены", value: result.audit.financialsSet },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-2">
                <span style={{ color: "var(--on-dark-soft)" }}>{r.label}</span>
                <span className="font-semibold tabular-nums" style={{ color: "var(--on-dark)" }}>{r.value.toLocaleString("ru-RU")}</span>
              </div>
            ))}
          </div>
          {!result.audit.financialColumns && (
            <div className="flex items-start gap-2 px-4 py-2.5" style={{ borderTop: "1px solid var(--border)", background: "rgba(217,119,6,0.06)" }}>
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#d97706" }} />
              <p className="text-[11px]" style={{ color: "#92400e" }}>
                Баланс, долг и тренер не сохранены: в базе ещё нет нужных колонок. Примените миграцию <strong>0022</strong> и повторите импорт с обновлением.
              </p>
            </div>
          )}
          {result.audit.trainersUnmatched > 0 && (
            <div className="flex items-start gap-2 px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#64748b" }} />
              <p className="text-[11px]" style={{ color: "var(--on-dark-soft)" }}>
                {result.audit.trainersUnmatched.toLocaleString("ru-RU")} тренеров не найдены среди сотрудников — имя сохранено в карточке клиента.
              </p>
            </div>
          )}
        </div>
      )}

      {allErrors.length > 0 && (
        <div className="w-full rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-4 py-2.5"
            style={{ background: "var(--card-2)", borderBottom: "1px solid var(--border)" }}>
            <span className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--on-dark-soft)", letterSpacing: "0.06em" }}>Ошибки ({allErrors.length})</span>
            <button onClick={downloadReport}
              className="flex items-center gap-1.5 text-xs font-medium hover:opacity-70 transition-opacity"
              style={{ color: "#2563eb" }}>
              <Download className="w-3 h-3" /> Скачать отчёт
            </button>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {allErrors.slice(0, 30).map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-xs"
                style={{ borderBottom: i < Math.min(allErrors.length, 30) - 1 ? "1px solid var(--border)" : "none" }}>
                <span className="font-mono w-16 flex-shrink-0" style={{ color: "var(--gray-muted)" }}>стр. {e.row}</span>
                <span className="flex-1 truncate" style={{ color: "var(--on-dark)" }}>{e.name || "—"}</span>
                <span className="flex-shrink-0" style={{ color: "#dc2626" }}>{e.reason}</span>
              </div>
            ))}
            {allErrors.length > 30 && (
              <p className="px-4 py-2 text-xs" style={{ color: "var(--on-dark-soft)" }}>
                + ещё {allErrors.length - 30} ошибок — скачайте отчёт
              </p>
            )}
          </div>
        </div>
      )}
      <button onClick={onClose}
        className="h-10 px-8 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ background: "#0f172a" }}>
        Перейти к клиентам
      </button>
    </div>
  )
}

// ── Main ImportWizard ─────────────────────────────────────────────────────────

interface WizardResult extends BatchImportResult {
  validationErrors?: Array<{ row: number; reason: string; name: string }>
}

export function ImportWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep]                     = useState(0)
  const [parsed, setParsed]                 = useState<ParsedFile | null>(null)
  const [mapping, setMapping]               = useState<MappingEntry[]>([])
  const [autoAtParseCols, setAutoAtParse]   = useState<Set<string>>(new Set())
  const [manualCols, setManualCols]         = useState<Set<string>>(new Set())
  const [autoMode, setAutoMode]             = useState(false)
  const [validated, setValidated]           = useState<ValidatedRow[]>([])
  const [dupPhones, setDupPhones]           = useState<string[]>([])
  const [dupStrategy, setDupStrategy]       = useState<DuplicateStrategy>("skip")
  const [dupLoading, setDupLoading]         = useState(false)
  const [progress, setProgress]             = useState(0)
  const [total, setTotal]                   = useState(0)
  const [result, setResult]                 = useState<WizardResult | null>(null)

  // ── mapping change: enforce uniqueness + track manual ──
  function handleMappingChange(col: string, fieldKey: FieldKey) {
    const fieldDef = CLIENT_FIELDS.find((f) => f.key === fieldKey)

    setManualCols((prev) => {
      const next = new Set(prev)
      next.add(col)
      if (fieldKey !== "__skip__" && fieldKey !== "custom" && fieldDef?.unique) {
        mapping.forEach((m) => {
          if (m.fileCol !== col && m.fieldKey === fieldKey) next.add(m.fileCol)
        })
      }
      return next
    })

    setMapping((prev) => prev.map((m) => {
      if (m.fileCol === col) return { ...m, fieldKey, customLabel: fieldKey === "custom" ? (m.customLabel ?? "") : undefined }
      // Swap only for unique fields (not full_name, not custom)
      if (fieldKey !== "__skip__" && fieldKey !== "custom" && fieldDef?.unique && m.fieldKey === fieldKey) {
        return { ...m, fieldKey: "__skip__" as FieldKey }
      }
      return m
    }))
  }

  // ── update custom label text ──
  function handleCustomLabel(col: string, label: string) {
    setMapping((prev) => prev.map((m) => m.fileCol === col ? { ...m, customLabel: label } : m))
  }

  // ── toggle auto mode ──
  function handleAutoToggle() {
    if (!parsed) return
    if (autoMode) {
      // Turn OFF: clear all to __skip__ for full manual control
      setMapping(parsed.headers.map((h) => ({ fileCol: h, fieldKey: "__skip__" as FieldKey })))
      setAutoAtParse(new Set())
      setManualCols(new Set())
      setAutoMode(false)
    } else {
      // Turn ON: re-run full auto-detection (with content analysis)
      const m = buildAutoMapping(parsed)
      setMapping(m)
      setAutoAtParse(new Set(m.filter((e) => e.fieldKey !== "__skip__" && (!e.detection || e.detection.confidence >= 90)).map((e) => e.fileCol)))
      setManualCols(new Set())
      setAutoMode(true)
    }
  }

  // ── step transitions ──
  function handleParsed(file: ParsedFile) {
    const m = buildAutoMapping(file)
    setParsed(file)
    setMapping(m)
    setAutoAtParse(new Set(m.filter((e) => e.fieldKey !== "__skip__" && (!e.detection || e.detection.confidence >= 90)).map((e) => e.fileCol)))
    setManualCols(new Set())
    setAutoMode(true)
    setStep(1)
  }

  function buildValidated(file: ParsedFile, m: MappingEntry[]): ValidatedRow[] {
    const active         = m.filter((e) => e.fieldKey !== "__skip__")
    const firstNameCols  = active.filter((e) => e.fieldKey === "first_name")
    const lastNameCols   = active.filter((e) => e.fieldKey === "last_name")
    const fullNameCols   = active.filter((e) => e.fieldKey === "full_name")
    const trainerCols    = active.filter((e) => e.fieldKey === "trainer")
    const debtCols       = active.filter((e) => e.fieldKey === "debt")
    const customCols     = active.filter((e) => e.fieldKey === "custom")
    const SPECIAL        = new Set(["first_name", "last_name", "full_name", "trainer", "debt", "custom"])
    const otherCols      = active.filter((e) => !SPECIAL.has(e.fieldKey))

    function val(entry: MappingEntry, row: string[]): string {
      const ci = file.headers.indexOf(entry.fileCol)
      return ci >= 0 ? String(row[ci] ?? "").trim() : ""
    }

    return file.rows.map((row, i) => {
      const values: Partial<Record<FieldKey, string>> = {}

      // Regular importable fields
      for (const e of otherCols) values[e.fieldKey] = val(e, row)

      // Name assembly: first_name + last_name → full_name (Фамилия Имя order)
      const firstName     = firstNameCols.map((e) => val(e, row)).filter(Boolean).join(" ")
      const lastName      = lastNameCols.map((e) => val(e, row)).filter(Boolean).join(" ")
      const fullNameDirect = fullNameCols.map((e) => val(e, row)).filter(Boolean).join(" ")
      if (firstName) values.first_name = firstName
      if (lastName)  values.last_name  = lastName
      values.full_name = fullNameDirect || [lastName, firstName].filter(Boolean).join(" ")

      // Trainer → store as dedicated field (action will append to notes if no DB column)
      const trainer = trainerCols.map((e) => val(e, row)).filter(Boolean).join(", ")
      if (trainer) values.trainer = trainer

      // Debt → store value
      const debt = debtCols.map((e) => val(e, row)).filter(Boolean).join(", ")
      if (debt) values.debt = debt

      // Custom-labeled columns → append to notes
      const customParts = customCols
        .map((e) => { const v = val(e, row); return v && e.customLabel ? `${e.customLabel}: ${v}` : "" })
        .filter(Boolean)
      if (customParts.length) {
        values.notes = [values.notes, ...customParts].filter(Boolean).join("\n")
      }

      const errors: string[] = []
      if (!values.full_name) errors.push("Нет имени")
      return { index: i + 1, values: values as Record<FieldKey, string>, errors }
    })
  }

  async function handleGoToPreview() {
    if (!parsed) return
    const vRows = buildValidated(parsed, mapping)
    setValidated(vRows)
    setDupLoading(true)
    setStep(2)

    const phones = [...new Set(vRows.map((r) => r.values.phone).filter(Boolean))]
    if (phones.length) {
      const dups = await checkPhonesAction(phones)
      setDupPhones(dups)
      const dupSet = new Set(dups)
      setValidated(vRows.map((r) => ({ ...r, dupPhone: !!(r.values.phone && dupSet.has(r.values.phone)) })))
    }
    setDupLoading(false)
  }

  async function handleImport() {
    if (!parsed) return
    setStep(3)

    const toProcess: ImportClientRow[] = validated
      .filter((r) => !r.errors.length)
      .map((r) => ({
        _rowIndex:       r.index,
        full_name:       r.values.full_name       || undefined,
        first_name:      r.values.first_name      || undefined,
        last_name:       r.values.last_name       || undefined,
        phone:           r.values.phone           || undefined,
        email:           r.values.email           || undefined,
        birth_date:      r.values.birth_date      || undefined,
        gender:          r.values.gender          || undefined,
        source:          r.values.source          || undefined,
        notes:           r.values.notes           || undefined,
        balance:         r.values.balance         || undefined,
        debt:            r.values.debt            || undefined,
        trainer:         r.values.trainer         || undefined,
        membership_name: r.values.membership_name || undefined,
        sub_status:      r.values.sub_status      || undefined,
        sub_start:       r.values.sub_start       || undefined,
        sub_end:         r.values.sub_end         || undefined,
        visits_total:    r.values.visits_total    || undefined,
        last_visit:      r.values.last_visit      || undefined,
      }))

    // Larger chunks = fewer Server Action round-trips.
    // Subscriptions are now bulk-inserted server-side so chunk size doesn't affect DB call count.
    const CHUNK = toProcess.length > 5000 ? 1000 : 500
    setTotal(toProcess.length); setProgress(0)
    let imported = 0, updated = 0, skipped = 0
    const errors: WizardResult["errors"] = []
    const dupSet = [...new Set(dupPhones)]
    const audit: ImportAudit = {
      clientsInserted: 0, clientsUpdated: 0, subscriptionsCreated: 0, subscriptionsUpdated: 0,
      membershipsMatched: 0, membershipsCreated: 0, visitsCreated: 0,
      trainersLinked: 0, trainersUnmatched: 0, financialsSet: 0, financialColumns: true,
    }

    for (let i = 0; i < toProcess.length; i += CHUNK) {
      const res = await batchImportClientsAction(toProcess.slice(i, i + CHUNK), dupStrategy, dupSet)
      imported += res.imported; updated += res.updated; skipped += res.skipped
      errors.push(...res.errors)
      // accumulate audit
      audit.subscriptionsCreated += res.audit.subscriptionsCreated
      audit.subscriptionsUpdated += res.audit.subscriptionsUpdated
      audit.membershipsMatched   += res.audit.membershipsMatched
      audit.membershipsCreated   += res.audit.membershipsCreated
      audit.visitsCreated        += res.audit.visitsCreated
      audit.trainersLinked       += res.audit.trainersLinked
      audit.trainersUnmatched    += res.audit.trainersUnmatched
      audit.financialsSet        += res.audit.financialsSet
      if (!res.audit.financialColumns) audit.financialColumns = false
      setProgress(Math.min(i + CHUNK, toProcess.length))
    }

    const validationErrors = validated
      .filter((r) => r.errors.length)
      .map((r) => ({ row: r.index, reason: r.errors.join(", "), name: r.values.full_name || "—" }))

    setResult({ imported, updated, skipped, errors, audit, validationErrors })
    setStep(4)
  }

  const canProceedMapping = mapping.some((m) => ["full_name", "first_name", "last_name"].includes(m.fieldKey))

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(2,6,23,0.4)" }}>
      {/* Backdrop */}
      <div className={`flex-1 ${step < 3 ? "cursor-pointer" : ""}`} onClick={step < 3 ? onClose : undefined} />

      {/* Drawer */}
      <div className="flex flex-col h-full"
        style={{ width: "min(860px, 95vw)", background: "var(--card)", borderLeft: "1px solid var(--border)", boxShadow: "-24px 0 64px rgba(0,0,0,0.14)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5" style={{ color: "#0f172a" }} />
            <span className="font-semibold text-[15px]" style={{ color: "var(--on-dark)" }}>Импорт клиентов</span>
            {parsed && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "var(--card-2)", color: "var(--on-dark-soft)", border: "1px solid var(--border)" }}>
                {parsed.fileName}
              </span>
            )}
          </div>
          {step < 3 && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <X className="w-4 h-4" style={{ color: "var(--on-dark-soft)" }} />
            </button>
          )}
        </div>

        <StepBar current={step} />

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 0 && <Step1Upload onParsed={handleParsed} />}
          {step === 1 && parsed && (
            <Step2Mapping
              parsed={parsed} mapping={mapping}
              autoAtParseCols={autoAtParseCols} manualCols={manualCols}
              autoMode={autoMode}
              onChange={handleMappingChange} onCustomLabel={handleCustomLabel} onAutoToggle={handleAutoToggle}
            />
          )}
          {step === 2 && parsed && (
            <Step3Preview
              parsed={parsed} mapping={mapping} validated={validated}
              dupStrategy={dupStrategy}
              onStrategyChange={setDupStrategy} loading={dupLoading}
            />
          )}
          {step === 3 && <Step4Progress progress={progress} total={total} />}
          {step === 4 && result && <Step5Report result={result} onClose={onClose} />}
        </div>

        {/* Footer */}
        {step >= 1 && step <= 2 && (
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
              style={{ color: "var(--on-dark)", border: "1px solid var(--border)" }}>
              <ArrowLeft className="w-3.5 h-3.5" /> Назад
            </button>
            <div className="flex items-center gap-3">
              {step === 1 && parsed && (
                <span className="text-xs" style={{ color: "var(--on-dark-soft)" }}>
                  {parsed.totalRows.toLocaleString("ru-RU")} строк
                </span>
              )}
              {step === 1 && (
                <button onClick={handleGoToPreview} disabled={!canProceedMapping}
                  className="flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: "#0f172a" }}>
                  Предпросмотр <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              {step === 2 && (
                <button onClick={handleImport} disabled={dupLoading}
                  className="flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: "#0f172a" }}>
                  Импортировать <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
