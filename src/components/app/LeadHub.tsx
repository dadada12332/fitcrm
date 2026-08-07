"use client"

import type { FormEvent } from "react"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  ChevronRight,
  CircleGauge,
  Clock3,
  Filter,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  UserRoundPlus,
  UserRoundSearch,
  UsersRound,
  X,
} from "lucide-react"
import { createLeadAction, duplicateLeadAction, type CreateLeadInput, type LeadDuplicate } from "@/app/(app)/leads/actions"
import { LeadDetailSheet } from "@/components/app/LeadDetailSheet"
import { useAppLocale } from "@/components/app/ClubContext"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { LeadHubData, LeadRow, LeadStageOption } from "@/lib/leads"
import { toast } from "@/lib/use-action"
import { cn } from "@/lib/utils"

export type LeadHubQueryState = {
  search: string
  quick: "all" | "mine" | "overdue" | "unassigned"
  stage: string
  source: string
  assignee: string
  state: "open" | "won" | "lost" | "all"
  sort: "updated_desc" | "created_desc" | "action_asc" | "value_desc"
  page: number
}

export type LeadHubPermissions = {
  create: boolean
  edit: boolean
  assign: boolean
  convert: boolean
  archive: boolean
  clientsView: boolean
  clientsCreate: boolean
  readOnly: boolean
}

type UrlPatch = Record<string, string | number | null | undefined>

const QUICK_FILTERS = [
  { key: "all", label: "Все" },
  { key: "mine", label: "Мои" },
  { key: "overdue", label: "Просрочено" },
  { key: "unassigned", label: "Без ответственного" },
] as const

const STATE_LABELS: Record<LeadHubQueryState["state"], string> = {
  open: "В работе",
  won: "Конвертированы",
  lost: "Потеряны",
  all: "Все состояния",
}

const SORT_LABELS: Record<LeadHubQueryState["sort"], string> = {
  updated_desc: "Недавно обновлённые",
  created_desc: "Сначала новые",
  action_asc: "По ближайшему действию",
  value_desc: "По потенциальной сумме",
}

function localeTag(locale: string): string {
  if (locale === "en") return "en-US"
  if (locale === "uz") return "uz-UZ"
  return "ru-RU"
}

function formatDateTime(value: string | null, locale: string, timezone: string): string {
  if (!value) return "—"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "—"
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date)
}

function formatRelativeDue(value: string, now: number): { label: string; status: "normal" | "soon" | "overdue" } {
  const deltaMinutes = Math.round((new Date(value).getTime() - now) / 60_000)
  const absolute = Math.abs(deltaMinutes)
  const duration = absolute < 60
    ? `${Math.max(1, absolute)} мин`
    : absolute < 1_440
      ? `${Math.round(absolute / 60)} ч`
      : `${Math.round(absolute / 1_440)} дн`
  if (deltaMinutes < 0) return { label: `Просрочено ${duration}`, status: "overdue" }
  if (deltaMinutes <= 60) return { label: `Осталось ${duration}`, status: "soon" }
  return { label: `Через ${duration}`, status: "normal" }
}

function stageClass(tone: LeadStageOption["tone"]): string {
  if (tone === "brand") return "border-brand/30 bg-brand/10 text-brand"
  if (tone === "warning") return "border-chart-3/30 bg-chart-3/10 text-chart-3"
  if (tone === "success") return "border-chart-2/30 bg-chart-2/10 text-chart-2"
  if (tone === "destructive") return "border-destructive/30 bg-destructive/10 text-destructive"
  return "border-border bg-muted text-muted-foreground"
}

function StageBadge({ stage }: { stage: LeadStageOption }) {
  return <Badge variant="outline" className={stageClass(stage.tone)}>{stage.name}</Badge>
}

