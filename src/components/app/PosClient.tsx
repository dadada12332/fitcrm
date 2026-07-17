"use client"

import { useState, useMemo, useRef, useEffect, useTransition } from "react"
import { toast } from "@/lib/use-action"
import {
  Search, Plus, Minus, X, ShoppingCart, Zap, Flame, ScanLine,
  Check, Loader2, Copy, ExternalLink, Send, User, Trash2, Truck as TruckIcon,
} from "lucide-react"
import { AddProductModal, SupplyModal, WriteoffModal } from "./InventoryClient"
import type { PosProduct } from "@/lib/inventory"
import type { ClientSearchResult } from "@/lib/visits"
import {
  sellProductsAction, getSaleStatusAction, searchClientsPosAction,
  type SaleProvider,
} from "@/app/(app)/warehouse/pos-actions"
import { sendPaymentLinkTelegramAction } from "@/app/(app)/payments/actions"

const fmt = (n: number) => n.toLocaleString("ru-RU")

// ── Фолбэк-иконка по категории (когда нет фото) ──
function catEmoji(cat: string | null): string {
  const c = (cat ?? "").toLowerCase()
  if (/протеин|whey|гейнер|bcaa|амин/.test(c)) return "🥤"
  if (/предтрен|pre|энерг/.test(c)) return "⚡"
  if (/витамин|омега|минерал/.test(c)) return "💊"
  if (/батон|bar|снек/.test(c)) return "🍫"
  if (/напит|вода|drink|сок|изотон/.test(c)) return "💧"
  if (/мерч|футбол|одежд|shirt|худи/.test(c)) return "👕"
  if (/аксессуар|шейкер|перчат|пояс|бутыл/.test(c)) return "🎒"
  return "📦"
}
// Стабильный оттенок по названию (0..359) — подставляется в CSS-переменную --tile-h,
// фон плитки берётся из globals.css и адаптируется под светлую/тёмную тему.
function hueOf(seed: string): number {
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return h
}

type StockStatus = "in" | "low" | "out"
function stockStatus(p: PosProduct): StockStatus {
  if (p.quantity <= 0) return "out"
  if (p.quantity <= 5) return "low"
  return "in"
}
const STATUS_META: Record<StockStatus, { color: string; label: (q: number, u: string) => string }> = {
  in:  { color: "#16a34a", label: (q, u) => `Осталось ${q} ${u}` },
  low: { color: "#d97706", label: (q, u) => `Заканчивается · ${q} ${u}` },
  out: { color: "#dc2626", label: () => "Нет в наличии" },
}

type CartLine = { product: PosProduct; qty: number }

