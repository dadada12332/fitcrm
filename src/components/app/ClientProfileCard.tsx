"use client"

import { useState, useTransition } from "react"
import { toast } from "@/lib/use-action"
import { useRouter } from "next/navigation"
import { Banknote, ChevronDown, FileSpreadsheet, MoreHorizontal, Snowflake, Trash2, X } from "lucide-react"
import type { ClientProfile } from "@/lib/client-profile"
import type { ClientStatus } from "@/lib/clients"
import { deleteClientAction, toggleFreezeAction } from "@/app/(app)/clients/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NewPaymentModal } from "./NewPaymentModal"
import { RenewSubscriptionButton } from "./RenewSubscriptionButton"

type Membership = { id: string; name: string; price: number }

const statusMeta: Record<ClientStatus, { label: string; className: string }> = {
  active: { label: "Активный", className: "bg-chart-2/10 text-chart-2" },
  expired: { label: "Истёк", className: "bg-destructive/10 text-destructive" },
  frozen: { label: "Заморожен", className: "bg-brand/10 text-brand" },
  none: { label: "Без абонемента", className: "bg-muted text-muted-foreground" },
}

const genderLabel: Record<string, string> = { male: "Мужской", female: "Женский" }

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function fmtMoney(v: number) {
  return `${Math.round(v).toLocaleString("ru-RU")} сум`
}

