"use client"

import { useState, useMemo, useTransition } from "react"
import { Plus, Search, Package, AlertTriangle, TrendingUp, DollarSign, X, ChevronDown } from "lucide-react"
import type { Product, StockMovement, InventoryStats } from "@/lib/inventory"
import { addProductAction, addSupplyAction, writeoffAction } from "@/app/(app)/warehouse/actions"

function fmtSum(n: number) { return n.toLocaleString("ru-RU") }
function fmtQty(n: number, unit: string) { return `${n % 1 === 0 ? n : n.toFixed(2)} ${unit}` }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("ru-RU") }

const MOVE_LABELS: Record<string, string> = {
  supply: "Поставка", sale: "Продажа", writeoff: "Списание", adjustment: "Корректировка",
}
const MOVE_COLORS: Record<string, string> = {
  supply: "#16a34a", sale: "#2563eb", writeoff: "#dc2626", adjustment: "#d97706",
}

// ── Modal wrapper ──────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="font-semibold text-sm" style={{ color: "var(--on-dark)" }}>{title}</span>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X size={15} style={{ color: "var(--on-dark-soft)" }} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

const inputCls = "w-full px-3 py-2 rounded-xl text-sm outline-none"
const inputStyle = { background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" } as React.CSSProperties

// ── Add Product Modal ──────────────────────────────────────────────────
function AddProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState("")

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const res = await addProductAction(fd)
      if (res?.error) { setError(res.error); return }
      onClose()
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Добавить товар">
      <form onSubmit={submit} className="space-y-3">
        {error && <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>{error}</div>}
        <div className="space-y-1">
          <label className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Название *</label>
          <input name="name" required autoFocus placeholder="Протеин Whey" className={inputCls} style={inputStyle} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Категория</label>
            <input name="category" placeholder="Спортпит" className={inputCls} style={inputStyle} />
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Единица</label>
            <input name="unit" defaultValue="шт" placeholder="шт / кг / л" className={inputCls} style={inputStyle} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Цена продажи (сум)</label>
            <input name="sell_price" type="number" min="0" defaultValue="0" className={inputCls} style={inputStyle} />
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Закупочная цена (сум)</label>
            <input name="buy_price" type="number" min="0" defaultValue="0" className={inputCls} style={inputStyle} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Начальный остаток</label>
            <input name="initial_quantity" type="number" min="0" defaultValue="0" className={inputCls} style={inputStyle} />
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Мин. остаток (уведомление)</label>
            <input name="min_quantity" type="number" min="0" defaultValue="0" className={inputCls} style={inputStyle} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Артикул (SKU)</label>
          <input name="sku" placeholder="SKU-001" className={inputCls} style={inputStyle} />
        </div>
        <button type="submit" disabled={pending}
          className="w-full py-2.5 rounded-xl text-sm font-medium mt-2 disabled:opacity-50"
          style={{ background: "#2563eb", color: "white" }}>
          {pending ? "Сохранение..." : "Добавить товар"}
        </button>
      </form>
    </Modal>
  )
}

// ── Supply Modal ───────────────────────────────────────────────────────
function SupplyModal({ open, onClose, products }: {
  open: boolean; onClose: () => void; products: Product[]
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState("")

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const res = await addSupplyAction(fd)
      if (res?.error) { setError(res.error); return }
      onClose()
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Добавить поставку">
      <form onSubmit={submit} className="space-y-3">
        {error && <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>{error}</div>}
        <div className="space-y-1">
          <label className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Товар *</label>
          <select name="product_id" required className={inputCls} style={inputStyle}>
            <option value="">Выберите товар...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Количество *</label>
            <input name="qty" type="number" min="0.01" step="0.01" required placeholder="0" className={inputCls} style={inputStyle} />
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Цена за ед. (сум)</label>
            <input name="unit_price" type="number" min="0" defaultValue="0" className={inputCls} style={inputStyle} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Примечание</label>
          <input name="note" placeholder="Поставщик / накладная..." className={inputCls} style={inputStyle} />
        </div>
        <button type="submit" disabled={pending}
          className="w-full py-2.5 rounded-xl text-sm font-medium mt-2 disabled:opacity-50"
          style={{ background: "#16a34a", color: "white" }}>
          {pending ? "Сохранение..." : "Принять поставку"}
        </button>
      </form>
    </Modal>
  )
}