function SlaBadge({ lead, now }: { lead: LeadRow; now: number }) {
  if (lead.state !== "open") {
    return <Badge variant="secondary">{lead.state === "won" ? "Завершено" : "Закрыто"}</Badge>
  }
  const target = lead.firstResponseAt ? lead.nextAction?.dueAt : lead.firstResponseDueAt
  if (!target) return <Badge variant="outline" className="border-chart-3/30 bg-chart-3/10 text-chart-3">Нет действия</Badge>
  const due = formatRelativeDue(target, now)
  return (
    <Badge
      variant="outline"
      className={cn(
        due.status === "overdue" && "border-destructive/30 bg-destructive/10 text-destructive",
        due.status === "soon" && "border-chart-3/30 bg-chart-3/10 text-chart-3",
        due.status === "normal" && "border-border bg-muted text-muted-foreground",
      )}
    >
      {due.label}
    </Badge>
  )
}

function SearchBox({
  initialValue,
  pending,
  onCommit,
}: {
  initialValue: string
  pending: boolean
  onCommit: (value: string) => void
}) {
  const [value, setValue] = useState(initialValue)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const timeout = window.setTimeout(() => onCommit(value.trim()), 350)
    return () => window.clearTimeout(timeout)
  }, [onCommit, value])

  return (
    <div className="relative min-w-0 flex-1 lg:max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Имя, телефон, email или Telegram"
        aria-label="Поиск лидов"
        className="pr-10 pl-9"
      />
      {pending ? (
        <LoaderCircle className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
      ) : value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-1.5 top-1/2 -translate-y-1/2"
          onClick={() => setValue("")}
          aria-label="Очистить поиск"
        >
          <X />
        </Button>
      ) : null}
    </div>
  )
}