function Field({ label, value, link }: { label: string; value: string | null; link?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/50 p-3">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      {link && value ? (
        <a href={link} className="block truncate text-sm font-medium text-brand hover:underline">{value}</a>
      ) : (
        <p className="truncate text-sm font-medium text-foreground">{value ?? "—"}</p>
      )}
    </div>
  )
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmDanger,
  onConfirm,
  onCancel,
  loading,
  error,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  confirmDanger?: boolean
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
  error?: string | null
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        className="relative w-full max-w-sm rounded-lg p-6 flex flex-col gap-4"
        style={{ background: "var(--card)", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-100 transition-colors"
          style={{ color: "var(--gray-muted)" }}
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <h3 className="text-base font-semibold mb-1" style={{ color: "var(--on-dark)" }}>{title}</h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--on-dark-soft)" }}>{description}</p>
        </div>

        {error && (
          <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.25)" }}>
            {error}
          </p>
        )}

        <div className="flex gap-2 mt-1">
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-lg text-sm font-medium transition-colors hover:bg-zinc-50"
            style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}
          >
            Нет
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-10 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: confirmDanger ? "#dc2626" : "var(--on-dark)" }}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ClientProfileCard({
  client,
  memberships,
  canCreatePayment = false,
  canExtend = false,
  canFreeze: mayFreeze = false,
  canDelete = false,
  showFinancials = false,
}: {
  client: ClientProfile
  memberships: Membership[]
  canCreatePayment?: boolean
  canExtend?: boolean
  canFreeze?: boolean
  canDelete?: boolean
  showFinancials?: boolean
}) {
  const [status, setStatus] = useState<ClientStatus>(client.status)
  const sm = statusMeta[status]
  const comment = client.notes && client.notes !== "[demo]" ? client.notes : ""
  const importedFields = Object.entries(client.importData?.extraFields ?? {})
  const isFrozen = status === "frozen"
  const canFreeze = mayFreeze && (status === "active" || status === "frozen")

  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<"delete" | "freeze" | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const telegramLabel = client.telegram
    ? [client.telegram.name, client.telegram.username ? `@${client.telegram.username}` : null].filter(Boolean).join(" · ") || "Привязан"
    : null

  function handleDelete() {
    setDeleteError(null)
    startTransition(async () => {
      const res = await deleteClientAction(client.id)
      if (res?.error) { setDeleteError(res.error); toast.error(res.error); return }
      toast.success("Клиент удалён")
      router.push("/clients")
    })
  }

  function handleFreeze() {
    const prev = status
    const next: ClientStatus = status === "frozen" ? "active" : "frozen"
    setStatus(next)          // оптимистично — статус меняется мгновенно
    setDialog(null)
    startTransition(async () => {
      const res = await toggleFreezeAction(client.id, prev)
      if (res?.error) { setStatus(prev); toast.error(res.error); return }  // откат при ошибке
      toast.success(next === "frozen" ? "Клиент заморожен" : "Клиент разморожен")
      router.refresh()       // фоновая синхронизация
    })
  }

  return (
    <>
      <div className={`relative flex flex-col rounded-xl bg-card p-4 ring-1 transition-all duration-300 ${isFrozen ? "ring-brand/40" : "ring-foreground/10"}`}>
        <div className="relative mb-4 flex items-center gap-3">
          <div
            className={`relative flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-primary-foreground ${isFrozen ? "bg-brand/60" : "bg-brand"}`}
          >
            {initials(client.name)}
            {isFrozen && (
              <div className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-brand">
                <Snowflake className="size-3 text-primary-foreground" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="truncate text-base font-semibold tracking-[-0.12px] text-foreground">
                {client.name}
              </h2>
              <Badge variant="secondary" className={sm.className}>{sm.label}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              ID: {client.id.slice(0, 8)}
            </p>
          </div>
          {(canFreeze || canDelete) && <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Дополнительные действия"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {canFreeze && (
                <DropdownMenuItem onClick={() => setDialog("freeze")}>
                  <Snowflake />
                  {isFrozen ? "Разморозить" : "Заморозить"}
                </DropdownMenuItem>
              )}
              {canFreeze && canDelete && <DropdownMenuSeparator />}
              {canDelete && <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")}>
                <Trash2 />
                Удалить клиента
              </DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>

        {(canCreatePayment || canExtend) && <div className={`relative mb-4 grid gap-2 ${canCreatePayment && canExtend ? "grid-cols-2" : "grid-cols-1"}`}>
          {canCreatePayment && <Button onClick={() => setPaymentOpen(true)} className="w-full">
            <Banknote />
            Добавить оплату
          </Button>}
          {canExtend && <RenewSubscriptionButton clientId={client.id} clientName={client.name} subscription={client.subscription} memberships={memberships} />}
        </div>}

        {showFinancials && <div className="relative mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/50 px-3 py-2.5">
            <p className="mb-0.5 text-xs text-muted-foreground">Баланс</p>
            <p className={`break-words text-sm font-semibold leading-tight tabular-nums ${client.balance > 0 ? "text-chart-2" : "text-foreground"}`}>
              {fmtMoney(client.balance)}
            </p>
          </div>
          <div className={`rounded-lg px-3 py-2.5 ${client.debt > 0 ? "bg-destructive/10" : "bg-muted/50"}`}>
            <p className="mb-0.5 text-xs text-muted-foreground">Долг</p>
            <p className={`break-words text-sm font-semibold leading-tight tabular-nums ${client.debt > 0 ? "text-destructive" : "text-foreground"}`}>
              {fmtMoney(client.debt)}
            </p>
          </div>
        </div>}

        <div className="relative grid grid-cols-2 gap-2">
          <Field label="Телефон" value={client.phone} link={client.phone ? `tel:${client.phone}` : undefined} />
          <Field label="Email" value={client.email} link={client.email ? `mailto:${client.email}` : undefined} />
          <Field label="Тренер" value={client.trainer} />
          <Field label="Источник" value={client.source} />
        </div>

        <details className="group relative mt-3 rounded-lg border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium text-foreground">
            Дополнительная информация
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
            <Field
              label="Telegram-профиль"
              value={telegramLabel}
              link={client.telegram?.username ? `https://t.me/${client.telegram.username}` : undefined}
            />
            <Field label="Telegram ID" value={client.telegram?.id ?? null} />
            <Field label="Дата рождения" value={fmtDate(client.birthDate)} />
            <Field label="Пол" value={client.gender ? (genderLabel[client.gender] ?? client.gender) : null} />
            <Field label="Дата регистрации" value={fmtDate(client.createdAt)} />
            <div className="col-span-2 rounded-lg bg-muted/50 p-3">
              <p className="mb-1 text-xs text-muted-foreground">Комментарий</p>
              <p className="whitespace-pre-wrap text-sm text-foreground">{comment || "Нет комментария"}</p>
            </div>
          </div>
        </details>

        {importedFields.length > 0 && (
          <details className="group relative mt-2 rounded-lg border border-border">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <FileSpreadsheet className="size-4" />
              </div>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">Данные из прежней CRM</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {client.importData?.sourceFile ?? "Импортированный файл"}
                  {client.importData?.importedAt ? ` · ${fmtDate(client.importData.importedAt)}` : ""}
                </span>
              </span>
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <dl className="divide-y divide-border border-t border-border">
              {importedFields.map(([label, value]) => (
                <div key={label} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-3">
                  <dt className="break-words text-xs text-muted-foreground">{label}</dt>
                  <dd className="break-words text-sm font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </div>

      {paymentOpen && (
        <NewPaymentModal
          memberships={memberships}
          fixedClient={{ id: client.id, name: client.name, phone: client.phone }}
          onClose={() => {
            setPaymentOpen(false)
            router.refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={dialog === "delete"}
        title="Удалить клиента?"
        description={`Вы действительно хотите удалить «${client.name}»? Абонементы и посещения будут удалены, история оплат сохранится (без привязки к клиенту).`}
        confirmLabel="Удалить"
        confirmDanger
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => { setDialog(null); setDeleteError(null) }}
        loading={pending}
      />

      <ConfirmDialog
        open={dialog === "freeze"}
        title={isFrozen ? "Разморозить клиента?" : "Заморозить клиента?"}
        description={
          isFrozen
            ? `Абонемент «${client.name}» будет восстановлен, клиент снова станет активным.`
            : `Абонемент «${client.name}» будет заморожен. Вы сможете разморозить его в любой момент.`
        }
        confirmLabel={isFrozen ? "Разморозить" : "Заморозить"}
        onConfirm={handleFreeze}
        onCancel={() => setDialog(null)}
        loading={pending}
      />
    </>
  )
}
