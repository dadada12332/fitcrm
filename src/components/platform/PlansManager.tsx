"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Plus, Pencil, Copy, Archive, ArchiveRestore, Trash2, Star, Crown, X, Check,
  History as HistoryIcon, Loader2,
} from "lucide-react"
import { PT } from "@/components/platform/parts"
import { fmtMoney } from "@/lib/money"
import {
  FEATURE_KEYS, FEATURE_LABELS, LIMIT_KEYS, LIMIT_LABELS,
  SECTION_KEYS, SECTION_LABELS, PERIOD_LABELS, type FullPlan,
} from "@/lib/plans"
import {
  createPlanAction, savePlanAction, archivePlanAction, duplicatePlanAction,
  deletePlanAction, loadPlanHistoryAction, type PlanPayload, type PlanChangeLog,
} from "@/app/platform/(protected)/plans/actions"
import { runAction } from "@/lib/use-action"

const fmtDate = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

type Tab = "info" | "pricing" | "features" | "limits" | "sections" | "landing" | "history"

export function PlansManager({ plans }: { plans: FullPlan[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<FullPlan | null>(null)
  const [busy, startBusy] = useTransition()

  function create() {
    startBusy(async () => { await runAction(() => createPlanAction(), { success: "Тариф создан", onSuccess: () => router.refresh() }) })
  }
  function duplicate(id: string) {
    startBusy(async () => { await runAction(() => duplicatePlanAction(id), { success: "Тариф скопирован", onSuccess: () => router.refresh() }) })
  }
  function archive(id: string, arch: boolean) {
    startBusy(async () => { await runAction(() => archivePlanAction(id, arch), { success: arch ? "Тариф архивирован" : "Тариф восстановлен", onSuccess: () => router.refresh() }) })
  }
  function remove(id: string) {
    if (!confirm("Удалить тариф безвозвратно?")) return
    startBusy(async () => { await runAction(() => deletePlanAction(id), { success: "Тариф удалён", onSuccess: () => router.refresh() }) })
  }

  return (
    <>
      {/* Карточки */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {plans.filter((p) => !p.is_archived).map((p) => (
          <PlanCard key={p.id} plan={p} onEdit={() => setEditing(p)} onDuplicate={() => duplicate(p.id)} onArchive={() => archive(p.id, true)} busy={busy} />
        ))}
        <button onClick={create} disabled={busy}
          className="rounded-lg flex flex-col items-center justify-center gap-2 min-h-[180px] transition-colors hover:bg-muted/60 disabled:opacity-50"
          style={{ border: `1px dashed ${PT.panelBorder}`, color: PT.textMuted }}>
          {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
          <span className="text-sm">Создать тариф</span>
        </button>
      </div>

      {/* Таблица */}
      <div className="rounded-lg overflow-hidden" style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}` }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
                {["Название", "Код", "Статус", "Цена", "Валюта", "Период", "Клубов", "Trial", "Популярный", "Порядок", "Изменён", ""].map((h, i) => (
                  <th key={i} className="text-left text-[11px] font-medium uppercase px-4 py-2.5 whitespace-nowrap" style={{ color: PT.textMuted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="group transition-colors hover:bg-muted/60" style={{ borderBottom: `1px solid ${PT.panelBorder}`, opacity: p.is_archived ? 0.5 : 1 }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                      <span className="text-sm font-medium text-foreground">{p.name}</span>
                      {p.is_recommended && <Crown className="w-3.5 h-3.5" style={{ color: "var(--chart-3)" }} />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: PT.textSoft }}>{p.code}</td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-medium px-2 h-5 inline-flex items-center rounded-md"
                      style={p.is_archived ? { background: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)", color: "var(--muted-foreground)" } : p.is_active ? { background: "color-mix(in srgb, var(--chart-2) 15%, transparent)", color: "var(--chart-2)" } : { background: "color-mix(in srgb, var(--chart-3) 15%, transparent)", color: "var(--chart-3)" }}>
                      {p.is_archived ? "Архив" : p.is_active ? "Активен" : "Черновик"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-foreground">{fmtMoney(p.price, p.currency)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: PT.textSoft }}>{p.currency}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: PT.textSoft }}>{PERIOD_LABELS[p.period] ?? p.period}</td>
                  <td className="px-4 py-3 text-sm tabular-nums" style={{ color: PT.text }}>{p.clubCount}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: PT.textSoft }}>{p.is_trial ? `${p.trial_days} дн` : "—"}</td>
                  <td className="px-4 py-3">{p.is_popular ? <Star className="w-4 h-4" style={{ color: "var(--chart-3)" }} /> : <span style={{ color: PT.textMuted }}>—</span>}</td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: PT.textSoft }}>{p.sort_order}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: PT.textMuted }}>{fmtDate(p.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconBtn title="Редактировать" onClick={() => setEditing(p)}><Pencil className="w-4 h-4" /></IconBtn>
                      <IconBtn title="Дублировать" onClick={() => duplicate(p.id)}><Copy className="w-4 h-4" /></IconBtn>
                      {p.is_archived
                        ? <IconBtn title="Вернуть из архива" onClick={() => archive(p.id, false)}><ArchiveRestore className="w-4 h-4" /></IconBtn>
                        : <IconBtn title="В архив" onClick={() => archive(p.id, true)}><Archive className="w-4 h-4" /></IconBtn>}
                      {p.clubCount === 0 && <IconBtn title="Удалить" onClick={() => remove(p.id)} danger><Trash2 className="w-4 h-4" /></IconBtn>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <PlanEditor plan={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh() }} />}
    </>
  )
}

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick}
      className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-muted"
      style={{ color: danger ? "var(--destructive)" : PT.textSoft }}>
      {children}
    </button>
  )
}

function PlanCard({ plan: p, onEdit, onDuplicate, onArchive, busy }: { plan: FullPlan; onEdit: () => void; onDuplicate: () => void; onArchive: () => void; busy: boolean }) {
  const featOn = Object.values(p.features).filter(Boolean).length
  return (
    <div className={`relative flex flex-col gap-3 rounded-lg border bg-card p-4 ${p.is_recommended ? "border-brand" : "border-border"}`}>
      {p.is_popular && <span className="absolute right-3 top-3 inline-flex h-5 items-center gap-1 rounded-full bg-chart-3/10 px-2 text-[10px] font-semibold text-chart-3"><Star className="size-3" />ХИТ</span>}
      <div className="flex items-center gap-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <span className="text-sm font-bold">{p.name.charAt(0)}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
          <p className="text-[11px]" style={{ color: PT.textMuted }}>{p.code}</p>
        </div>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-bold text-foreground">{fmtMoney(p.price, p.currency)}</span>
        <span className="text-xs mb-1" style={{ color: PT.textMuted }}>/ {PERIOD_LABELS[p.period] ?? p.period}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {p.is_trial && <Chip>{p.trial_days} дн trial</Chip>}
        {p.is_recommended && <Chip color="var(--chart-3)">Рекомендуем</Chip>}
        <Chip color={p.is_active ? "var(--chart-2)" : "var(--muted-foreground)"}>{p.is_active ? "Активен" : "Черновик"}</Chip>
      </div>
      <div className="flex items-center gap-3 text-[11px]" style={{ color: PT.textSoft }}>
        <span>{p.clubCount} клуб.</span><span>·</span><span>{featOn} функц.</span>
      </div>
      <div className="flex items-center gap-1.5 mt-auto pt-1">
        <button onClick={onEdit} disabled={busy} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80">
          <Pencil className="w-3.5 h-3.5" />Изменить
        </button>
        <IconBtn title="Дублировать" onClick={onDuplicate}><Copy className="w-4 h-4" /></IconBtn>
        <IconBtn title="В архив" onClick={onArchive}><Archive className="w-4 h-4" /></IconBtn>
      </div>
    </div>
  )
}

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  const tone = color === "var(--chart-3)" ? "bg-chart-3/10 text-chart-3" : color === "var(--chart-2)" ? "bg-chart-2/10 text-chart-2" : "bg-secondary text-muted-foreground"
  return <span className={`inline-flex h-4 items-center rounded px-1.5 text-[10px] font-medium ${tone}`}>{children}</span>
}

// ── Редактор (drawer) ──────────────────────────────────────────
function toPayload(p: FullPlan): PlanPayload {
  return {
    code: p.code, name: p.name, slug: p.slug, description: p.description, short_description: p.short_description,
    color: p.color, icon: p.icon, sort_order: p.sort_order,
    is_popular: p.is_popular, is_recommended: p.is_recommended, is_active: p.is_active, is_trial: p.is_trial, trial_days: p.trial_days,
    price: p.price, old_price: p.old_price, discount_percent: p.discount_percent, currency: p.currency, period: p.period,
    landing_subtitle: p.landing_subtitle, landing_benefits: p.landing_benefits, landing_cta: p.landing_cta,
    features: { ...Object.fromEntries(FEATURE_KEYS.map((k) => [k, p.features[k] ?? false])) },
    limits: { ...Object.fromEntries(LIMIT_KEYS.map((k) => [k, p.limits[k] ?? null])) },
    sections: { ...Object.fromEntries(SECTION_KEYS.map((k) => [k, p.sections[k] ?? false])) },
  }
}

function PlanEditor({ plan, onClose, onSaved }: { plan: FullPlan; onClose: () => void; onSaved: () => void }) {
  const [tab, setTab] = useState<Tab>("info")
  const [f, setF] = useState<PlanPayload>(() => toPayload(plan))
  const [saving, setSaving] = useState(false)
  const [askPrice, setAskPrice] = useState(false)
  const [history, setHistory] = useState<PlanChangeLog[] | null>(null)
  const set = <K extends keyof PlanPayload>(k: K, v: PlanPayload[K]) => setF((p) => ({ ...p, [k]: v }))

  const priceChanged = Number(f.price) !== Number(plan.price) && !f.is_trial

  async function doSave(mode?: "new_only" | "all") {
    setAskPrice(false)
    setSaving(true)
    const r = await savePlanAction(plan.id, f, mode)
    setSaving(false)
    if (r.error) { alert(r.error); return }
    onSaved()
  }
  function save() {
    // Изменилась цена и тариф уже используют клубы → спросить, как применять (grandfather).
    if (priceChanged && plan.clubCount > 0) { setAskPrice(true); return }
    doSave()
  }
  async function openHistory() {
    setTab("history")
    if (history === null) setHistory(await loadPlanHistoryAction(plan.id))
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "info", label: "Основное" }, { key: "pricing", label: "Стоимость" },
    { key: "features", label: "Возможности" }, { key: "limits", label: "Лимиты" },
    { key: "sections", label: "Разделы CRM" }, { key: "landing", label: "Лендинг" },
  ]

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-2xl h-full overflow-y-auto flex flex-col" style={{ background: PT.bg, borderLeft: `1px solid ${PT.panelBorder}` }} onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 h-14 shrink-0" style={{ background: PT.bg, borderBottom: `1px solid ${PT.panelBorder}` }}>
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full" style={{ background: f.color }} />
            <span className="text-sm font-semibold text-foreground">{f.name || "Тариф"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openHistory} title="История" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-muted" style={{ color: tab === "history" ? "var(--foreground)" : PT.textSoft }}><HistoryIcon className="w-4 h-4" /></button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-muted" style={{ color: PT.textSoft }}><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* tabs */}
        <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto shrink-0" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`h-8 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors ${tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* body */}
        <div className="flex-1 p-5 space-y-4">
          {tab === "info" && (
            <>
              <Field label="Название"><Input value={f.name} onChange={(v) => set("name", v)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Код тарифа"><Input value={f.code} onChange={(v) => set("code", v)} mono /></Field>
                <Field label="Slug"><Input value={f.slug} onChange={(v) => set("slug", v)} mono /></Field>
              </div>
              <Field label="Короткое описание"><Input value={f.short_description} onChange={(v) => set("short_description", v)} /></Field>
              <Field label="Описание"><Textarea value={f.description} onChange={(v) => set("description", v)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Цвет"><div className="flex items-center gap-2"><input type="color" value={f.color} onChange={(e) => set("color", e.target.value)} className="w-9 h-9 rounded-lg bg-transparent cursor-pointer" /><Input value={f.color} onChange={(v) => set("color", v)} mono /></div></Field>
                <Field label="Порядок отображения"><NumInput value={f.sort_order} onChange={(v) => set("sort_order", v ?? 0)} /></Field>
              </div>
              <div className="space-y-2 pt-1">
                <Toggle label="Активен (виден клубам/на лендинге)" checked={f.is_active} onChange={(v) => set("is_active", v)} />
                <Toggle label="Популярный (ХИТ)" checked={f.is_popular} onChange={(v) => set("is_popular", v)} />
                <Toggle label="Рекомендуемый" checked={f.is_recommended} onChange={(v) => set("is_recommended", v)} />
                <Toggle label="Пробный тариф (Trial)" checked={f.is_trial} onChange={(v) => set("is_trial", v)} />
                {f.is_trial && (
                  <Field label="Пробный период (дней)">
                    <div className="flex gap-1.5">
                      {[0, 7, 14, 30, 60].map((d) => (
                        <button key={d} onClick={() => set("trial_days", d)} className={`h-8 rounded-lg px-3 text-xs font-medium ${f.trial_days === d ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"}`}>{d}</button>
                      ))}
                    </div>
                  </Field>
                )}
              </div>
            </>
          )}

          {tab === "pricing" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Цена"><NumInput value={f.price} onChange={(v) => set("price", v ?? 0)} /></Field>
                <Field label="Старая цена (зачёркнутая)"><NumInput value={f.old_price} onChange={(v) => set("old_price", v)} nullable /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Скидка %"><NumInput value={f.discount_percent} onChange={(v) => set("discount_percent", v)} nullable /></Field>
                <Field label="Валюта">
                  <Select value={f.currency} onChange={(v) => set("currency", v)} options={[["USD", "USD ($)"], ["UZS", "UZS (сум)"]]} />
                </Field>
                <Field label="Период">
                  <Select value={f.period} onChange={(v) => set("period", v)} options={[["monthly", "Месяц"], ["quarterly", "Квартал"], ["yearly", "Год"]]} />
                </Field>
              </div>
              <div className="rounded-lg p-3 text-xs" style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}`, color: PT.textSoft }}>
                Предпросмотр: <span className="text-foreground font-semibold">{fmtMoney(f.price, f.currency)}</span> / {PERIOD_LABELS[f.period]}
                {f.old_price != null && <span className="line-through ml-2" style={{ color: PT.textMuted }}>{fmtMoney(f.old_price, f.currency)}</span>}
              </div>
            </>
          )}

          {tab === "features" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEATURE_KEYS.map((k) => (
                <Toggle key={k} label={FEATURE_LABELS[k] ?? k} checked={f.features[k] ?? false} onChange={(v) => set("features", { ...f.features, [k]: v })} />
              ))}
            </div>
          )}

          {tab === "limits" && (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: PT.textMuted }}>Пустое поле = безлимит (∞)</p>
              {LIMIT_KEYS.map((k) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span className="text-sm" style={{ color: PT.text }}>{LIMIT_LABELS[k] ?? k}</span>
                  <div className="w-40"><NumInput value={f.limits[k] ?? null} onChange={(v) => set("limits", { ...f.limits, [k]: v })} nullable placeholder="∞" /></div>
                </div>
              ))}
            </div>
          )}

          {tab === "sections" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SECTION_KEYS.map((k) => (
                <Toggle key={k} label={SECTION_LABELS[k] ?? k} checked={f.sections[k] ?? false} onChange={(v) => set("sections", { ...f.sections, [k]: v })} />
              ))}
            </div>
          )}

          {tab === "landing" && (
            <>
              <Field label="Подзаголовок для лендинга"><Input value={f.landing_subtitle} onChange={(v) => set("landing_subtitle", v)} /></Field>
              <Field label="Текст кнопки (CTA)"><Input value={f.landing_cta} onChange={(v) => set("landing_cta", v)} /></Field>
              <Field label="Преимущества / что входит (по строке на пункт)">
                <Textarea rows={7} value={f.landing_benefits.join("\n")} onChange={(v) => set("landing_benefits", v.split("\n").map((s) => s.trim()).filter(Boolean))} />
              </Field>
            </>
          )}

          {tab === "history" && (
            <div className="space-y-2">
              {history === null ? (
                <div className="flex items-center gap-2 text-sm py-8 justify-center" style={{ color: PT.textMuted }}><Loader2 className="w-4 h-4 animate-spin" />Загрузка…</div>
              ) : history.length === 0 ? (
                <p className="text-sm py-8 text-center" style={{ color: PT.textMuted }}>Изменений пока нет</p>
              ) : history.map((h) => (
                <div key={h.id} className="rounded-lg p-3 text-xs" style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium" style={{ color: PT.text }}>{h.field ?? h.action}</span>
                    <span style={{ color: PT.textMuted }}>{fmtDate(h.created_at)}</span>
                  </div>
                  {(h.old_value != null || h.new_value != null) && (
                    <div className="flex items-center gap-2" style={{ color: PT.textSoft }}>
                      <span className="line-through" style={{ color: PT.textMuted }}>{h.old_value ?? "—"}</span>
                      <span>→</span><span className="text-foreground">{h.new_value ?? "—"}</span>
                    </div>
                  )}
                  <p className="mt-1" style={{ color: PT.textMuted }}>{h.admin_email ?? "—"}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* footer */}
        {tab !== "history" && (
          <div className="sticky bottom-0 flex items-center justify-end gap-2 px-5 h-16 shrink-0" style={{ background: PT.bg, borderTop: `1px solid ${PT.panelBorder}` }}>
            <button onClick={onClose} className="h-9 px-4 rounded-lg text-sm font-medium" style={{ color: PT.textSoft }}>Отмена</button>
            <button onClick={save} disabled={saving} className="flex h-9 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/80">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Сохранить
            </button>
          </div>
        )}

        {/* Grandfather pricing: выбор при изменении цены */}
        {askPrice && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-5" onClick={() => setAskPrice(false)}>
            <div className="w-full max-w-sm rounded-lg p-5" style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}` }} onClick={(e) => e.stopPropagation()}>
              <p className="text-base font-semibold text-foreground mb-1">Изменение цены</p>
              <p className="text-sm mb-4" style={{ color: PT.textSoft }}>
                Тариф используют <span className="text-foreground font-medium">{plan.clubCount}</span> клуб(ов).
                Цена меняется с <span className="line-through" style={{ color: PT.textMuted }}>{fmtMoney(plan.price, f.currency)}</span> на <span className="text-foreground font-medium">{fmtMoney(f.price, f.currency)}</span>.
              </p>
              <button onClick={() => doSave("new_only")} className="w-full text-left rounded-lg p-3 mb-2 transition-colors hover:bg-muted/60" style={{ border: `1px solid ${PT.panelBorder}` }}>
                <p className="text-sm font-medium text-foreground">Только для новых клиентов</p>
                <p className="text-xs mt-0.5" style={{ color: PT.textMuted }}>Текущие клубы сохранят старую цену (grandfather pricing)</p>
              </button>
              <button onClick={() => doSave("all")} className="w-full text-left rounded-lg p-3 mb-3 transition-colors hover:bg-muted/60" style={{ border: `1px solid ${PT.panelBorder}` }}>
                <p className="text-sm font-medium text-foreground">Применить ко всем клубам</p>
                <p className="text-xs mt-0.5" style={{ color: PT.textMuted }}>Все {plan.clubCount} клуб(ов) перейдут на новую цену</p>
              </button>
              <button onClick={() => setAskPrice(false)} className="w-full h-9 rounded-lg text-sm font-medium" style={{ color: PT.textSoft }}>Отмена</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Мелкие поля формы ──────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs mb-1.5" style={{ color: PT.textMuted }}>{label}</label>{children}</div>
}
function Input({ value, onChange, mono }: { value: string; onChange: (v: string) => void; mono?: boolean }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} className={`h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ${mono ? "font-mono" : ""}`} />
}
function Textarea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
}
function NumInput({ value, onChange, nullable, placeholder }: { value: number | null; onChange: (v: number | null) => void; nullable?: boolean; placeholder?: string }) {
  return <input type="number" value={value ?? ""} placeholder={placeholder} onChange={(e) => { const v = e.target.value; onChange(v === "" ? (nullable ? null : 0) : Number(v)) }} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm tabular-nums text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="w-full flex items-center justify-between gap-3 h-10 px-3 rounded-lg transition-colors" style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}` }}>
      <span className="text-sm" style={{ color: PT.text }}>{label}</span>
      <span className="w-9 h-5 rounded-full relative transition-colors shrink-0" style={{ background: checked ? "var(--chart-2)" : "var(--border)" }}>
        <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: checked ? "18px" : "2px" }} />
      </span>
    </button>
  )
}
