"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plug, X, Check, Loader2, Copy, Ban, Inbox } from "lucide-react"
import { PT } from "@/components/platform/parts"
import type { ConnectionRequest, Provider } from "@/lib/payments-connect"
import {
  activateConnectionAction, rejectConnectionAction, disableConnectionAction,
  type ClickCreds, type PaymeCreds,
} from "@/app/platform/(protected)/connections/actions"
import { runAction, toast } from "@/lib/use-action"

const PROVIDER: Record<Provider, { name: string; letter: string }> = {
  payme: { name: "Payme", letter: "P" },
  click: { name: "Click", letter: "C" },
}
const fmtDate = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

export function ConnectionsManager({ pending, resolved, appUrl }: { pending: ConnectionRequest[]; resolved: ConnectionRequest[]; appUrl: string }) {
  const router = useRouter()
  const [busy, start] = useTransition()
  const [editing, setEditing] = useState<ConnectionRequest | null>(null)

  function reject(r: ConnectionRequest) {
    if (!confirm(`Отклонить заявку ${PROVIDER[r.provider].name} от «${r.clubName}»?`)) return
    start(async () => { await runAction(() => rejectConnectionAction(r.id, r.clubId), { success: "Заявка отклонена", onSuccess: () => router.refresh() }) })
  }
  function disable(r: ConnectionRequest) {
    if (!confirm(`Отключить приём ${PROVIDER[r.provider].name} у «${r.clubName}»?`)) return
    start(async () => { await runAction(() => disableConnectionAction(r.id, r.clubId, r.provider), { success: "Приём отключён", onSuccess: () => router.refresh() }) })
  }

  return (
    <>
      {/* Ожидают */}
      <div className="rounded-lg overflow-hidden mb-4" style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}` }}>
        <div className="flex items-center gap-2 px-4 h-12" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
          <Inbox className="w-4 h-4" style={{ color: "var(--chart-3)" }} />
          <span className="text-sm font-semibold text-foreground">Новые заявки</span>
          {pending.length > 0 && <span className="text-[11px] font-semibold px-1.5 h-5 min-w-5 flex items-center justify-center rounded-full" style={{ background: "var(--chart-3)", color: "var(--background)" }}>{pending.length}</span>}
        </div>
        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Plug className="w-7 h-7" style={{ color: PT.textMuted }} />
            <p className="text-sm" style={{ color: PT.textMuted }}>Новых заявок нет</p>
          </div>
        ) : (
          <div className="p-2">
            {pending.map((r) => {
              const pv = PROVIDER[r.provider]
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg p-3 hover:bg-muted/60">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-sm font-bold text-brand">{pv.letter}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.clubName} · {pv.name}</p>
                    <p className="text-[11px]" style={{ color: PT.textMuted }}>{r.requestedEmail ?? "—"} · {fmtDate(r.createdAt)}</p>
                  </div>
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <button onClick={() => reject(r)} disabled={busy} className="h-8 flex-1 rounded-lg px-3 text-xs font-medium disabled:opacity-50 sm:flex-none" style={{ border: `1px solid ${PT.panelBorder}`, color: "var(--destructive)" }}>Отклонить</button>
                    <button onClick={() => setEditing(r)} disabled={busy} className="h-8 flex-1 rounded-lg bg-primary px-3.5 text-xs font-medium text-primary-foreground disabled:opacity-50 sm:flex-none">Активировать</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Подключённые / решённые */}
      <div className="rounded-lg overflow-hidden" style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}` }}>
        <div className="flex items-center gap-2 px-4 h-12" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
          <span className="text-sm font-semibold text-foreground">Подключения</span>
        </div>
        {resolved.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: PT.textMuted }}>Пока нет подключений</p>
        ) : (
          <div className="p-2">
            {resolved.map((r) => {
              const pv = PROVIDER[r.provider]
              const active = r.status === "active" && r.enabled
              const metaStr = r.provider === "click"
                ? `Merchant ${r.credMeta.merchant_id ?? "—"} · Service ${r.credMeta.service_id ?? "—"} · ключ ••••${r.credMeta.secret_last4 ?? ""}`
                : `Cashbox ${r.credMeta.cashbox_id ?? "—"} · ${r.credMeta.account_field ?? "order_id"} · ключ ••••${r.credMeta.key_last4 ?? ""}`
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg p-3" style={{ opacity: active ? 1 : 0.55 }}>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-sm font-bold text-brand">{pv.letter}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.clubName} · {pv.name}</p>
                    <p className="text-[11px] truncate" style={{ color: PT.textMuted }}>{active ? metaStr : (r.status === "rejected" ? "Отклонено" : "Отключено")}</p>
                  </div>
                  {active ? (
                    <div className="flex w-full items-center justify-end gap-1.5 sm:w-auto">
                      <span className="text-[11px] font-medium px-2 h-6 inline-flex items-center gap-1 rounded-md" style={{ background: "color-mix(in srgb, var(--chart-2) 15%, transparent)", color: "var(--chart-2)" }}><Check className="w-3 h-3" />Активно</span>
                      <button onClick={() => setEditing(r)} disabled={busy} className="text-xs font-medium px-3 h-8 rounded-lg disabled:opacity-50" style={{ border: `1px solid ${PT.panelBorder}`, color: PT.textSoft }}>Изменить</button>
                      <button onClick={() => disable(r)} disabled={busy} className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50" style={{ color: "var(--destructive)" }} title="Отключить"><Ban className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <span className="text-[11px] px-2 h-6 inline-flex items-center rounded-md" style={{ background: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)", color: "var(--muted-foreground)" }}>{r.status === "rejected" ? "Отклонено" : "Отключено"}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {editing && <ActivateDrawer req={editing} appUrl={appUrl} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh() }} />}
    </>
  )
}