function FilterSheet({
  data,
  query,
  activeCount,
  onApply,
}: {
  data: LeadHubData
  query: LeadHubQueryState
  activeCount: number
  onApply: (patch: UrlPatch) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => ({
    stage: query.stage || "any",
    source: query.source || "any",
    assignee: query.assignee || "any",
    state: query.state,
    sort: query.sort,
  }))

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft({
        stage: query.stage || "any",
        source: query.source || "any",
        assignee: query.assignee || "any",
        state: query.state,
        sort: query.sort,
      })
    }
    setOpen(next)
  }

  function apply() {
    onApply({
      stage: draft.stage === "any" ? null : draft.stage,
      source: draft.source === "any" ? null : draft.source,
      assignee: draft.assignee === "any" ? null : draft.assignee,
      state: draft.state === "open" ? null : draft.state,
      sort: draft.sort === "updated_desc" ? null : draft.sort,
      page: null,
    })
    setOpen(false)
  }

  function clear() {
    setDraft({ stage: "any", source: "any", assignee: "any", state: "open", sort: "updated_desc" })
    onApply({ stage: null, source: null, assignee: null, state: null, sort: null, page: null })
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger
        render={<Button type="button" variant="outline" className="w-full lg:w-auto" aria-label={activeCount ? `Фильтры, активно: ${activeCount}` : "Фильтры"} />}
      >
        <Filter />
        Фильтр
        {activeCount > 0 ? <Badge variant="secondary">{activeCount}</Badge> : null}
      </SheetTrigger>
      <SheetContent aria-describedby="lead-filter-description">
        <SheetHeader className="px-4 sm:px-6">
          <div className="min-w-0">
            <SheetTitle>Фильтр лидов</SheetTitle>
            <p id="lead-filter-description" className="mt-0.5 text-xs text-muted-foreground">Настройте рабочую очередь под текущую задачу.</p>
          </div>
          <SheetClose render={<Button type="button" variant="ghost" size="icon" aria-label="Закрыть фильтр" />}><X /></SheetClose>
        </SheetHeader>
        <SheetBody className="space-y-5 px-4 sm:px-6">
          <Field label="Этап" htmlFor="lead-filter-stage">
            <Select value={draft.stage} onValueChange={(value) => setDraft((current) => ({ ...current, stage: String(value ?? "any") }))}>
              <SelectTrigger id="lead-filter-stage"><SelectValue>{draft.stage === "any" ? "Все этапы" : data.stages.find((item) => item.key === draft.stage)?.name}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Все этапы</SelectItem>
                {data.stages.map((stage) => <SelectItem key={stage.id} value={stage.key}>{stage.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Источник" htmlFor="lead-filter-source">
            <Select value={draft.source} onValueChange={(value) => setDraft((current) => ({ ...current, source: String(value ?? "any") }))}>
              <SelectTrigger id="lead-filter-source"><SelectValue>{draft.source === "any" ? "Все источники" : data.sources.find((item) => item.key === draft.source)?.name}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Все источники</SelectItem>
                {data.sources.map((source) => <SelectItem key={source.id} value={source.key}>{source.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ответственный" htmlFor="lead-filter-assignee">
            <Select value={draft.assignee} onValueChange={(value) => setDraft((current) => ({ ...current, assignee: String(value ?? "any") }))}>
              <SelectTrigger id="lead-filter-assignee"><SelectValue>{draft.assignee === "any" ? "Все сотрудники" : draft.assignee === "unassigned" ? "Не назначен" : data.staff.find((item) => item.id === draft.assignee)?.name}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Все сотрудники</SelectItem>
                <SelectItem value="unassigned">Не назначен</SelectItem>
                {data.staff.map((staff) => <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Состояние" htmlFor="lead-filter-state">
            <Select value={draft.state} onValueChange={(value) => setDraft((current) => ({ ...current, state: (value ?? "open") as LeadHubQueryState["state"] }))}>
              <SelectTrigger id="lead-filter-state"><SelectValue>{STATE_LABELS[draft.state]}</SelectValue></SelectTrigger>
              <SelectContent>
                {(Object.keys(STATE_LABELS) as LeadHubQueryState["state"][]).map((state) => <SelectItem key={state} value={state}>{STATE_LABELS[state]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Сортировка" htmlFor="lead-filter-sort">
            <Select value={draft.sort} onValueChange={(value) => setDraft((current) => ({ ...current, sort: (value ?? "updated_desc") as LeadHubQueryState["sort"] }))}>
              <SelectTrigger id="lead-filter-sort"><SelectValue>{SORT_LABELS[draft.sort]}</SelectValue></SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as LeadHubQueryState["sort"][]).map((sort) => <SelectItem key={sort} value={sort}>{SORT_LABELS[sort]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </SheetBody>
        <SheetFooter className="h-auto flex-col-reverse items-stretch px-4 py-4 sm:flex-row sm:items-center sm:px-6">
          <Button type="button" variant="ghost" onClick={clear}>Очистить</Button>
          <Button type="button" className="sm:ml-auto" onClick={apply}>Применить</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

type AddLeadDraft = {
  fullName: string
  phone: string
  email: string
  sourceKey: string
  assigneeStaffId: string
  interest: string
  estimatedValue: string
  notes: string
}

function emptyAddDraft(sourceKey: string, currentStaffId: string | null): AddLeadDraft {
  return {
    fullName: "",
    phone: "",
    email: "",
    sourceKey,
    assigneeStaffId: currentStaffId ?? "unassigned",
    interest: "",
    estimatedValue: "",
    notes: "",
  }
}

function AddLeadSheet({
  data,
  canAssign,
  onCreated,
  onOpenLead,
}: {
  data: LeadHubData
  canAssign: boolean
  onCreated: (leadId: string) => void
  onOpenLead: (leadId: string) => void
}) {
  const defaultSource = data.sources.find((source) => source.key === "manual")?.key ?? data.sources[0]?.key ?? "manual"
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<AddLeadDraft>(() => emptyAddDraft(defaultSource, data.currentStaffId))
  const [duplicates, setDuplicates] = useState<LeadDuplicate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [contactError, setContactError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(emptyAddDraft(defaultSource, data.currentStaffId))
      setDuplicates([])
      setError(null)
      setContactError(null)
    }
    setOpen(next)
  }

  function payload(): CreateLeadInput {
    return {
      fullName: draft.fullName,
      phone: draft.phone || null,
      email: draft.email || null,
      sourceKey: draft.sourceKey,
      assigneeStaffId: draft.assigneeStaffId === "unassigned" ? null : draft.assigneeStaffId,
      interest: draft.interest || null,
      estimatedValue: Number(draft.estimatedValue || 0),
      notes: draft.notes || null,
    }
  }

  function updateIdentity(field: "fullName" | "phone" | "email", value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
    setDuplicates([])
    setError(null)
    if (field === "phone" || field === "email") setContactError(null)
  }

  function submit(forceDuplicate = false) {
    if (!draft.phone.trim() && !draft.email.trim()) {
      setContactError("Укажите телефон или email, чтобы связаться с лидом.")
      return
    }
    setContactError(null)
    setError(null)
    startTransition(async () => {
      try {
        const result = forceDuplicate
          ? await duplicateLeadAction(payload())
          : await createLeadAction(payload())
        if (!result.ok) {
          if (result.code === "duplicate") setDuplicates(result.duplicates ?? [])
          setError(result.error)
          return
        }
        toast.success(forceDuplicate ? "Лид создан как отдельная карточка" : "Лид добавлен")
        setOpen(false)
        onCreated(result.leadId)
      } catch {
        setError("Не удалось создать лида. Попробуйте ещё раз.")
      }
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submit(false)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={<Button type="button" className="w-full sm:w-auto" />}><Plus />Добавить лида</SheetTrigger>
      <SheetContent className="max-w-[620px]" aria-describedby="add-lead-description">
        <SheetHeader className="h-auto min-h-16 gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <SheetTitle>Новый лид</SheetTitle>
            <p id="add-lead-description" className="mt-0.5 text-xs text-muted-foreground">
              {canAssign ? "Добавьте контакт и сразу назначьте следующего ответственного." : "Добавьте контакт — новый лид будет назначен на вас."}
            </p>
          </div>
          <SheetClose render={<Button type="button" variant="ghost" size="icon" aria-label="Закрыть форму" />}><X /></SheetClose>
        </SheetHeader>
        <SheetBody className="px-4 sm:px-6">
          <form id="add-lead-form" onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {duplicates.length > 0 ? (
              <div className="space-y-3 rounded-xl border border-chart-3/30 bg-chart-3/10 p-4" aria-live="polite">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-chart-3" aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-foreground">Найдены совпадения</p>
                    <p className="mt-1 text-xs text-muted-foreground">Откройте существующую карточку или подтвердите создание отдельного лида.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {duplicates.map((item) => (
                    <div key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.type === "lead" ? "Лид" : "Клиент"} · {item.phone || item.email || "Контакт скрыт"}</p>
                      </div>
                      {item.type === "lead" ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => { setOpen(false); onOpenLead(item.id) }}>Открыть</Button>
                      ) : (
                        <Button type="button" size="sm" variant="outline" nativeButton={false} render={<Link href={`/clients/${item.id}`} />}>К клиенту</Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" onClick={() => submit(true)} disabled={pending}>
                  {pending ? <LoaderCircle className="animate-spin" /> : <UserRoundPlus />}
                  Создать отдельного лида
                </Button>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Имя" htmlFor="lead-add-name" required>
                <Input id="lead-add-name" value={draft.fullName} onChange={(event) => updateIdentity("fullName", event.target.value)} autoComplete="name" maxLength={160} required />
              </Field>
              <Field label="Телефон" htmlFor="lead-add-phone">
                <Input id="lead-add-phone" value={draft.phone} onChange={(event) => updateIdentity("phone", event.target.value)} type="tel" autoComplete="tel" placeholder="+998 90 000 00 00" maxLength={40} aria-invalid={Boolean(contactError)} aria-describedby={contactError ? "lead-add-contact-error" : undefined} />
              </Field>
              <Field label="Email" htmlFor="lead-add-email">
                <Input id="lead-add-email" value={draft.email} onChange={(event) => updateIdentity("email", event.target.value)} type="email" autoComplete="email" maxLength={254} aria-invalid={Boolean(contactError)} aria-describedby={contactError ? "lead-add-contact-error" : undefined} />
              </Field>
              {contactError ? <p id="lead-add-contact-error" role="alert" className="text-xs text-destructive sm:col-span-2">{contactError}</p> : null}
              <Field label="Источник" htmlFor="lead-add-source">
                <Select value={draft.sourceKey} onValueChange={(value) => setDraft((current) => ({ ...current, sourceKey: String(value ?? defaultSource) }))}>
                  <SelectTrigger id="lead-add-source"><SelectValue>{data.sources.find((source) => source.key === draft.sourceKey)?.name ?? "Вручную"}</SelectValue></SelectTrigger>
                  <SelectContent>{data.sources.map((source) => <SelectItem key={source.id} value={source.key}>{source.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Ответственный" htmlFor="lead-add-assignee">
                {canAssign ? (
                  <Select value={draft.assigneeStaffId} onValueChange={(value) => setDraft((current) => ({ ...current, assigneeStaffId: String(value ?? "unassigned") }))}>
                    <SelectTrigger id="lead-add-assignee"><SelectValue>{draft.assigneeStaffId === "unassigned" ? "Не назначен" : data.staff.find((staff) => staff.id === draft.assigneeStaffId)?.name}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Не назначен</SelectItem>
                      {data.staff.map((staff) => <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <div id="lead-add-assignee" className="flex h-11 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm text-foreground">
                    {data.staff.find((staff) => staff.id === data.currentStaffId)?.name ?? "Текущий сотрудник"}
                  </div>
                )}
              </Field>
              <Field label="Потенциальная сумма" htmlFor="lead-add-value">
                <Input id="lead-add-value" value={draft.estimatedValue} onChange={(event) => setDraft((current) => ({ ...current, estimatedValue: event.target.value }))} type="number" min="0" step="1000" inputMode="decimal" />
              </Field>
            </div>
            <Field label="Интерес" htmlFor="lead-add-interest">
              <Input id="lead-add-interest" value={draft.interest} onChange={(event) => setDraft((current) => ({ ...current, interest: event.target.value }))} placeholder="Например, годовой абонемент" maxLength={300} />
            </Field>
            <Field label="Заметка" htmlFor="lead-add-notes">
              <Textarea id="lead-add-notes" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} maxLength={5000} />
            </Field>
            <p className="text-xs text-muted-foreground">Укажите хотя бы телефон или email. Перед созданием Zalkins проверит возможные дубли.</p>
          </form>
        </SheetBody>
        <SheetFooter className="h-auto flex-col-reverse items-stretch px-4 py-4 sm:flex-row sm:items-center sm:px-6">
          <SheetClose render={<Button type="button" variant="ghost" disabled={pending} />}>Отмена</SheetClose>
          <Button type="submit" form="add-lead-form" className="sm:ml-auto" disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Plus />}
            Добавить лида
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  htmlFor,
  required = false,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
        {label}{required ? <span className="text-destructive" aria-hidden> *</span> : null}
      </label>
      {children}
    </div>
  )
}

function LeadEmptyState({ filtered, canCreate, onClear }: { filtered: boolean; canCreate: boolean; onClear: () => void }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {filtered ? <UserRoundSearch className="size-6" /> : <UsersRound className="size-6" />}
      </span>
      <h2 className="mt-4 text-base font-semibold text-foreground">{filtered ? "Лиды не найдены" : "В очереди пока нет лидов"}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {filtered ? "Измените условия поиска или очистите фильтры." : canCreate ? "Добавьте первую заявку — она сразу появится в рабочей очереди." : "Новые заявки появятся здесь после подключения источника."}
      </p>
      {filtered ? <Button type="button" variant="outline" className="mt-4" onClick={onClear}>Сбросить фильтры</Button> : null}
    </div>
  )
}

function LeadMobileCard({
  lead,
  now,
  locale,
  timezone,
  money,
  onOpen,
}: {
  lead: LeadRow
  now: number
  locale: string
  timezone: string
  money: (value: number) => string
  onOpen: () => void
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Button type="button" variant="link" className="h-auto max-w-full justify-start p-0 text-left text-sm font-semibold text-foreground no-underline hover:no-underline" onClick={onOpen}>
            <span className="truncate">{lead.name}</span>
          </Button>
          <p className="mt-1 truncate text-xs text-muted-foreground">#{lead.leadNo} · {lead.phone || lead.email || lead.telegramUsername || "Контакт не указан"}</p>
        </div>
        <StageBadge stage={lead.stage} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-muted-foreground">Ответственный</p>
          <p className="mt-1 truncate font-medium text-foreground">{lead.assigneeName ?? "Не назначен"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Источник</p>
          <p className="mt-1 truncate font-medium text-foreground">{lead.source.name}</p>
        </div>
        <div className="col-span-2">
          <p className="text-muted-foreground">Следующее действие</p>
          <p className="mt-1 truncate font-medium text-foreground">
            {lead.nextAction ? `${lead.nextAction.title} · ${formatDateTime(lead.nextAction.dueAt, locale, timezone)}` : "Не назначено"}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <SlaBadge lead={lead} now={now} />
        <div className="flex items-center gap-2">
          {lead.estimatedValue > 0 ? <span className="text-xs font-medium tabular-nums text-foreground">{money(lead.estimatedValue)}</span> : null}
          <Button type="button" variant="ghost" size="icon" onClick={onOpen} aria-label={`Открыть лида ${lead.name}`}><ChevronRight /></Button>
        </div>
      </div>
    </article>
  )
}

export function LeadHub({
  data,
  query,
  nowIso,
  permissions,
}: {
  data: LeadHubData
  query: LeadHubQueryState
  nowIso: string
  permissions: LeadHubPermissions
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { locale, timezone, money } = useAppLocale()
  const [navigating, startNavigation] = useTransition()
  const [now, setNow] = useState(() => new Date(nowIso).getTime())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const updateUrl = useCallback((patch: UrlPatch, mode: "push" | "replace" = "replace") => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === undefined || value === "") params.delete(key)
      else params.set(key, String(value))
    }
    const next = params.size > 0 ? `${pathname}?${params.toString()}` : pathname
    startNavigation(() => {
      if (mode === "push") router.push(next, { scroll: false })
      else router.replace(next, { scroll: false })
    })
  }, [pathname, router, searchParams])

  const commitSearch = useCallback((value: string) => {
    if (value === query.search) return
    updateUrl({ q: value || null, page: null })
  }, [query.search, updateUrl])

  const openLead = useCallback((leadId: string) => updateUrl({ lead: leadId }, "push"), [updateUrl])
  const closeLead = useCallback(() => updateUrl({ lead: null }, "replace"), [updateUrl])

  const fullFilterCount = [
    query.stage,
    query.source,
    query.assignee,
    query.state !== "open" ? query.state : "",
    query.sort !== "updated_desc" ? query.sort : "",
  ].filter(Boolean).length
  const filtered = Boolean(query.search || query.quick !== "all" || fullFilterCount > 0)
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))

  const kpis = [
    {
      label: "Новые сегодня",
      value: data.summary.newToday.toLocaleString(localeTag(locale)),
      hint: "Показать новые первыми",
      icon: UserRoundPlus,
      active: query.sort === "created_desc" && query.state === "open",
      patch: { state: null, sort: "created_desc", quick: null, page: null },
    },
    {
      label: "Требуют действия",
      value: data.summary.needsAction.toLocaleString(localeTag(locale)),
      hint: "Просроченные ответы и задачи",
      icon: Clock3,
      active: query.quick === "overdue",
      patch: { state: null, quick: "overdue", page: null },
    },
    {
      label: "Пробные · 7 дней",
      value: data.summary.trialsNext7Days.toLocaleString(localeTag(locale)),
      hint: "Открыть назначенные пробные",
      icon: CalendarCheck2,
      active: query.stage === "trial_booked",
      patch: { state: null, stage: "trial_booked", quick: null, page: null },
    },
    {
      label: "Конверсия · 30 дней",
      value: `${data.summary.conversionRate30Days}%`,
      hint: `${data.summary.converted30Days} из ${data.summary.created30Days} лидов`,
      icon: CircleGauge,
      active: query.state === "won",
      patch: { state: "won", quick: null, stage: null, page: null },
    },
  ]

  function clearFilters() {
    updateUrl({ q: null, quick: null, stage: null, source: null, assignee: null, state: null, sort: null, page: null })
  }

  return (
    <div className="min-w-0 space-y-5" aria-busy={navigating}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.144px] text-foreground">Лиды</h1>
          <p className="mt-1 text-sm text-muted-foreground">Заявки, пробные занятия и продажи в одной рабочей очереди.</p>
        </div>
        {permissions.create ? <AddLeadSheet data={data} canAssign={permissions.assign} onCreated={openLead} onOpenLead={openLead} /> : null}
      </header>

      {permissions.readOnly ? (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3" role="status">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-sm font-medium text-foreground">Режим просмотра</p>
            <p className="mt-0.5 text-xs text-muted-foreground">При входе администратора платформы данные доступны для проверки, а действия с лидами отключены.</p>
          </div>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Показатели лидов">
        {kpis.map((item) => {
          const Icon = item.icon
          return (
            <Button
              key={item.label}
              type="button"
              variant="ghost"
              className={cn(
                "h-auto min-w-0 justify-start whitespace-normal rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/50",
                item.active && "border-brand/40 ring-2 ring-brand/10",
              )}
              onClick={() => updateUrl(item.patch)}
              aria-pressed={item.active}
              aria-label={`${item.label}: ${item.value}. ${item.hint}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block min-h-8 text-xs font-medium leading-4 text-muted-foreground sm:min-h-0" title={item.label}>{item.label}</span>
                <span className="mt-2 block text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{item.value}</span>
                <span className="mt-1 block min-h-8 text-[11px] font-normal leading-4 text-muted-foreground sm:min-h-0 sm:text-xs" title={item.hint}>{item.hint}</span>
              </span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></span>
            </Button>
          )
        })}
      </section>

      <Card className="min-w-0 gap-0 overflow-hidden py-0 ring-1 ring-border">
        <div className="border-b border-border p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-center">
            <SearchBox key={query.search} initialValue={query.search} pending={navigating} onCommit={commitSearch} />
            <div className="min-w-0 lg:shrink-0">
              <div className="grid w-full grid-cols-2 items-center gap-1 rounded-lg bg-muted p-1 sm:flex sm:w-max" role="group" aria-label="Быстрые фильтры">
                {QUICK_FILTERS.map((item) => (
                  <Button
                    key={item.key}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn("w-full sm:w-auto", query.quick === item.key && "bg-card text-foreground shadow-sm hover:bg-card")}
                    onClick={() => updateUrl({ quick: item.key === "all" ? null : item.key, page: null })}
                    aria-pressed={query.quick === item.key}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
            <FilterSheet data={data} query={query} activeCount={fullFilterCount} onApply={updateUrl} />
          </div>
        </div>

        {data.rows.length === 0 ? (
          <LeadEmptyState filtered={filtered || data.total > 0} canCreate={permissions.create} onClear={clearFilters} />
        ) : (
          <>
            <div className="space-y-3 p-3 2xl:hidden">
              {data.rows.map((lead) => (
                <LeadMobileCard key={lead.id} lead={lead} now={now} locale={locale} timezone={timezone} money={money} onOpen={() => openLead(lead.id)} />
              ))}
            </div>
            <div className="hidden min-w-0 2xl:block">
              <Table className="min-w-[1120px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Лид</TableHead>
                    <TableHead className="text-muted-foreground">Этап</TableHead>
                    <TableHead className="text-muted-foreground">Источник</TableHead>
                    <TableHead className="text-muted-foreground">Ответственный</TableHead>
                    <TableHead className="text-muted-foreground">Следующее действие</TableHead>
                    <TableHead className="text-muted-foreground">SLA</TableHead>
                    <TableHead className="text-right text-muted-foreground">Потенциал</TableHead>
                    <TableHead className="w-12"><span className="sr-only">Открыть</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((lead) => (
                    <TableRow key={lead.id} className="hover:bg-muted/50">
                      <TableCell className="max-w-64 text-foreground">
                        <Button type="button" variant="link" className="h-auto max-w-full justify-start p-0 text-left font-medium text-foreground no-underline hover:no-underline" onClick={() => openLead(lead.id)}>
                          <span className="truncate" title={lead.name}>{lead.name}</span>
                        </Button>
                        <p className="mt-1 truncate text-xs text-muted-foreground">#{lead.leadNo} · {lead.phone || lead.email || lead.telegramUsername || "Контакт не указан"}</p>
                      </TableCell>
                      <TableCell className="text-foreground"><StageBadge stage={lead.stage} /></TableCell>
                      <TableCell className="text-muted-foreground">{lead.source.name}</TableCell>
                      <TableCell className="max-w-48 truncate text-foreground" title={lead.assigneeName ?? "Не назначен"}>{lead.assigneeName ?? "Не назначен"}</TableCell>
                      <TableCell className="max-w-64 text-foreground">
                        {lead.nextAction ? (
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium" title={lead.nextAction.title}>{lead.nextAction.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(lead.nextAction.dueAt, locale, timezone)}</p>
                          </div>
                        ) : <span className="text-muted-foreground">Не назначено</span>}
                      </TableCell>
                      <TableCell className="text-foreground"><SlaBadge lead={lead} now={now} /></TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-foreground">{lead.estimatedValue > 0 ? money(lead.estimatedValue) : "—"}</TableCell>
                      <TableCell className="text-foreground">
                        <Button type="button" variant="ghost" size="icon" onClick={() => openLead(lead.id)} aria-label={`Открыть лида ${lead.name}`}><ChevronRight /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {data.total > 0 ? (
          <footer className="flex flex-col gap-3 border-t border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <p className="text-xs text-muted-foreground">
              Показано {data.rows.length > 0 ? data.page * data.pageSize + 1 : 0}–{data.rows.length > 0 ? Math.min((data.page + 1) * data.pageSize, data.total) : 0} из {data.total.toLocaleString(localeTag(locale))}
            </p>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Button type="button" variant="outline" size="sm" disabled={data.page <= 0 || navigating} onClick={() => updateUrl({ page: data.page - 1 || null })}>
                <ArrowLeft />Назад
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">{data.page + 1} / {totalPages}</span>
              <Button type="button" variant="outline" size="sm" disabled={data.page + 1 >= totalPages || navigating} onClick={() => updateUrl({ page: data.page + 1 })}>
                Вперёд<ArrowRight />
              </Button>
            </div>
          </footer>
        ) : null}
      </Card>

      {data.selected ? (
        <LeadDetailSheet
          key={data.selected.id}
          lead={data.selected}
          stages={data.stages}
          sources={data.sources}
          lossReasons={data.lossReasons}
          staff={data.staff}
          currentStaffId={data.currentStaffId}
          permissions={permissions}
          open
          onOpenChange={(next) => { if (!next) closeLead() }}
        />
      ) : null}

      <span className="sr-only" aria-live="polite">{navigating ? "Обновляем список лидов" : ""}</span>
    </div>
  )
}