export function PosClient({ products, connectedProviders, canSell, versionControl }: {
  products: PosProduct[]
  connectedProviders: string[]
  canSell: boolean
  versionControl?: React.ReactNode
}) {
  const [query, setQuery] = useState("")
  const [cat, setCat] = useState("all")
  const [cart, setCart] = useState<CartLine[]>([])
  const [drawer, setDrawer] = useState<PosProduct | null>(null)
  const [checkout, setCheckout] = useState<CartLine[] | null>(null) // корзина, ушедшая в оплату
  // Действия склада (те же, что во вкладке «Таблица»)
  const [addOpen, setAddOpen] = useState(false)
  const [supplyOpen, setSupplyOpen] = useState(false)
  const [writeoffOpen, setWriteoffOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const categories = useMemo(() => {
    const s = new Set(products.map((p) => p.category ?? "Без категории"))
    return ["all", ...Array.from(s).sort()]
  }, [products])

  const hitThreshold = useMemo(() => {
    const counts = products.map((p) => p.salesCount).filter((c) => c > 0).sort((a, b) => b - a)
    return counts.length >= 4 ? counts[Math.floor(counts.length * 0.2)] : Infinity
  }, [products])

  // Сортировка: часто продаваемые первыми (потом по алфавиту) — без отдельного блока «часто».
  const filtered = useMemo(() => products.filter((p) => {
    const q = query.trim().toLowerCase()
    const matchQ = !q || p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false)
      || (p.barcode?.toLowerCase().includes(q) ?? false) || (p.category?.toLowerCase().includes(q) ?? false)
    const matchCat = cat === "all" || (p.category ?? "Без категории") === cat
    return matchQ && matchCat
  }).sort((a, b) => (b.salesCount - a.salesCount) || a.name.localeCompare(b.name, "ru")), [products, query, cat])

  function addToCart(p: PosProduct, qty = 1) {
    if (p.quantity <= 0) return
    setCart((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id)
      if (i >= 0) {
        const next = [...prev]
        next[i] = { ...next[i], qty: Math.min(p.quantity, next[i].qty + qty) }
        return next
      }
      return [...prev, { product: p, qty: Math.min(p.quantity, qty) }]
    })
  }
  function setLineQty(id: string, qty: number) {
    setCart((prev) => prev.flatMap((l) => l.product.id === id ? (qty <= 0 ? [] : [{ ...l, qty: Math.min(l.product.quantity, qty) }]) : [l]))
  }
  const cartTotal = cart.reduce((s, l) => s + l.qty * l.product.sellPrice, 0)
  const cartCount = cart.reduce((s, l) => s + l.qty, 0)

  // Скан штрихкода: Enter в поиске — если ровно один товар по коду, кидаем в корзину.
  function onSearchKey(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return
    const q = query.trim().toLowerCase()
    if (!q) return
    const exact = products.filter((p) => p.barcode?.toLowerCase() === q || p.sku?.toLowerCase() === q)
    const pick = exact.length === 1 ? exact[0] : (filtered.length === 1 ? filtered[0] : null)
    if (pick && pick.quantity > 0) { addToCart(pick); setQuery(""); }
  }

  // «Продать сразу» одним товаром — минуя корзину.
  function quickSell(p: PosProduct) {
    if (p.quantity <= 0) return
    setDrawer(null)
    setCheckout([{ product: p, qty: 1 }])
  }

  function onSaleDone() {
    setCheckout(null); setCart([]); setDrawer(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>Склад</h1>
          <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>Витрина — быстрые продажи на ресепшене</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {versionControl}
          <button onClick={() => setWriteoffOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
            <Minus size={15} /> Списать
          </button>
          <button onClick={() => setSupplyOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.25)", color: "#16a34a" }}>
            <TruckIcon size={15} /> Добавить поставку
          </button>
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "#2563eb" }}>
            <Plus size={15} /> Добавить товар
          </button>
          {cartCount > 0 && (
            <>
              <button onClick={() => setCart([])} title="Очистить корзину"
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
                <Trash2 className="w-4 h-4" /> Очистить
              </button>
              <button onClick={() => setCheckout(cart)} disabled={!canSell}
                className="relative flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "#2563eb" }}>
                <ShoppingCart className="w-4 h-4" /> {fmt(cartTotal)} сум
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full text-[11px] font-bold flex items-center justify-center" style={{ background: "#16a34a", color: "white" }}>{cartCount}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search + scan */}
      <div className="relative mb-3">
        <ScanLine className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--on-dark-soft)" }} />
        <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKey} autoFocus
          placeholder="Поиск или скан штрихкода — название, SKU, код…"
          className="w-full h-11 pl-9 pr-9 rounded-lg text-sm outline-none"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }} />
        {query && <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4" style={{ color: "var(--gray-muted)" }} /></button>}
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
        {categories.map((c) => {
          const active = cat === c
          return (
            <button key={c} onClick={() => setCat(c)}
              className="px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap transition-all shrink-0"
              style={{ background: active ? "#2563eb" : "var(--card)", color: active ? "white" : "var(--on-dark-soft)", border: `1px solid ${active ? "#2563eb" : "var(--border)"}` }}>
              {c === "all" ? "Все товары" : c}
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl py-16 text-center min-h-[300px] flex flex-col justify-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>Ничего не найдено</p>
          <p className="text-sm mt-1" style={{ color: "var(--gray-muted)" }}>Измените запрос или категорию.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-6">
          {filtered.map((p) => (
            <ProductCard key={p.id} p={p} canSell={canSell} isHit={p.salesCount >= hitThreshold && p.salesCount > 0}
              onOpen={() => setDrawer(p)} onAdd={() => addToCart(p)} />
          ))}
        </div>
      )}

      {drawer && <ProductDrawer p={drawer} canSell={canSell} onClose={() => setDrawer(null)}
        onAdd={(qty) => { addToCart(drawer, qty); setDrawer(null) }} onQuickSell={() => quickSell(drawer)} />}

      {checkout && <CheckoutSheet lines={checkout} connectedProviders={connectedProviders}
        onClose={() => setCheckout(null)} onDone={onSaleDone} />}

      {/* Действия склада (те же дроверы, что во вкладке «Таблица») */}
      <AddProductModal open={addOpen} onClose={() => setAddOpen(false)} />
      <SupplyModal open={supplyOpen} onClose={() => setSupplyOpen(false)} products={products} />
      <WriteoffModal open={writeoffOpen} onClose={() => setWriteoffOpen(false)} products={products} />
    </div>
  )
}

// ── Product card ──
function ProductCard({ p, canSell, isHit, onOpen, onAdd }: {
  p: PosProduct; canSell: boolean; isHit: boolean; onOpen: () => void; onAdd: () => void
}) {
  const st = stockStatus(p)
  const meta = STATUS_META[st]
  const out = st === "out"
  return (
    <div onClick={onOpen}
      className="group relative rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md flex flex-col"
      style={{ background: "var(--card)", border: `1px solid ${st === "low" ? "rgba(217,119,6,0.35)" : out ? "var(--border)" : "var(--border)"}`, opacity: out ? 0.55 : 1 }}>
      {/* Photo / fallback */}
      <div className="pos-tile relative aspect-square w-full flex items-center justify-center" style={{ ["--tile-h" as string]: String(hueOf(p.name)) } as React.CSSProperties}>
        {p.photoUrl
          ? <img src={p.photoUrl} alt={p.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          : <span className="text-4xl select-none">{catEmoji(p.category)}</span>}
        {isHit && (
          <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(220,38,38,0.92)", color: "white" }}>
            <Flame className="w-3 h-3" /> Хит
          </span>
        )}
        {/* Quick add */}
        {!out && canSell && (
          <button onClick={(e) => { e.stopPropagation(); onAdd() }} title="В корзину"
            className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-transform active:scale-90"
            style={{ background: "#2563eb", color: "white" }}>
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
      {/* Info */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold leading-tight line-clamp-2" style={{ color: "var(--on-dark)" }}>{p.name}</p>
        <p className="text-base font-semibold" style={{ color: "var(--on-dark)" }}>{fmt(p.sellPrice)} <span className="text-xs font-normal" style={{ color: "var(--gray-muted)" }}>сум</span></p>
        <div className="flex items-center gap-1.5 mt-auto pt-1">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
          <span className="text-[11px]" style={{ color: meta.color }}>{meta.label(p.quantity, p.unit)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Product drawer ──
function ProductDrawer({ p, canSell, onClose, onAdd, onQuickSell }: {
  p: PosProduct; canSell: boolean; onClose: () => void; onAdd: (qty: number) => void; onQuickSell: () => void
}) {
  const [qty, setQty] = useState(1)
  const st = stockStatus(p)
  const meta = STATUS_META[st]
  const out = st === "out"
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose} style={{ background: "rgba(2,6,23,0.4)" }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md h-full overflow-y-auto flex flex-col" style={{ background: "var(--card)", borderLeft: "1px solid var(--border)", boxShadow: "-8px 0 40px rgba(0,0,0,0.1)" }}>
        <div className="pos-tile relative aspect-video w-full flex items-center justify-center shrink-0" style={{ ["--tile-h" as string]: String(hueOf(p.name)) } as React.CSSProperties}>
          {p.photoUrl ? <img src={p.photoUrl} alt={p.name} className="absolute inset-0 w-full h-full object-cover" /> : <span className="text-6xl">{catEmoji(p.category)}</span>}
          <button onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4 flex-1">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {p.category && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>{catEmoji(p.category)} {p.category}</span>}
              <span className="flex items-center gap-1 text-xs" style={{ color: meta.color }}><span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />{meta.label(p.quantity, p.unit)}</span>
            </div>
            <h2 className="text-xl font-semibold" style={{ color: "var(--on-dark)" }}>{p.name}</h2>
            {p.description && <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>{p.description}</p>}
          </div>
          <div className="text-2xl font-semibold" style={{ color: "var(--on-dark)" }}>{fmt(p.sellPrice)} <span className="text-base font-normal" style={{ color: "var(--gray-muted)" }}>сум</span></div>

          <div className="flex gap-4 text-sm" style={{ color: "var(--on-dark-soft)" }}>
            <span>Продаж: <b style={{ color: "var(--on-dark)" }}>{p.salesCount}</b></span>
            {p.lastSoldAt && <span>Последняя: {new Date(p.lastSoldAt).toLocaleDateString("ru-RU")}</span>}
            {p.sku && <span>SKU: {p.sku}</span>}
          </div>

          {canSell && !out && (
            <>
              <div className="flex items-center gap-3">
                <span className="text-sm" style={{ color: "var(--on-dark-soft)" }}>Количество</span>
                <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center" style={{ color: "var(--on-dark)" }}><Minus className="w-4 h-4" /></button>
                  <span className="w-12 text-center text-sm font-semibold" style={{ color: "var(--on-dark)" }}>{qty}</span>
                  <button onClick={() => setQty((q) => Math.min(p.quantity, q + 1))} className="w-10 h-10 flex items-center justify-center" style={{ color: "var(--on-dark)" }}><Plus className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex gap-2 mt-auto">
                <button onClick={() => onAdd(qty)} className="flex-1 h-12 rounded-lg text-sm font-medium flex items-center justify-center gap-2" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}>
                  <ShoppingCart className="w-4 h-4" /> В корзину
                </button>
                <button onClick={onQuickSell} className="flex-1 h-12 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2" style={{ background: "#16a34a" }}>
                  <Zap className="w-4 h-4" /> Продать сразу
                </button>
              </div>
            </>
          )}
          {out && <div className="mt-auto text-center text-sm py-3 rounded-lg" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}>Нет в наличии — продажа недоступна</div>}
        </div>
      </div>
    </div>
  )
}

// ── Checkout sheet (client + метод оплаты + онлайн QR) ──
const METHODS: { key: SaleProvider; label: string }[] = [
  { key: "cash", label: "Наличные" },
  { key: "card", label: "Карта" },
  { key: "transfer", label: "Перевод" },
  { key: "payme", label: "Payme" },
  { key: "click", label: "Click" },
  { key: "other", label: "Другое" },
]

function CheckoutSheet({ lines, connectedProviders, onClose, onDone }: {
  lines: CartLine[]; connectedProviders: string[]; onClose: () => void; onDone: () => void
}) {
  const [pending, start] = useTransition()
  const [method, setMethod] = useState<SaleProvider>("cash")
  const [online, setOnline] = useState(false)
  const [client, setClient] = useState<ClientSearchResult | null>(null)
  const [clientQuery, setClientQuery] = useState("")
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<{ url: string; qr?: string; paymentId: string; hasTelegram: boolean } | null>(null)
  const [paid, setPaid] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const total = lines.reduce((s, l) => s + l.qty * l.product.sellPrice, 0)
  const canOnline = (method === "click" || method === "payme") && connectedProviders.includes(method)

  useEffect(() => { if (method !== "click" && method !== "payme") setOnline(false) }, [method])

  // Поллинг статуса онлайн-оплаты.
  useEffect(() => {
    if (!link || paid) return
    const id = setInterval(async () => {
      const { status } = await getSaleStatusAction(link.paymentId)
      if (status === "paid") { setPaid(true); clearInterval(id) }
    }, 3000)
    return () => clearInterval(id)
  }, [link, paid])

  function searchClient(v: string) {
    setClientQuery(v)
    if (timer.current) clearTimeout(timer.current)
    if (v.trim().length < 2) { setClientResults([]); return }
    timer.current = setTimeout(async () => setClientResults(await searchClientsPosAction(v.trim())), 250)
  }

  function submit() {
    setError(null)
    start(async () => {
      const res = await sellProductsAction({
        items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
        clientId: client?.id ?? null, provider: method, online: online && canOnline,
      })
      if (res.error) { setError(res.error); toast.error(res.error); return }
      if (res.online && res.url) { setLink({ url: res.url, qr: res.qr, paymentId: res.paymentId!, hasTelegram: !!res.hasTelegram }); toast.success("Ссылка на оплату создана"); return }
      toast.success("Продажа оформлена")
      onDone()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose} style={{ background: "rgba(2,6,23,0.4)" }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md h-full overflow-y-auto flex flex-col" style={{ background: "var(--card)", borderLeft: "1px solid var(--border)", boxShadow: "-8px 0 40px rgba(0,0,0,0.1)" }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="font-semibold" style={{ color: "var(--on-dark)" }}>Оплата · {fmt(total)} сум</span>
          <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--on-dark-soft)" }} /></button>
        </div>

        {/* Success */}
        {link && paid ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(22,163,74,0.12)" }}><Check className="w-8 h-8" style={{ color: "#16a34a" }} /></div>
            <p className="text-lg font-semibold" style={{ color: "var(--on-dark)" }}>Оплата получена!</p>
            <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>Продажа проведена, остаток списан.</p>
            <button onClick={onDone} className="mt-2 h-11 px-6 rounded-lg text-sm font-medium text-white" style={{ background: "#2563eb" }}>Готово</button>
          </div>
        ) : link ? (
          /* QR / ссылка */
          <div className="flex-1 flex flex-col items-center gap-4 p-6 text-center">
            {link.qr && <img src={link.qr} alt="QR" width={220} height={220} className="rounded-lg" style={{ background: "white" }} />}
            <p className="text-sm" style={{ color: "var(--on-dark-soft)" }}>Клиент сканирует QR или открывает ссылку. Статус обновится автоматически.</p>
            <div className="flex gap-2 w-full">
              <button onClick={() => { navigator.clipboard.writeText(link.url); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                className="flex-1 h-11 rounded-lg text-sm font-medium flex items-center justify-center gap-2" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Скопировано" : "Копировать"}
              </button>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 h-11 rounded-lg text-sm font-medium flex items-center justify-center gap-2" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }}>
                <ExternalLink className="w-4 h-4" /> Открыть
              </a>
            </div>
            {link.hasTelegram && client && (
              <button onClick={() => start(async () => { await sendPaymentLinkTelegramAction(client.id, link.url) })} disabled={pending}
                className="w-full h-11 rounded-lg text-sm font-medium flex items-center justify-center gap-2" style={{ background: "rgba(37,99,235,0.1)", color: "#2563eb" }}>
                <Send className="w-4 h-4" /> Отправить в Telegram
              </button>
            )}
            <div className="flex items-center gap-2 text-sm mt-2" style={{ color: "var(--gray-muted)" }}><Loader2 className="w-4 h-4 animate-spin" /> Ожидаем оплату…</div>
          </div>
        ) : (
          <>
            <div className="flex-1 p-5 space-y-5">
              {/* Позиции */}
              <div className="space-y-2">
                {lines.map((l) => (
                  <div key={l.product.id} className="flex items-center justify-between text-sm">
                    <span style={{ color: "var(--on-dark)" }}>{l.product.name} <span style={{ color: "var(--gray-muted)" }}>×{l.qty}</span></span>
                    <span className="font-medium" style={{ color: "var(--on-dark)" }}>{fmt(l.qty * l.product.sellPrice)}</span>
                  </div>
                ))}
              </div>

              {/* Клиент (опционально) */}
              <div>
                <p className="text-xs mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Клиент (необязательно)</p>
                {client ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <span className="flex items-center gap-2 text-sm" style={{ color: "var(--on-dark)" }}><User className="w-4 h-4" style={{ color: "#2563eb" }} /> {client.name}</span>
                    <button onClick={() => setClient(null)}><X className="w-4 h-4" style={{ color: "var(--gray-muted)" }} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--gray-muted)" }} />
                    <input value={clientQuery} onChange={(e) => searchClient(e.target.value)} placeholder="Привязать к клиенту…"
                      className="w-full h-10 pl-9 pr-3 rounded-lg text-sm outline-none" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }} />
                    {clientResults.length > 0 && (
                      <div className="mt-1 rounded-lg overflow-hidden max-h-44 overflow-y-auto" style={{ border: "1px solid var(--border)" }}>
                        {clientResults.map((c) => (
                          <button key={c.id} onClick={() => { setClient(c); setClientResults([]); setClientQuery("") }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800" style={{ color: "var(--on-dark)" }}>
                            {c.name} {c.phone && <span style={{ color: "var(--gray-muted)" }}>· {c.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Метод оплаты */}
              <div>
                <p className="text-xs mb-1.5" style={{ color: "var(--on-dark-soft)" }}>Способ оплаты</p>
                <div className="grid grid-cols-3 gap-2">
                  {METHODS.map((m) => {
                    const active = method === m.key
                    // Онлайн-провайдеры (Click/Payme) доступны только если подключены.
                    const isOnline = m.key === "click" || m.key === "payme"
                    const disabled = isOnline && !connectedProviders.includes(m.key)
                    return (
                      <button key={m.key} onClick={() => !disabled && setMethod(m.key)} disabled={disabled}
                        title={disabled ? "не подключён" : undefined}
                        className="h-11 rounded-lg text-sm font-medium transition-all disabled:opacity-45 disabled:cursor-not-allowed"
                        style={{ background: active ? "rgba(37,99,235,0.1)" : "var(--card)", border: `1px solid ${active ? "#2563eb" : "var(--border)"}`, color: active ? "#2563eb" : "var(--on-dark-soft)" }}>
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Онлайн QR toggle */}
              {canOnline && (
                <button onClick={() => setOnline((v) => !v)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <span className="flex items-center gap-2 text-sm" style={{ color: "var(--on-dark)" }}><ScanLine className="w-4 h-4" /> Онлайн-оплата (QR клиенту)</span>
                  <span className="w-10 h-6 rounded-full p-0.5 transition-all" style={{ background: online ? "#16a34a" : "var(--border)" }}>
                    <span className="block w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: online ? "translateX(16px)" : "none" }} />
                  </span>
                </button>
              )}
              {(method === "click" || method === "payme") && !connectedProviders.includes(method) && (
                <p className="text-xs" style={{ color: "#d97706" }}>{method === "click" ? "Click" : "Payme"} не подключён — оплата запишется как офлайн.</p>
              )}
              {error && <p className="text-sm" style={{ color: "#dc2626" }}>{error}</p>}
            </div>

            <div className="p-5 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={submit} disabled={pending}
                className="w-full h-12 rounded-lg text-base font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "#16a34a" }}>
                {pending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                {online && canOnline ? "Сформировать QR" : `Оплатить ${fmt(total)} сум`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