// ── Writeoff Modal ─────────────────────────────────────────────────────
function WriteoffModal({ open, onClose, products }: {
  open: boolean; onClose: () => void; products: Product[]
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState("")

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const res = await writeoffAction(fd)
      if (res?.error) { setError(res.error); return }
      onClose()
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Списание товара">
      <form onSubmit={submit} className="space-y-3">
        {error && <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>{error}</div>}
        <div className="space-y-1">
          <label className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Товар *</label>
          <select name="product_id" required className={inputCls} style={inputStyle}>
            <option value="">Выберите товар...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} (остаток: {fmtQty(p.quantity, p.unit)})</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Количество *</label>
          <input name="qty" type="number" min="0.01" step="0.01" required placeholder="0" className={inputCls} style={inputStyle} />
        </div>
        <div className="space-y-1">
          <label className="text-xs" style={{ color: "var(--on-dark-soft)" }}>Причина</label>
          <input name="note" placeholder="Истёк срок / бой / утеря..." className={inputCls} style={inputStyle} />
        </div>
        <button type="submit" disabled={pending}
          className="w-full py-2.5 rounded-xl text-sm font-medium mt-2 disabled:opacity-50"
          style={{ background: "#dc2626", color: "white" }}>
          {pending ? "Сохранение..." : "Списать"}
        </button>
      </form>
    </Modal>
  )
}

// ── Main Component ─────────────────────────────────────────────────────

type Props = {
  products: Product[]
  movements: StockMovement[]
  stats: InventoryStats
}

