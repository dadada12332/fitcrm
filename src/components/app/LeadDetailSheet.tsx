"use client"

import type { FormEvent, ReactNode } from "react"
import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Activity,
  Archive,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  FilePenLine,
  FileText,
  LoaderCircle,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Plus,
  Save,
  Send,
  UserRound,
  UserRoundCheck,
  X,
} from "lucide-react"
import {
  archiveLeadAction,
  assignLeadAction,
  completeLeadTaskAction,
  convertLeadAction,
  createLeadTaskAction,
  markLeadTrialOutcomeAction,
  moveLeadStageAction,
  recordLeadActivityAction,
  scheduleLeadTrialAction,
  updateLeadAction,
  type LeadDuplicate,
} from "@/app/(app)/leads/actions"
import { useAppLocale } from "@/components/app/ClubContext"
import type { LeadHubPermissions } from "@/components/app/LeadHub"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  canMoveLeadStage,
  LEAD_TASK_LABELS,
  type LeadActivity,
  type LeadDetail,
  type LeadLossReasonOption,
  type LeadPriority,
  type LeadSourceOption,
  type LeadStaffOption,
  type LeadStageKey,
  type LeadStageOption,
  type LeadTaskType,
  type LeadTrial,
  type LeadTrialStatus,
} from "@/lib/leads"
import { dateTimeLocalToUtcIso, dateTimeLocalValueInTimeZone } from "@/lib/timezone"
import { toast } from "@/lib/use-action"

const PRIORITY_LABELS: Record<LeadPriority, string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
  urgent: "Срочный",
}

const CHANNEL_LABELS: Record<string, string> = {
  internal: "Внутренняя заметка",
  phone: "Телефон",
  telegram: "Telegram",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  email: "Email",
  web: "Сайт",
  in_person: "Личная встреча",
}

const PREFERRED_CHANNEL_LABELS: Record<string, string> = {
  phone: "Телефон",
  telegram: "Telegram",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  email: "Email",
  other: "Другое",
}

const OUTCOME_LABELS: Record<string, string> = {
  completed: "Выполнено",
  connected: "Связались",
  no_answer: "Не ответил",
  interested: "Заинтересован",
  not_interested: "Не заинтересован",
  scheduled: "Назначено",
  no_show: "Не пришёл",
  sent: "Отправлено",
  failed: "Ошибка",
  other: "Другое",
}

const TRIAL_STATUS_LABELS: Record<LeadTrialStatus, string> = {
  scheduled: "Назначено",
  attended: "Посетил",
  no_show: "Не пришёл",
  cancelled: "Отменено",
}

const SCROLLABLE_DIALOG_CLASS = "max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain"

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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date)
}

function defaultFutureInput(timeZone: string, hours = 24): string {
  const step = 15 * 60_000
  const rounded = new Date(Math.ceil((Date.now() + hours * 60 * 60 * 1000) / step) * step)
  return dateTimeLocalValueInTimeZone(rounded, timeZone)
}

function stageClass(tone: LeadStageOption["tone"]): string {
  if (tone === "brand") return "border-brand/30 bg-brand/10 text-brand"
  if (tone === "warning") return "border-chart-3/30 bg-chart-3/10 text-chart-3"
  if (tone === "success") return "border-chart-2/30 bg-chart-2/10 text-chart-2"
  if (tone === "destructive") return "border-destructive/30 bg-destructive/10 text-destructive"
  return "border-border bg-muted text-muted-foreground"
}

function Field({ label, htmlFor, children, required = false, hint }: { label: string; htmlFor: string; children: ReactNode; required?: boolean; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
        {label}{required ? <span className="text-destructive" aria-hidden> *</span> : null}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 line-clamp-2 break-words [overflow-wrap:anywhere] text-sm font-medium text-foreground" title={typeof value === "string" ? value : undefined}>{value || "—"}</dd>
    </div>
  )
}

type MutationResult = { ok: boolean; error?: string }