function ActivateDrawer({ req, appUrl, onClose, onDone }: { req: ConnectionRequest; appUrl: string; onClose: () => void; onDone: () => void }) {
  const pv = PROVIDER[req.provider]
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const endpointUrl = `${appUrl}/api/pay/${req.provider}/${req.clubId}`

  // Поля (секреты пустые — вводятся заново; идентификаторы предзаполняем из меты).
  const [click, setClick] = useState<ClickCreds>({
    merchant_id: req.credMeta.merchant_id ?? "", service_id: req.credMeta.service_id ?? "",
    merchant_user_id: req.credMeta.merchant_user_id ?? "", secret_key: "",
  })
  const [payme, setPayme] = useState<PaymeCreds>({
    cashbox_id: req.credMeta.cashbox_id ?? "", key: "", test_key: "",
    account_field: req.credMeta.account_field ?? "order_id",
  })

  async function save() {
    setErr(null); setSaving(true)
    const creds = req.provider === "click" ? click : payme
    const r = await activateConnectionAction(req.id, req.clubId, req.provider, creds)
    setSaving(false)
    if (r.error) { setErr(r.error); toast.error(r.error); return }
    toast.success("Приём платежей активирован")
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg h-full overflow-y-auto flex flex-col" style={{ background: PT.bg, borderLeft: `1px solid ${PT.panelBorder}` }} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 h-14 shrink-0" style={{ background: PT.bg, borderBottom: `1px solid ${PT.panelBorder}` }}>
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-brand/10 text-xs font-bold text-brand">{pv.letter}</span>
            <span className="text-sm font-semibold text-foreground">{pv.name} · {req.clubName}</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted" style={{ color: PT.textSoft }}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 p-5 space-y-4">
          {/* Endpoint URL для кабинета мерчанта */}
          <div className="rounded-lg p-3" style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}` }}>
            <p className="text-xs mb-1.5" style={{ color: PT.textMuted }}>URL для настройки в кабинете {pv.name} (укажите как endpoint/callback):</p>
            <div className="flex items-center gap-2">
              <code className="text-[12px] flex-1 truncate" style={{ color: "var(--brand)" }}>{endpointUrl}</code>
              <button onClick={() => navigator.clipboard?.writeText(endpointUrl)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted" style={{ color: PT.textSoft }} title="Копировать"><Copy className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          {req.provider === "click" ? (
            <>
              <Field label="Merchant ID"><Inp value={click.merchant_id} onChange={(v) => setClick({ ...click, merchant_id: v })} /></Field>
              <Field label="Service ID"><Inp value={click.service_id} onChange={(v) => setClick({ ...click, service_id: v })} /></Field>
              <Field label="Merchant User ID"><Inp value={click.merchant_user_id} onChange={(v) => setClick({ ...click, merchant_user_id: v })} /></Field>
              <Field label={`Secret Key ${req.enabled ? "(оставьте пустым, чтобы не менять)" : ""}`}><Inp value={click.secret_key} onChange={(v) => setClick({ ...click, secret_key: v })} secret placeholder={req.enabled ? `••••${req.credMeta.secret_last4 ?? ""}` : ""} /></Field>
            </>
          ) : (
            <>
              <Field label="Cashbox ID (Merchant ID)"><Inp value={payme.cashbox_id} onChange={(v) => setPayme({ ...payme, cashbox_id: v })} /></Field>
              <Field label={`KEY (боевой) ${req.enabled ? "(пусто = не менять)" : ""}`}><Inp value={payme.key} onChange={(v) => setPayme({ ...payme, key: v })} secret placeholder={req.enabled ? `••••${req.credMeta.key_last4 ?? ""}` : ""} /></Field>
              <Field label="TEST KEY (опционально)"><Inp value={payme.test_key} onChange={(v) => setPayme({ ...payme, test_key: v })} secret /></Field>
              <Field label="Поле account (идентификатор заказа)"><Inp value={payme.account_field} onChange={(v) => setPayme({ ...payme, account_field: v })} /></Field>
            </>
          )}

          {err && <p className="text-sm" style={{ color: "var(--destructive)" }}>{err}</p>}
          <p className="text-[11px]" style={{ color: PT.textMuted }}>🔒 Секреты сохраняются шифрованно (AES-256-GCM) и не отображаются повторно.</p>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 px-5 h-16 shrink-0" style={{ background: PT.bg, borderTop: `1px solid ${PT.panelBorder}` }}>
          <button onClick={onClose} className="h-9 px-4 rounded-lg text-sm font-medium" style={{ color: PT.textSoft }}>Отмена</button>
          <button onClick={save} disabled={saving} className="flex h-9 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{req.enabled ? "Сохранить" : "Активировать"}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs mb-1.5" style={{ color: PT.textMuted }}>{label}</label>{children}</div>
}
function Inp({ value, onChange, secret, placeholder }: { value: string; onChange: (v: string) => void; secret?: boolean; placeholder?: string }) {
  return <input type={secret ? "password" : "text"} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" autoComplete="off" />
}