export function InventoryClient({ products, movements, stats }: Props) {
  const [query, setQuery] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [supplyOpen, setSupplyOpen] = useState(false)
  const [writeoffOpen, setWriteoffOpen] = useState(false)
  const [tab, setTab] = useState<"products" | "movements">("products")
  const [categoryFilter, setCategoryFilter] = useState("all")

  const categories = useMemo(() => {
    const s = new Set(products.map(p => p.category ?? "Без категории"))
    return ["all", ...Array.from(s).sort()]
  }, [products])

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchQ = !query || p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.sku?.toLowerCase().includes(query.toLowerCase()) ?? false)
      const matchCat = categoryFilter === "all" || (p.category ?? "Без категории") === categoryFilter
      return matchQ && matchCat
    })
  }, [products, query, categoryFilter])

  const lowStock = products.filter(p => p.minQuantity > 0 && p.quantity <= p.minQuantity)

  return (
    <>
      <AddProductModal open={addOpen} onClose={() => setAddOpen(false)} />
      <SupplyModal open={supplyOpen} onClose={() => setSupplyOpen(false)} products={products} />
      <WriteoffModal open={writeoffOpen} onClose={() => setWriteoffOpen(false)} products={products} />

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--on-dark)" }}>Склад</h1>
          <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>Товары, поставки и инвентаризация</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setWriteoffOpen(true)}
            className="px-3 py-2 rounded-xl text-sm transition-colors"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
            Списание
          </button>
          <button onClick={() => setSupplyOpen(true)}
            className="px-3 py-2 rounded-xl text-sm transition-colors"
            style={{ background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.25)", color: "#16a34a" }}>
            + Поставка
          </button>
          <button onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium"
            style={{ background: "#2563eb", color: "white" }}>
            <Plus size={14} /> Товар
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Товаров", value: String(stats.totalProducts), icon: Package, color: "#2563eb" },
          { label: "Мало на складе", value: String(stats.lowStockCount), icon: AlertTriangle, color: stats.lowStockCount > 0 ? "#dc2626" : "#16a34a" },
          { label: "Стоимость склада", value: fmtSum(stats.totalValue) + " сум", icon: DollarSign, color: "#7c3aed" },
          { label: "Продаж за месяц", value: fmtSum(stats.totalSalesMonth) + " сум", icon: TrendingUp, color: "#d97706" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl px-4 py-4 flex items-center gap-3"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: color + "18" }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <div className="text-lg font-bold leading-tight" style={{ color: "var(--on-dark)" }}>{value}</div>
              <div className="text-xs" style={{ color: "var(--on-dark-soft)" }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="mb-4 flex items-center gap-3 p-3 rounded-xl"
          style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)" }}>
          <AlertTriangle size={15} style={{ color: "#dc2626" }} />
          <span className="text-sm" style={{ color: "#dc2626" }}>
            Мало на складе: {lowStock.map(p => p.name).join(", ")}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(["products", "movements"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-3 py-1.5 rounded-lg text-sm transition-all"
            style={{
              background: tab === t ? "#2563eb" : "var(--card)",
              color: tab === t ? "white" : "var(--on-dark-soft)",
              border: `1px solid ${tab === t ? "#2563eb" : "var(--border)"}`,
            }}>
            {t === "products" ? `Товары (${products.length})` : "История движений"}
          </button>
        ))}
      </div>

      {tab === "products" && (
        <>
          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--on-dark-soft)" }} />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Поиск по названию или артикулу..."
                className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }} />
            </div>
            {categories.length > 2 && (
              <div className="relative">
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                  className="pl-3 pr-8 py-2 rounded-xl text-sm outline-none appearance-none"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}>
                  <option value="all">Все категории</option>
                  {categories.filter(c => c !== "all").map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--on-dark-soft)" }} />
              </div>
            )}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16" style={{ color: "var(--on-dark-soft)" }}>
              <Package size={28} />
              <p className="text-sm">{query ? "Товары не найдены" : "Добавьте первый товар"}</p>
              {!query && (
                <button onClick={() => setAddOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm"
                  style={{ background: "#2563eb", color: "white" }}>
                  <Plus size={14} /> Добавить товар
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {/* Header */}
              <div className="grid grid-cols-12 px-4 py-2.5 text-xs font-medium"
                style={{ background: "var(--card-2)", color: "var(--on-dark-soft)", borderBottom: "1px solid var(--border)" }}>
                <span className="col-span-4">Название</span>
                <span className="col-span-2">Категория</span>
                <span className="col-span-2 text-right">Остаток</span>
                <span className="col-span-2 text-right">Цена продажи</span>
                <span className="col-span-2 text-right">Сумма</span>
              </div>

              {filtered.map((p, i) => {
                const isLow = p.minQuantity > 0 && p.quantity <= p.minQuantity
                return (
                  <div key={p.id}
                    className="grid grid-cols-12 items-center px-4 py-3 transition-colors hover:bg-white/5"
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : undefined }}>
                    <div className="col-span-4">
                      <div className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{p.name}</div>
                      {p.sku && <div className="text-xs" style={{ color: "var(--on-dark-soft)" }}>SKU: {p.sku}</div>}
                    </div>
                    <div className="col-span-2 text-sm" style={{ color: "var(--on-dark-soft)" }}>
                      {p.category ?? "—"}
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-medium px-2 py-0.5 rounded-lg"
                        style={{
                          background: isLow ? "rgba(220,38,38,0.1)" : "rgba(22,163,74,0.1)",
                          color: isLow ? "#dc2626" : "#16a34a",
                        }}>
                        {fmtQty(p.quantity, p.unit)}
                      </span>
                      {p.minQuantity > 0 && (
                        <div className="text-[10px] mt-0.5" style={{ color: "var(--on-dark-soft)" }}>
                          мин: {p.minQuantity}
                        </div>
                      )}
                    </div>
                    <div className="col-span-2 text-right text-sm" style={{ color: "var(--on-dark)" }}>
                      {fmtSum(p.sellPrice)} сум
                    </div>
                    <div className="col-span-2 text-right text-sm font-medium" style={{ color: "var(--on-dark)" }}>
                      {fmtSum(p.quantity * p.buyPrice)} сум
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === "movements" && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {movements.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12" style={{ color: "var(--on-dark-soft)" }}>
              <Package size={24} />
              <p className="text-sm">История движений пуста</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-12 px-4 py-2.5 text-xs font-medium"
                style={{ background: "var(--card-2)", color: "var(--on-dark-soft)", borderBottom: "1px solid var(--border)" }}>
                <span className="col-span-3">Дата</span>
                <span className="col-span-3">Тип</span>
                <span className="col-span-3">Товар</span>
                <span className="col-span-1 text-right">Кол-во</span>
                <span className="col-span-2 text-right">Сумма</span>
              </div>
              {movements.map((m, i) => (
                <div key={m.id}
                  className="grid grid-cols-12 items-center px-4 py-2.5 transition-colors hover:bg-white/5"
                  style={{ borderBottom: i < movements.length - 1 ? "1px solid var(--border)" : undefined }}>
                  <div className="col-span-3 text-xs" style={{ color: "var(--on-dark-soft)" }}>{fmtDate(m.createdAt)}</div>
                  <div className="col-span-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: (MOVE_COLORS[m.type] ?? "var(--on-dark-soft)") + "18", color: MOVE_COLORS[m.type] ?? "var(--on-dark-soft)" }}>
                      {MOVE_LABELS[m.type] ?? m.type}
                    </span>
                  </div>
                  <div className="col-span-3 text-sm" style={{ color: "var(--on-dark)" }}>{m.productName}</div>
                  <div className="col-span-1 text-right text-sm font-medium"
                    style={{ color: m.type === "supply" ? "#16a34a" : "#dc2626" }}>
                    {m.type === "supply" ? "+" : "-"}{m.qty}
                  </div>
                  <div className="col-span-2 text-right text-sm" style={{ color: "var(--on-dark-soft)" }}>
                    {m.unitPrice > 0 ? fmtSum(m.qty * m.unitPrice) + " сум" : "—"}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </>
  )
}