function EditLeadDialog({
  open,
  onOpenChange,
  lead,
  sources,
  pending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: LeadDetail
  sources: LeadSourceOption[]
  pending: boolean
  onSubmit: (input: {
    fullName: string
    phone: string
    email: string
    sourceKey: string
    interest: string
    estimatedValue: number
    notes: string
    tags: string[]
    priority: LeadPriority
    preferredChannel: string | null
  }) => void
}) {
  const [fullName, setFullName] = useState(lead.name)
  const [phone, setPhone] = useState(lead.phone ?? "")
  const [email, setEmail] = useState(lead.email ?? "")
  const [sourceKey, setSourceKey] = useState(lead.source.key)
  const [interest, setInterest] = useState(lead.interest ?? "")
  const [estimatedValue, setEstimatedValue] = useState(String(lead.estimatedValue || ""))
  const [notes, setNotes] = useState(lead.notes ?? "")
  const [tags, setTags] = useState(lead.tags.join(", "))
  const [priority, setPriority] = useState<LeadPriority>(lead.priority)
  const [preferredChannel, setPreferredChannel] = useState(
    lead.preferredChannel && lead.preferredChannel in PREFERRED_CHANNEL_LABELS ? lead.preferredChannel : "none",
  )

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({
      fullName,
      phone,
      email,
      sourceKey,
      interest,
      estimatedValue: Number(estimatedValue || 0),
      notes,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      priority,
      preferredChannel: preferredChannel === "none" ? null : preferredChannel,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${SCROLLABLE_DIALOG_CLASS} max-w-2xl`}>
        <DialogHeader>
          <DialogTitle>Редактировать лида</DialogTitle>
          <DialogDescription>Обновите контакт, интерес и данные квалификации.</DialogDescription>
        </DialogHeader>
        <form id="lead-edit-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Имя" htmlFor="lead-edit-name" required><Input id="lead-edit-name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={160} required /></Field>
          <Field label="Телефон" htmlFor="lead-edit-phone"><Input id="lead-edit-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} /></Field>
          <Field label="Email" htmlFor="lead-edit-email"><Input id="lead-edit-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} /></Field>
          <Field label="Источник" htmlFor="lead-edit-source">
            <Select value={sourceKey} onValueChange={(value) => setSourceKey(String(value ?? lead.source.key))}>
              <SelectTrigger id="lead-edit-source"><SelectValue>{sources.find((source) => source.key === sourceKey)?.name}</SelectValue></SelectTrigger>
              <SelectContent>{sources.map((source) => <SelectItem key={source.id} value={source.key}>{source.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Приоритет" htmlFor="lead-edit-priority">
            <Select value={priority} onValueChange={(value) => setPriority((value ?? "normal") as LeadPriority)}>
              <SelectTrigger id="lead-edit-priority"><SelectValue>{PRIORITY_LABELS[priority]}</SelectValue></SelectTrigger>
              <SelectContent>{(Object.keys(PRIORITY_LABELS) as LeadPriority[]).map((item) => <SelectItem key={item} value={item}>{PRIORITY_LABELS[item]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Предпочтительный канал" htmlFor="lead-edit-channel">
            <Select value={preferredChannel} onValueChange={(value) => setPreferredChannel(String(value ?? "none"))}>
              <SelectTrigger id="lead-edit-channel"><SelectValue>{preferredChannel === "none" ? "Не указан" : PREFERRED_CHANNEL_LABELS[preferredChannel]}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не указан</SelectItem>
                {Object.entries(PREFERRED_CHANNEL_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Интерес" htmlFor="lead-edit-interest"><Input id="lead-edit-interest" value={interest} onChange={(event) => setInterest(event.target.value)} maxLength={300} /></Field>
          <Field label="Потенциальная сумма" htmlFor="lead-edit-value"><Input id="lead-edit-value" type="number" min="0" step="1000" value={estimatedValue} onChange={(event) => setEstimatedValue(event.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Теги" htmlFor="lead-edit-tags" hint="Разделяйте теги запятыми"><Input id="lead-edit-tags" value={tags} onChange={(event) => setTags(event.target.value)} maxLength={800} /></Field></div>
          <div className="sm:col-span-2"><Field label="Заметки" htmlFor="lead-edit-notes"><Textarea id="lead-edit-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5000} /></Field></div>
        </form>
        <DialogFooter className="flex-col-reverse sm:flex-row">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Отмена</Button>
          <Button type="submit" form="lead-edit-form" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <Save />}Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LossDialog({ open, onOpenChange, reasons, pending, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; reasons: LeadLossReasonOption[]; pending: boolean; onSubmit: (reasonKey: string, note: string) => void }) {
  const [reasonKey, setReasonKey] = useState(reasons[0]?.key ?? "")
  const [note, setNote] = useState("")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SCROLLABLE_DIALOG_CLASS}>
        <DialogHeader><DialogTitle>Закрыть лид как потерянный?</DialogTitle><DialogDescription>Причина сохранится в аналитике. Лид можно будет вернуть в работу позже.</DialogDescription></DialogHeader>
        <form id="lead-loss-form" className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(reasonKey, note) }}>
          <Field label="Причина" htmlFor="lead-loss-reason" required>
            <Select value={reasonKey} onValueChange={(value) => setReasonKey(String(value ?? ""))}>
              <SelectTrigger id="lead-loss-reason"><SelectValue>{reasons.find((reason) => reason.key === reasonKey)?.name ?? "Выберите причину"}</SelectValue></SelectTrigger>
              <SelectContent>{reasons.map((reason) => <SelectItem key={reason.id} value={reason.key}>{reason.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Комментарий" htmlFor="lead-loss-note"><Textarea id="lead-loss-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Что повлияло на решение" /></Field>
        </form>
        <DialogFooter className="flex-col-reverse sm:flex-row">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Отмена</Button>
          <Button type="submit" form="lead-loss-form" variant="destructive" disabled={pending || !reasonKey}>{pending ? <LoaderCircle className="animate-spin" /> : <X />}Закрыть лид</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TaskDialog({ open, onOpenChange, staff, currentStaffId, canAssign, timezone, pending, initialFollowUp, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; staff: LeadStaffOption[]; currentStaffId: string | null; canAssign: boolean; timezone: string; pending: boolean; initialFollowUp: boolean; onSubmit: (input: { type: LeadTaskType; title: string; note: string; dueAt: string; assignedStaffId: string | null; priority: LeadPriority }) => void }) {
  const [type, setType] = useState<LeadTaskType>(initialFollowUp ? "follow_up" : "call")
  const [title, setTitle] = useState(initialFollowUp ? "Повторный контакт" : "Позвонить лиду")
  const [note, setNote] = useState("")
  const [dueAt, setDueAt] = useState(() => defaultFutureInput(timezone, initialFollowUp ? 24 : 2))
  const [assignedStaffId, setAssignedStaffId] = useState(currentStaffId ?? "unassigned")
  const [priority, setPriority] = useState<LeadPriority>("normal")

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const resolvedAssignedStaffId = canAssign
      ? assignedStaffId === "unassigned" ? null : assignedStaffId
      : currentStaffId

    onSubmit({
      type,
      title,
      note,
      dueAt,
      assignedStaffId: resolvedAssignedStaffId,
      priority,
    })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SCROLLABLE_DIALOG_CLASS}>
        <DialogHeader><DialogTitle>{initialFollowUp ? "Назначить повторный контакт" : "Следующее действие"}</DialogTitle><DialogDescription>Открытая задача попадёт в SLA-очередь ответственного.</DialogDescription></DialogHeader>
        <form id="lead-task-form" onSubmit={submit} className="space-y-4">
          <Field label="Тип" htmlFor="lead-task-type">
            <Select value={type} onValueChange={(value) => setType((value ?? "call") as LeadTaskType)}>
              <SelectTrigger id="lead-task-type"><SelectValue>{LEAD_TASK_LABELS[type]}</SelectValue></SelectTrigger>
              <SelectContent>{(Object.keys(LEAD_TASK_LABELS) as LeadTaskType[]).map((item) => <SelectItem key={item} value={item}>{LEAD_TASK_LABELS[item]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Название" htmlFor="lead-task-title" required><Input id="lead-task-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required /></Field>
          <Field label="Срок" htmlFor="lead-task-due" required><Input id="lead-task-due" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required /></Field>
          {canAssign ? (
            <Field label="Ответственный" htmlFor="lead-task-assignee">
              <Select value={assignedStaffId} onValueChange={(value) => setAssignedStaffId(String(value ?? "unassigned"))}>
                <SelectTrigger id="lead-task-assignee"><SelectValue>{assignedStaffId === "unassigned" ? "Текущий сотрудник" : staff.find((item) => item.id === assignedStaffId)?.name}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="unassigned">Текущий сотрудник</SelectItem>{staff.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Ответственный</p>
              <div className="flex min-h-11 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm text-foreground">
                {staff.find((item) => item.id === currentStaffId)?.name ?? "Текущий сотрудник"}
              </div>
            </div>
          )}
          <Field label="Приоритет" htmlFor="lead-task-priority">
            <Select value={priority} onValueChange={(value) => setPriority((value ?? "normal") as LeadPriority)}>
              <SelectTrigger id="lead-task-priority"><SelectValue>{PRIORITY_LABELS[priority]}</SelectValue></SelectTrigger>
              <SelectContent>{(Object.keys(PRIORITY_LABELS) as LeadPriority[]).map((item) => <SelectItem key={item} value={item}>{PRIORITY_LABELS[item]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Комментарий" htmlFor="lead-task-note"><Textarea id="lead-task-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} /></Field>
        </form>
        <DialogFooter className="flex-col-reverse sm:flex-row"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Отмена</Button><Button type="submit" form="lead-task-form" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <CalendarClock />}Назначить</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CompleteTaskDialog({ open, onOpenChange, pending, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; pending: boolean; onSubmit: (outcome: string, note: string) => void }) {
  const [outcome, setOutcome] = useState("completed")
  const [note, setNote] = useState("")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SCROLLABLE_DIALOG_CLASS}>
        <DialogHeader><DialogTitle>Завершить действие</DialogTitle><DialogDescription>Зафиксируйте результат контакта. Для «Не ответил» сразу предложим повторную задачу.</DialogDescription></DialogHeader>
        <form id="lead-complete-task-form" className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(outcome, note) }}>
          <Field label="Результат" htmlFor="lead-task-outcome">
            <Select value={outcome} onValueChange={(value) => setOutcome(String(value ?? "completed"))}>
              <SelectTrigger id="lead-task-outcome"><SelectValue>{OUTCOME_LABELS[outcome]}</SelectValue></SelectTrigger>
              <SelectContent>{["completed", "connected", "no_answer", "interested", "not_interested", "sent", "other"].map((item) => <SelectItem key={item} value={item}>{OUTCOME_LABELS[item]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Комментарий" htmlFor="lead-task-result-note"><Textarea id="lead-task-result-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} /></Field>
        </form>
        <DialogFooter className="flex-col-reverse sm:flex-row"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Отмена</Button><Button type="submit" form="lead-complete-task-form" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <Check />}Завершить</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ActivityDialog({ open, onOpenChange, pending, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; pending: boolean; onSubmit: (input: { kind: string; channel: string | null; direction: string | null; outcome: string | null; body: string }) => void }) {
  const [kind, setKind] = useState("note")
  const [channel, setChannel] = useState("internal")
  const [outcome, setOutcome] = useState("none")
  const [body, setBody] = useState("")
  const isNote = kind === "note"
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SCROLLABLE_DIALOG_CLASS}>
        <DialogHeader><DialogTitle>Добавить активность</DialogTitle><DialogDescription>Запишите заметку, звонок, сообщение или встречу в единую историю лида.</DialogDescription></DialogHeader>
        <form id="lead-activity-form" className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit({ kind, channel: isNote ? "internal" : channel, direction: isNote ? "internal" : "outbound", outcome: outcome === "none" ? null : outcome, body }) }}>
          <Field label="Тип" htmlFor="lead-activity-kind">
            <Select value={kind} onValueChange={(value) => {
              const next = String(value ?? "note")
              setKind(next)
              if (next === "note") setChannel("internal")
              else if (channel === "internal") setChannel(next === "meeting" ? "in_person" : next === "message" ? "telegram" : "phone")
            }}>
              <SelectTrigger id="lead-activity-kind"><SelectValue>{kind === "note" ? "Заметка" : kind === "call" ? "Звонок" : kind === "message" ? "Сообщение" : "Встреча"}</SelectValue></SelectTrigger>
              <SelectContent><SelectItem value="note">Заметка</SelectItem><SelectItem value="call">Звонок</SelectItem><SelectItem value="message">Сообщение</SelectItem><SelectItem value="meeting">Встреча</SelectItem></SelectContent>
            </Select>
          </Field>
          {!isNote ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Канал" htmlFor="lead-activity-channel">
                <Select value={channel} onValueChange={(value) => setChannel(String(value ?? "phone"))}>
                  <SelectTrigger id="lead-activity-channel"><SelectValue>{CHANNEL_LABELS[channel]}</SelectValue></SelectTrigger>
                  <SelectContent>{Object.entries(CHANNEL_LABELS).filter(([key]) => key !== "internal").map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Результат" htmlFor="lead-activity-outcome">
                <Select value={outcome} onValueChange={(value) => setOutcome(String(value ?? "none"))}>
                  <SelectTrigger id="lead-activity-outcome"><SelectValue>{outcome === "none" ? "Не указан" : OUTCOME_LABELS[outcome]}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="none">Не указан</SelectItem>{["connected", "no_answer", "interested", "not_interested", "scheduled", "sent", "failed", "other"].map((item) => <SelectItem key={item} value={item}>{OUTCOME_LABELS[item]}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
          ) : null}
          <Field label={isNote ? "Заметка" : "Комментарий"} htmlFor="lead-activity-body" required={isNote}><Textarea id="lead-activity-body" value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} required={isNote} /></Field>
        </form>
        <DialogFooter className="flex-col-reverse sm:flex-row"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Отмена</Button><Button type="submit" form="lead-activity-form" disabled={pending || (isNote && !body.trim())}>{pending ? <LoaderCircle className="animate-spin" /> : <Plus />}Добавить</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TrialDialog({ open, onOpenChange, staff, currentStaffId, canAssign, timezone, pending, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; staff: LeadStaffOption[]; currentStaffId: string | null; canAssign: boolean; timezone: string; pending: boolean; onSubmit: (input: { title: string; scheduledAt: string; durationMinutes: number; trainerStaffId: string | null; notes: string }) => void }) {
  const [title, setTitle] = useState("Пробное занятие")
  const [scheduledAt, setScheduledAt] = useState(() => defaultFutureInput(timezone, 24))
  const [duration, setDuration] = useState("60")
  const [trainer, setTrainer] = useState("none")
  const [notes, setNotes] = useState("")
  const availableTrainers = canAssign ? staff : staff.filter((item) => item.id === currentStaffId)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SCROLLABLE_DIALOG_CLASS}>
        <DialogHeader><DialogTitle>Назначить пробное</DialogTitle><DialogDescription>Пробное появится в карточке лида и в очереди контроля.</DialogDescription></DialogHeader>
        <form id="lead-trial-form" className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit({ title, scheduledAt, durationMinutes: Number(duration), trainerStaffId: trainer === "none" ? null : trainer, notes }) }}>
          <Field label="Название" htmlFor="lead-trial-title" required><Input id="lead-trial-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Дата и время" htmlFor="lead-trial-date" required><Input id="lead-trial-date" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required /></Field>
            <Field label="Длительность, мин" htmlFor="lead-trial-duration"><Input id="lead-trial-duration" type="number" min="15" max="480" step="15" value={duration} onChange={(event) => setDuration(event.target.value)} /></Field>
          </div>
          <Field label="Тренер" htmlFor="lead-trial-trainer">
            <Select value={trainer} onValueChange={(value) => setTrainer(String(value ?? "none"))}>
              <SelectTrigger id="lead-trial-trainer"><SelectValue>{trainer === "none" ? "Не назначен" : staff.find((item) => item.id === trainer)?.name}</SelectValue></SelectTrigger>
              <SelectContent><SelectItem value="none">Не назначен</SelectItem>{availableTrainers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Комментарий" htmlFor="lead-trial-notes"><Textarea id="lead-trial-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} /></Field>
        </form>
        <DialogFooter className="flex-col-reverse sm:flex-row"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Отмена</Button><Button type="submit" form="lead-trial-form" disabled={pending || !title.trim() || !scheduledAt}>{pending ? <LoaderCircle className="animate-spin" /> : <CalendarClock />}Назначить</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConversionDialog({ open, onOpenChange, lead, pending, duplicates, error, clientsView, onConvert }: { open: boolean; onOpenChange: (open: boolean) => void; lead: LeadDetail; pending: boolean; duplicates: LeadDuplicate[]; error: string | null; clientsView: boolean; onConvert: (clientId?: string) => void }) {
  const clientDuplicates = duplicates.filter((item) => item.type === "client")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SCROLLABLE_DIALOG_CLASS}>
        <DialogHeader><DialogTitle>Конвертировать в клиента</DialogTitle><DialogDescription>Контакт и источник сохранятся, лид перейдёт в завершённый этап. Операция защищена от повторного создания.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-sm font-medium text-foreground">{lead.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{lead.phone || lead.email || "Контакт не указан"} · {lead.source.name}</p>
          </div>
          {error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
          {clientDuplicates.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Найдены существующие клиенты</p>
              {clientDuplicates.map((client) => (
                <div key={client.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{client.name}</p><p className="truncate text-xs text-muted-foreground">{client.phone || client.email || "Контакт совпадает"}</p></div>
                  <Button type="button" size="sm" onClick={() => onConvert(client.id)} disabled={pending || !clientsView}>Связать</Button>
                </div>
              ))}
              {!clientsView ? <p className="text-xs text-muted-foreground">Для связывания нужен доступ к клиентам.</p> : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Будет создан новый клиент. Абонемент и оплату можно оформить в его профиле.</p>
          )}
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Отмена</Button>{clientDuplicates.length === 0 ? <Button type="button" onClick={() => onConvert()} disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <UserRoundCheck />}Создать клиента</Button> : null}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ArchiveDialog({ open, onOpenChange, pending, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; pending: boolean; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SCROLLABLE_DIALOG_CLASS}>
        <DialogHeader><DialogTitle>Переместить лид в архив?</DialogTitle><DialogDescription>Карточка исчезнет из рабочих списков. История останется в базе клуба.</DialogDescription></DialogHeader>
        <form id="lead-archive-form" onSubmit={(event) => { event.preventDefault(); onSubmit(reason) }}><Field label="Причина" htmlFor="lead-archive-reason"><Textarea id="lead-archive-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} /></Field></form>
        <DialogFooter className="flex-col-reverse sm:flex-row"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Отмена</Button><Button type="submit" form="lead-archive-form" variant="destructive" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <Archive />}В архив</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ActivityItem({ item, locale, timezone }: { item: LeadActivity; locale: string; timezone: string }) {
  const Icon = item.kind === "note" ? FileText : item.kind === "message" ? MessageSquare : item.kind === "call" ? Phone : Activity
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0 [&:last-child_.timeline-line]:hidden">
      <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground"><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium text-foreground">{item.kind === "note" ? "Заметка" : item.kind === "call" ? "Звонок" : item.kind === "message" ? "Сообщение" : item.kind === "meeting" ? "Встреча" : "Событие"}</p>
          {item.outcome ? <Badge variant="secondary">{OUTCOME_LABELS[item.outcome] ?? item.outcome}</Badge> : null}
        </div>
        {item.body ? <p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-5 text-muted-foreground">{item.body}</p> : null}
        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.occurredAt, locale, timezone)}{item.actorName ? ` · ${item.actorName}` : ""}</p>
      </div>
      <span className="timeline-line absolute left-4 top-8 h-[calc(100%-1rem)] w-px bg-border" aria-hidden />
    </li>
  )
}

function TrialCard({ trial, locale, timezone, canEdit, pending, onOutcome }: { trial: LeadTrial; locale: string; timezone: string; canEdit: boolean; pending: boolean; onOutcome: (status: LeadTrialStatus) => void }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{trial.title}</p><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(trial.scheduledAt, locale, timezone)} · {trial.durationMinutes} мин</p></div><Badge variant={trial.status === "no_show" || trial.status === "cancelled" ? "destructive" : "secondary"}>{TRIAL_STATUS_LABELS[trial.status]}</Badge></div>
      {trial.trainerName || trial.notes ? <p className="mt-2 break-words [overflow-wrap:anywhere] text-xs text-muted-foreground">{[trial.trainerName, trial.notes].filter(Boolean).join(" · ")}</p> : null}
      {canEdit && trial.status === "scheduled" ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          <Button type="button" size="sm" onClick={() => onOutcome("attended")} disabled={pending}><Check />Посетил</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onOutcome("no_show")} disabled={pending}>Не пришёл</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onOutcome("cancelled")} disabled={pending}>Отменить</Button>
        </div>
      ) : null}
    </div>
  )
}

export function LeadDetailSheet({
  open,
  onOpenChange,
  lead,
  stages,
  sources,
  lossReasons,
  staff,
  currentStaffId,
  permissions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: LeadDetail
  stages: LeadStageOption[]
  sources: LeadSourceOption[]
  lossReasons: LeadLossReasonOption[]
  staff: LeadStaffOption[]
  currentStaffId: string | null
  permissions: LeadHubPermissions
}) {
  const router = useRouter()
  const { locale, timezone, money } = useAppLocale()
  const [syncedLeadVersion, setSyncedLeadVersion] = useState(lead.version)
  const [version, setVersion] = useState(lead.version)
  const [assignee, setAssignee] = useState(lead.assigneeId ?? "unassigned")
  const [stageKey, setStageKey] = useState<LeadStageKey>(lead.stage.key)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [lossOpen, setLossOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [followUp, setFollowUp] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [trialOpen, setTrialOpen] = useState(false)
  const [conversionOpen, setConversionOpen] = useState(false)
  const [conversionDuplicates, setConversionDuplicates] = useState<LeadDuplicate[]>([])
  const [conversionError, setConversionError] = useState<string | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const immutable = Boolean(lead.archivedAt) || lead.state === "won"
  const canEdit = permissions.edit && !immutable

  if (syncedLeadVersion !== lead.version) {
    setSyncedLeadVersion(lead.version)
    setVersion(lead.version)
    setAssignee(lead.assigneeId ?? "unassigned")
    setStageKey(lead.stage.key)
  }

  function fail(message: string) {
    setError(message)
    toast.error(message)
  }

  function execute<T extends MutationResult>(factory: () => Promise<T>, success: string, onSuccess?: (result: T) => void, onError?: () => void) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await factory()
        if (!result.ok) {
          if (result.error === "Лид уже изменился. Обновите данные и повторите действие.") {
            router.refresh()
          }
          onError?.()
          fail(result.error ?? "Не удалось сохранить изменения.")
          return
        }
        if ("version" in result && typeof result.version === "number") setVersion(result.version)
        toast.success(success)
        onSuccess?.(result)
      } catch {
        onError?.()
        fail("Не удалось сохранить изменения. Попробуйте ещё раз.")
      }
    })
  }

  function changeAssignee(next: string) {
    const previous = assignee
    setAssignee(next)
    execute(
      () => assignLeadAction({ leadId: lead.id, assigneeStaffId: next === "unassigned" ? null : next, expectedVersion: version }),
      "Ответственный изменён",
      undefined,
      () => setAssignee(previous),
    )
  }

  function changeStage(next: LeadStageKey) {
    if (next === "lost") {
      setLossOpen(true)
      return
    }
    const previous = stageKey
    setStageKey(next)
    execute(
      () => moveLeadStageAction({ leadId: lead.id, stageKey: next, expectedVersion: version }),
      "Этап обновлён",
      undefined,
      () => setStageKey(previous),
    )
  }

  function submitLoss(reasonKey: string, note: string) {
    execute(
      () => moveLeadStageAction({ leadId: lead.id, stageKey: "lost", lossReasonKey: reasonKey, lossNote: note, expectedVersion: version }),
      "Лид закрыт как потерянный",
      () => { setStageKey("lost"); setLossOpen(false) },
    )
  }

  function submitTask(input: { type: LeadTaskType; title: string; note: string; dueAt: string; assignedStaffId: string | null; priority: LeadPriority }) {
    const dueAt = dateTimeLocalToUtcIso(input.dueAt, timezone)
    if (!dueAt) {
      fail("Проверьте дату и время следующего действия.")
      return
    }
    execute(
      () => createLeadTaskAction({ leadId: lead.id, ...input, dueAt }),
      "Следующее действие назначено",
      () => { setTaskOpen(false); setFollowUp(false) },
    )
  }

  function completeTask(outcome: string, note: string) {
    const nextAction = lead.nextAction
    if (!nextAction || nextAction.origin !== "task") return
    execute(
      () => completeLeadTaskAction({ leadId: lead.id, taskId: nextAction.id, outcome, note }),
      "Действие завершено",
      () => {
        setCompleteOpen(false)
        if (outcome === "no_answer") {
          setFollowUp(true)
          setTaskOpen(true)
        }
      },
    )
  }

  function submitActivity(input: { kind: string; channel: string | null; direction: string | null; outcome: string | null; body: string }) {
    execute(
      () => recordLeadActivityAction({ leadId: lead.id, ...input }),
      "Активность добавлена",
      () => setActivityOpen(false),
    )
  }

  function submitTrial(input: { title: string; scheduledAt: string; durationMinutes: number; trainerStaffId: string | null; notes: string }) {
    const scheduledAt = dateTimeLocalToUtcIso(input.scheduledAt, timezone)
    if (!scheduledAt) {
      fail("Проверьте дату и время пробного занятия.")
      return
    }
    execute(
      () => scheduleLeadTrialAction({ leadId: lead.id, ...input, scheduledAt }),
      "Пробное занятие назначено",
      () => setTrialOpen(false),
    )
  }

  function markTrial(trialId: string, status: LeadTrialStatus) {
    execute(
      () => markLeadTrialOutcomeAction({ leadId: lead.id, trialId, status }),
      status === "attended" ? "Посещение подтверждено" : "Результат пробного сохранён",
    )
  }

  function convert(existingClientId?: string) {
    setConversionError(null)
    startTransition(async () => {
      try {
        const result = await convertLeadAction({ leadId: lead.id, existingClientId })
        if (!result.ok) {
          setConversionError(result.error)
          if (result.code === "duplicate") setConversionDuplicates(result.duplicates ?? [])
          return
        }
        toast.success(result.mode === "existing_client" ? "Лид связан с клиентом" : "Клиент создан")
        setConversionOpen(false)
        router.push(`/clients/${result.clientId}`)
      } catch {
        setConversionError("Не удалось конвертировать лида. Попробуйте ещё раз.")
      }
    })
  }

  function archive(reason: string) {
    execute(
      () => archiveLeadAction({ leadId: lead.id, expectedVersion: version, reason }),
      "Лид перемещён в архив",
      () => { setArchiveOpen(false); onOpenChange(false) },
    )
  }

  const selectedStage = stages.find((stage) => stage.key === stageKey) ?? lead.stage
  const lossReason = lossReasons.find((reason) => reason.id === lead.lossReasonId)
  const trialsSectionId = `lead-trials-${lead.id}`

  function focusTrials() {
    const trialsSection = document.getElementById(trialsSectionId)
    trialsSection?.scrollIntoView({ behavior: "smooth", block: "start" })
    trialsSection?.focus({ preventScroll: true })
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="max-w-[680px]" aria-describedby="lead-detail-description">
          <SheetHeader className="h-auto min-h-20 gap-3 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-foreground">{lead.name.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <SheetTitle className="truncate">{lead.name}</SheetTitle>
                  <Badge variant="outline" className={stageClass(selectedStage.tone)}>{selectedStage.name}</Badge>
                </div>
                <p id="lead-detail-description" className="mt-0.5 truncate text-xs text-muted-foreground">Лид #{lead.leadNo} · создан {formatDateTime(lead.createdAt, locale, timezone)}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {permissions.archive && lead.state === "lost" && !lead.archivedAt ? (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" aria-label="Действия с лидом" />}><MoreHorizontal /></DropdownMenuTrigger>
                  <DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onClick={() => setArchiveOpen(true)}><Archive />В архив</DropdownMenuItem></DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <SheetClose render={<Button type="button" variant="ghost" size="icon" aria-label="Закрыть карточку" />}><X /></SheetClose>
            </div>
          </SheetHeader>

          <SheetBody className="space-y-5 px-4 sm:px-6">
            {error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}

            <div className="flex flex-wrap gap-2">
              {lead.phone ? <Button type="button" variant="outline" nativeButton={false} render={<a href={`tel:${lead.phone}`} />}><Phone />Позвонить</Button> : null}
              {lead.email ? <Button type="button" variant="outline" nativeButton={false} render={<a href={`mailto:${lead.email}`} />}><Mail />Email</Button> : null}
              {lead.telegramUsername ? <Button type="button" variant="outline" nativeButton={false} render={<a href={`https://t.me/${encodeURIComponent(lead.telegramUsername.replace(/^@/, ""))}`} target="_blank" rel="noreferrer" />}><Send />Telegram</Button> : null}
              {canEdit ? <Button type="button" variant="outline" onClick={() => setActivityOpen(true)}><Activity />Активность</Button> : null}
              {canEdit ? <Button type="button" variant="ghost" onClick={() => setEditOpen(true)}><FilePenLine />Редактировать</Button> : null}
              {permissions.convert && permissions.clientsCreate && lead.state === "open" ? <Button type="button" className="sm:ml-auto" onClick={() => { setConversionDuplicates([]); setConversionError(null); setConversionOpen(true) }}><UserRoundCheck />Конвертировать</Button> : null}
              {lead.convertedClientId && permissions.clientsView ? <Button type="button" className="sm:ml-auto" nativeButton={false} render={<Link href={`/clients/${lead.convertedClientId}`} />}><UserRound />Открыть клиента</Button> : null}
            </div>

            <Card className="gap-0 py-0 ring-1 ring-border">
              <CardContent className="p-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                  <Fact label="Источник" value={lead.source.name} />
                  <Fact label="Интерес" value={lead.interest ?? "Не указан"} />
                  <Fact label="Потенциал" value={lead.estimatedValue > 0 ? money(lead.estimatedValue) : "Не указан"} />
                  <Fact label="Приоритет" value={PRIORITY_LABELS[lead.priority]} />
                  <Fact label="Канал" value={lead.preferredChannel ? PREFERRED_CHANNEL_LABELS[lead.preferredChannel] ?? lead.preferredChannel : "Не указан"} />
                  <Fact label="Последняя активность" value={formatDateTime(lead.lastActivityAt, locale, timezone)} />
                </dl>
                {lead.tags.length > 0 ? <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-4">{lead.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div> : null}
              </CardContent>
            </Card>

            <section className="grid gap-3 sm:grid-cols-2" aria-label="Управление лидом">
              <Field label="Этап" htmlFor="lead-stage-select">
                {canEdit ? (
                  <Select value={stageKey} onValueChange={(value) => changeStage((value ?? stageKey) as LeadStageKey)} disabled={pending}>
                    <SelectTrigger id="lead-stage-select"><SelectValue>{selectedStage.name}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {stages.filter((stage) => stage.key === stageKey || canMoveLeadStage(stageKey, stage.key)).map((stage) => <SelectItem key={stage.id} value={stage.key}>{stage.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : <div className="flex h-11 items-center rounded-lg border border-border bg-muted/40 px-3"><Badge variant="outline" className={stageClass(selectedStage.tone)}>{selectedStage.name}</Badge></div>}
              </Field>
              <Field label="Ответственный" htmlFor="lead-assignee-select">
                {permissions.assign && !immutable ? (
                  <Select value={assignee} onValueChange={(value) => changeAssignee(String(value ?? "unassigned"))} disabled={pending}>
                    <SelectTrigger id="lead-assignee-select"><SelectValue>{assignee === "unassigned" ? "Не назначен" : staff.find((item) => item.id === assignee)?.name}</SelectValue></SelectTrigger>
                    <SelectContent><SelectItem value="unassigned">Не назначен</SelectItem>{staff.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <div className="flex h-11 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm text-foreground">{lead.assigneeName ?? "Не назначен"}</div>}
              </Field>
            </section>

            {lead.state === "lost" ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                <p className="text-sm font-medium text-destructive">Причина потери: {lossReason?.name ?? "Не указана"}</p>
                {lead.lossNote ? <p className="mt-1 break-words [overflow-wrap:anywhere] text-sm text-muted-foreground">{lead.lossNote}</p> : null}
              </div>
            ) : null}

            <Card className="gap-0 py-0 ring-1 ring-border">
              <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border p-4">
                <div><CardTitle>Следующее действие</CardTitle><p className="mt-1 text-xs text-muted-foreground">Ближайшая задача или пробное определяет рабочий SLA.</p></div>
                {canEdit && !lead.nextAction ? <Button type="button" size="sm" onClick={() => { setFollowUp(false); setTaskOpen(true) }}><Plus />Назначить</Button> : null}
              </CardHeader>
              <CardContent className="p-4">
                {lead.nextAction ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-medium text-foreground" title={lead.nextAction.title}>{lead.nextAction.title}</p><Badge variant={lead.nextAction.priority === "urgent" ? "destructive" : "secondary"}>{PRIORITY_LABELS[lead.nextAction.priority]}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{LEAD_TASK_LABELS[lead.nextAction.type]} · до {formatDateTime(lead.nextAction.dueAt, locale, timezone)}</p>{lead.nextAction.note ? <p className="mt-2 break-words [overflow-wrap:anywhere] text-sm text-muted-foreground">{lead.nextAction.note}</p> : null}</div>
                    {lead.nextAction.origin === "trial" ? (
                      <Button type="button" variant="outline" onClick={focusTrials}><CalendarClock />К пробному</Button>
                    ) : canEdit ? (
                      <Button type="button" variant="outline" onClick={() => setCompleteOpen(true)} disabled={pending}><CheckCircle2 />Завершить</Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="flex size-9 items-center justify-center rounded-lg bg-muted"><Clock3 className="size-4" /></span><span>{lead.state === "open" ? "Следующее действие не назначено" : "Открытых действий нет"}</span></div>
                )}
              </CardContent>
            </Card>

            <Card id={trialsSectionId} tabIndex={-1} className="scroll-mt-4 gap-0 py-0 ring-1 ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border p-4">
                <div><CardTitle>Пробные занятия</CardTitle><p className="mt-1 text-xs text-muted-foreground">Запись и результат пробного в одной карточке.</p></div>
                {canEdit ? <Button type="button" size="sm" variant="outline" onClick={() => setTrialOpen(true)}><Plus />Назначить</Button> : null}
              </CardHeader>
              <CardContent className="space-y-2 p-4">
                {lead.trials.length > 0 ? lead.trials.slice(0, 5).map((trial) => <TrialCard key={trial.id} trial={trial} locale={locale} timezone={timezone} canEdit={canEdit} pending={pending} onOutcome={(status) => markTrial(trial.id, status)} />) : <p className="text-sm text-muted-foreground">Пробные занятия ещё не назначались.</p>}
              </CardContent>
            </Card>

            {lead.notes ? <Card className="gap-0 py-0 ring-1 ring-border"><CardHeader className="border-b border-border p-4"><CardTitle>Заметки</CardTitle></CardHeader><CardContent className="p-4"><p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6 text-muted-foreground">{lead.notes}</p></CardContent></Card> : null}

            <section>
              <div className="flex items-end justify-between gap-3"><div><h2 className="text-sm font-semibold text-foreground">История</h2><p className="mt-1 text-xs text-muted-foreground">Контакты, заметки и системные изменения.</p></div>{canEdit ? <Button type="button" size="sm" variant="outline" onClick={() => setActivityOpen(true)}><Plus />Добавить</Button> : null}</div>
              {lead.activities.length > 0 ? <ol className="mt-4">{lead.activities.map((item) => <ActivityItem key={item.id} item={item} locale={locale} timezone={timezone} />)}</ol> : <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">История появится после первого контакта или изменения.</div>}
            </section>
          </SheetBody>
        </SheetContent>
      </Sheet>

      <EditLeadDialog key={`edit-${editOpen}-${lead.version}`} open={editOpen} onOpenChange={setEditOpen} lead={lead} sources={sources} pending={pending} onSubmit={(input) => execute(() => updateLeadAction({ leadId: lead.id, expectedVersion: version, ...input }), "Карточка лида обновлена", () => setEditOpen(false))} />
      <LossDialog key={`loss-${lossOpen}-${lead.version}`} open={lossOpen} onOpenChange={setLossOpen} reasons={lossReasons} pending={pending} onSubmit={submitLoss} />
      <TaskDialog key={`task-${taskOpen}-${followUp}`} open={taskOpen} onOpenChange={setTaskOpen} staff={staff} currentStaffId={currentStaffId} canAssign={permissions.assign} timezone={timezone} pending={pending} initialFollowUp={followUp} onSubmit={submitTask} />
      <CompleteTaskDialog key={`complete-${completeOpen}`} open={completeOpen} onOpenChange={setCompleteOpen} pending={pending} onSubmit={completeTask} />
      <ActivityDialog key={`activity-${activityOpen}`} open={activityOpen} onOpenChange={setActivityOpen} pending={pending} onSubmit={submitActivity} />
      <TrialDialog key={`trial-${trialOpen}`} open={trialOpen} onOpenChange={setTrialOpen} staff={staff} currentStaffId={currentStaffId} canAssign={permissions.assign} timezone={timezone} pending={pending} onSubmit={submitTrial} />
      <ConversionDialog key={`conversion-${conversionOpen}`} open={conversionOpen} onOpenChange={setConversionOpen} lead={lead} pending={pending} duplicates={conversionDuplicates} error={conversionError} clientsView={permissions.clientsView} onConvert={convert} />
      <ArchiveDialog key={`archive-${archiveOpen}`} open={archiveOpen} onOpenChange={setArchiveOpen} pending={pending} onSubmit={archive} />
    </>
  )
}
