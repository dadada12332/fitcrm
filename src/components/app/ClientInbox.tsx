"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import {
  ArrowLeft, Check, CheckCheck, ChevronRight, CircleAlert, Clock3, CreditCard,
  Inbox, LoaderCircle, MessageCircle, Phone, RefreshCw, Search,
  SendHorizontal, Settings2, Sparkles, Trash2, UserRound, Wallet,
} from "lucide-react"
import {
  assignConversationAction,
  deleteReplyTemplateAction,
  getInboxConversationAction,
  getReplyTemplatesAction,
  listInboxConversationsAction,
  retryInboxMessageAction,
  saveReplyTemplateAction,
  sendInboxReplyAction,
  updateConversationStatusAction,
  type InboxConversationDetail,
  type InboxConversationListItem,
  type InboxReplyTemplate,
  type InboxStaff,
} from "@/app/(app)/inbox/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  BUILTIN_CLIENT_REPLIES, CLIENT_INBOX_CATEGORIES,
  type ClientConversationCategory, type ClientConversationStatus,
} from "@/lib/client-inbox"
import { createClient } from "@/lib/supabase/client"
import { toast } from "@/lib/use-action"

type Filter = "active" | "new" | "mine" | "waiting_client" | "resolved"

const STATUS_META: Record<ClientConversationStatus, { label: string; className: string }> = {
  new: { label: "Новое", className: "bg-brand/10 text-brand" },
  open: { label: "В работе", className: "bg-chart-3/10 text-chart-3" },
  waiting_client: { label: "Ждём клиента", className: "bg-muted text-muted-foreground" },
  resolved: { label: "Решено", className: "bg-chart-2/10 text-chart-2" },
  closed: { label: "Закрыто", className: "bg-muted text-muted-foreground" },
}

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "active", label: "Все" },
  { key: "new", label: "Новые" },
  { key: "mine", label: "Мои" },
  { key: "waiting_client", label: "Ждём" },
  { key: "resolved", label: "Решённые" },
]

function categoryLabel(category: ClientConversationCategory) {
  return CLIENT_INBOX_CATEGORIES.find((item) => item.key === category)?.label ?? "Другое"
}

function relativeTime(value: string) {
  const date = new Date(value)
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return "сейчас"
  if (seconds < 3600) return `${Math.floor(seconds / 60)} мин`
  if (date.toDateString() === new Date().toDateString()) return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} сум`
}

function formatDate(value: string | null) {
  if (!value) return "Нет данных"
  return new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
}

export function ClientInbox({
  clubId,
  initialConversations,
  initialStaff,
  initialTemplates,
  currentStaffId,
  initialError,
  canReply,
  canAssign,
  canManageTemplates,
}: {
  clubId: string
  initialConversations: InboxConversationListItem[]
  initialStaff: InboxStaff[]
  initialTemplates: InboxReplyTemplate[]
  currentStaffId: string | null
  initialError?: string
  canReply: boolean
  canAssign: boolean
  canManageTemplates: boolean
}) {
  const [conversations, setConversations] = useState(initialConversations)
  const [templates, setTemplates] = useState(initialTemplates)
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0]?.id ?? null)
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false)
  const [detail, setDetail] = useState<InboxConversationDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("active")
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false)
  const selectedRef = useRef(selectedId)

  useEffect(() => { selectedRef.current = selectedId }, [selectedId])

  const refreshList = useCallback(async () => {
    const result = await listInboxConversationsAction()
    if (result.error) return
    setConversations(result.conversations)
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    const result = await getInboxConversationAction(id)
    if (result.error) toast.error(result.error)
    setDetail(result.conversation)
    setLoadingDetail(false)
    await refreshList()
  }, [refreshList])

  useEffect(() => {
    // Loading selected server data is the external synchronization performed here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedId) void loadDetail(selectedId)
    else setDetail(null)
  }, [loadDetail, selectedId])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`client-inbox-${clubId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "client_conversations", filter: `club_id=eq.${clubId}` }, (payload) => {
        void refreshList()
        const changedId = (payload.new as { id?: string } | null)?.id
        if (changedId && changedId === selectedRef.current) void loadDetail(changedId)
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [clubId, loadDetail, refreshList])

  const filtered = useMemo(() => conversations.filter((conversation) => {
    const q = query.trim().toLowerCase()
    if (q && !`${conversation.clientName} ${conversation.preview} ${categoryLabel(conversation.category)}`.toLowerCase().includes(q)) return false
    if (filter === "new") return conversation.status === "new"
    if (filter === "waiting_client") return conversation.status === "waiting_client"
    if (filter === "resolved") return conversation.status === "resolved" || conversation.status === "closed"
    if (filter === "mine") return !!conversation.assigneeId && conversation.assigneeId === currentStaffId
    return conversation.status !== "resolved" && conversation.status !== "closed"
  }), [conversations, currentStaffId, filter, query])

  const refreshTemplates = useCallback(async () => {
    const result = await getReplyTemplatesAction()
    if (!result.error) setTemplates(result.templates)
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Обращения клиентов</h1>
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">Telegram</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Диалоги из личного кабинета клиента</p>
        </div>
        {canManageTemplates && (
          <Button variant="outline" onClick={() => setTemplateSheetOpen(true)}><Settings2 />Шаблоны ответов</Button>
        )}
      </div>

      {initialError && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{initialError}</div>}

      <div className="h-[calc(100dvh-178px)] min-h-[560px] overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid h-full md:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_300px]">
          <ConversationList
            conversations={filtered}
            allCount={conversations.length}
            selectedId={selectedId}
            query={query}
            filter={filter}
            onQuery={setQuery}
            onFilter={setFilter}
            onSelect={(id) => {
              setSelectedId(id)
              setMobileThreadOpen(true)
            }}
            hiddenOnMobile={mobileThreadOpen}
          />

          <div className={`${mobileThreadOpen ? "flex" : "hidden md:flex"} min-w-0 flex-col border-border md:border-l`}>
            {selectedId
              ? <ConversationThread
                  detail={detail}
                  loading={loadingDetail}
                  staff={initialStaff}
                  templates={templates}
                  canReply={canReply}
                  canAssign={canAssign}
                  onBack={() => setMobileThreadOpen(false)}
                  onChanged={() => selectedId && loadDetail(selectedId)}
                />
              : <InboxEmpty />}
          </div>

          <div className="hidden min-w-0 border-l border-border xl:block">
            <ClientContext detail={detail} />
          </div>
        </div>
      </div>

      <TemplateManager
        open={templateSheetOpen}
        onOpenChange={setTemplateSheetOpen}
        templates={templates}
        onChanged={refreshTemplates}
      />
    </div>
  )
}

function ConversationList({
  conversations, allCount, selectedId, query, filter, onQuery, onFilter, onSelect, hiddenOnMobile,
}: {
  conversations: InboxConversationListItem[]
  allCount: number
  selectedId: string | null
  query: string
  filter: Filter
  onQuery: (value: string) => void
  onFilter: (value: Filter) => void
  onSelect: (value: string) => void
  hiddenOnMobile: boolean
}) {
  return (
    <section className={`${hiddenOnMobile ? "hidden md:flex" : "flex"} min-w-0 flex-col`}>
      <div className="space-y-3 border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Клиент или сообщение" className="h-10 pl-9" />
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 sm:flex sm:overflow-x-auto">
          {FILTERS.map((item) => (
            <button key={item.key} type="button" onClick={() => onFilter(item.key)}
              className={`h-8 min-w-0 rounded-md px-2 text-xs font-medium transition-colors sm:shrink-0 sm:px-3 ${filter === item.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => {
          const status = STATUS_META[conversation.status]
          const active = conversation.id === selectedId
          return (
            <button key={conversation.id} type="button" onClick={() => onSelect(conversation.id)}
              className={`w-full border-b border-border px-4 py-3 text-left transition-colors ${active ? "bg-muted" : "hover:bg-muted/60"}`}>
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {conversation.clientName.trim().charAt(0).toUpperCase() || "К"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`min-w-0 flex-1 truncate text-sm ${conversation.unread ? "font-semibold" : "font-medium"}`}>{conversation.clientName}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(conversation.lastMessageAt)}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{conversation.preview || "Новое обращение"}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.className}`}>{status.label}</span>
                    <span className="truncate text-[10px] text-muted-foreground">{categoryLabel(conversation.category)}</span>
                    {conversation.unread && <span className="ml-auto size-2 shrink-0 rounded-full bg-brand" aria-label="Непрочитано" />}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
        {!conversations.length && (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <Inbox className="size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Обращений не найдено</p>
            <p className="mt-1 text-xs text-muted-foreground">{allCount ? "Измените поиск или фильтр" : "Новые сообщения из Mini App появятся здесь"}</p>
          </div>
        )}
      </div>
    </section>
  )
}

function ConversationThread({ detail, loading, staff, templates, canReply, canAssign, onBack, onChanged }: {
  detail: InboxConversationDetail | null
  loading: boolean
  staff: InboxStaff[]
  templates: InboxReplyTemplate[]
  canReply: boolean
  canAssign: boolean
  onBack: () => void
  onChanged: () => void
}) {
  const [text, setText] = useState("")
  const [showReplies, setShowReplies] = useState(false)
  const [replyQuery, setReplyQuery] = useState("")
  const [pending, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }) }, [detail?.messages.length])

  if (loading || !detail) return <div className="flex flex-1 items-center justify-center"><LoaderCircle className="animate-spin text-muted-foreground" /></div>

  const activeDetail = detail
  const allTemplates = [...BUILTIN_CLIENT_REPLIES, ...templates]
  const visibleTemplates = allTemplates.filter((template) => {
    const q = replyQuery.toLowerCase().trim()
    return !q || `${template.title} ${template.body}`.toLowerCase().includes(q)
  })
  const locked = activeDetail.status === "closed"

  function applyTemplate(body: string) {
    const rendered = body
      .replaceAll("{client_name}", activeDetail.client.name.split(" ")[0] || activeDetail.client.name)
      .replaceAll("{club_name}", "клуб")
      .replaceAll("{membership_name}", activeDetail.client.membershipName ?? "не указан")
      .replaceAll("{expires_at}", formatDate(activeDetail.client.membershipExpiresAt))
    setText(rendered)
    setShowReplies(false)
  }

  function send() {
    const value = text.trim()
    if (!value || pending) return
    setText("")
    startTransition(async () => {
      const result = await sendInboxReplyAction(activeDetail.id, value)
      if (!result.ok) {
        setText(value)
        toast.error(result.error ?? "Не удалось отправить сообщение")
        return
      }
      if (result.deliveryError) toast.warning(`Ответ сохранён, но Telegram не доставил его: ${result.deliveryError}`)
      else toast.success("Ответ отправлен клиенту")
      onChanged()
    })
  }

  function changeStatus(status: ClientConversationStatus) {
    startTransition(async () => {
      const result = await updateConversationStatusAction(activeDetail.id, status)
      if (!result.ok) toast.error(result.error ?? "Не удалось изменить статус")
      else onChanged()
    })
  }

  function assign(staffId: string | null) {
    startTransition(async () => {
      const result = await assignConversationAction(activeDetail.id, staffId)
      if (!result.ok) toast.error(result.error ?? "Не удалось назначить сотрудника")
      else onChanged()
    })
  }

  return (
    <>
      <header className="flex min-h-16 flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
        <Button type="button" variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label="К списку"><ArrowLeft /></Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{detail.client.name}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_META[detail.status].className}`}>{STATUS_META[detail.status].label}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{categoryLabel(detail.category)} · #{detail.conversationNo}</p>
        </div>
        {canReply && detail.status !== "closed" && (
          <Button type="button" variant={detail.status === "resolved" ? "outline" : "ghost"} size="sm"
            onClick={() => changeStatus(detail.status === "resolved" ? "open" : "resolved")} disabled={pending}
            aria-label={detail.status === "resolved" ? "Вернуть обращение в работу" : "Отметить обращение решённым"}
            title={detail.status === "resolved" ? "Вернуть в работу" : "Отметить решённым"}>
            {detail.status === "resolved" ? <RefreshCw /> : <Check />}<span className="hidden sm:inline">{detail.status === "resolved" ? "Вернуть" : "Решено"}</span>
          </Button>
        )}
        {canAssign && (
          <div className="hidden basis-full items-center gap-2 md:flex">
            <span className="hidden shrink-0 text-xs text-muted-foreground 2xl:inline">Ответственный</span>
            <Select value={detail.assigneeId ?? "unassigned"} onValueChange={(value) => assign(value === "unassigned" ? null : String(value))} disabled={pending}>
              <SelectTrigger className="h-9 w-0 min-w-0 flex-1 overflow-hidden rounded-lg bg-card px-3">
                <SelectValue><span className="block truncate">{staff.find((item) => item.id === detail.assigneeId)?.name ?? "Не назначено"}</span></SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Не назначено</SelectItem>
                {staff.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-background/50 px-3 py-5 sm:px-5">
        {detail.messages.map((message) => {
          if (message.senderType === "system") return <p key={message.id} className="text-center text-xs text-muted-foreground">{message.body}</p>
          const mine = message.senderType === "staff"
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[86%] sm:max-w-[75%]">
                <p className={`mb-1 text-[11px] text-muted-foreground ${mine ? "text-right" : ""}`}>{mine ? message.senderName ?? "Сотрудник" : detail.client.name}</p>
                <div className={`rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${mine ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground"}`}>
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                </div>
                <div className={`mt-1 flex items-center gap-1 text-[10px] text-muted-foreground ${mine ? "justify-end" : ""}`}>
                  <span>{new Date(message.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  {mine && message.deliveryStatus === "sent" && <CheckCheck className="size-3" />}
                  {mine && message.deliveryStatus === "pending" && <Clock3 className="size-3" />}
                  {mine && message.deliveryStatus === "failed" && (
                    <button type="button" className="flex items-center gap-1 text-destructive" onClick={async () => {
                      const result = await retryInboxMessageAction(message.id)
                      if (!result.ok) toast.error(result.error ?? "Повторная отправка не удалась")
                      else { toast.success("Сообщение доставлено"); onChanged() }
                    }} title={message.deliveryError ?? "Повторить отправку"}>
                      <CircleAlert className="size-3" />Повторить
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-border bg-card p-3">
        {showReplies && (
          <div className="mb-3 rounded-lg border border-border bg-popover p-2 shadow-lg">
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={replyQuery} onChange={(event) => setReplyQuery(event.target.value)} placeholder="Найти быстрый ответ" className="h-9 pl-8" />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {visibleTemplates.map((template) => (
                <button key={template.id} type="button" onClick={() => applyTemplate(template.body)} className="w-full rounded-md px-3 py-2 text-left hover:bg-muted">
                  <p className="text-xs font-medium">{template.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{template.body}</p>
                </button>
              ))}
            </div>
          </div>
        )}
        {locked ? (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            <span>Обращение закрыто</span>
            {canReply && <Button size="sm" variant="outline" onClick={() => changeStatus("open")}>Открыть снова</Button>}
          </div>
        ) : canReply ? (
          <div className="rounded-lg border border-border bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
            <Textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Ответить клиенту…" maxLength={4000}
              className="min-h-20 resize-none border-0 bg-transparent p-2 shadow-none focus-visible:ring-0"
              onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); send() } }} />
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowReplies((value) => !value)}><Sparkles />Быстрый ответ</Button>
              <Button type="button" size="sm" onClick={send} disabled={!text.trim() || pending}>{pending ? <LoaderCircle className="animate-spin" /> : <SendHorizontal />}Отправить</Button>
            </div>
          </div>
        ) : <p className="py-2 text-center text-sm text-muted-foreground">У вас нет права отвечать клиентам</p>}
      </div>
    </>
  )
}

function ClientContext({ detail }: { detail: InboxConversationDetail | null }) {
  if (!detail) return <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">Выберите обращение</div>
  const client = detail.client
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">{client.name.charAt(0).toUpperCase()}</div>
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{client.name}</p><p className="text-xs text-muted-foreground">Клиент клуба</p></div>
      </div>
      <div className="mt-5 space-y-2">
        {client.phone && <a href={`tel:${client.phone}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-muted"><Phone className="size-4 text-muted-foreground" />{client.phone}</a>}
        <Link href={`/clients/${client.id}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-muted"><span className="flex items-center gap-2"><UserRound className="size-4 text-muted-foreground" />Карточка клиента</span><ChevronRight className="size-4 text-muted-foreground" /></Link>
      </div>
      <div className="mt-5 space-y-3 border-t border-border pt-5">
        <ContextRow icon={CreditCard} label="Абонемент" value={client.membershipName ?? "Нет абонемента"} hint={client.membershipExpiresAt ? `до ${formatDate(client.membershipExpiresAt)}` : undefined} />
        <ContextRow icon={Clock3} label="Последнее посещение" value={formatDate(client.lastVisitAt)} />
        <ContextRow icon={Wallet} label="Баланс" value={formatMoney(client.balance)} hint={client.debt > 0 ? `Долг: ${formatMoney(client.debt)}` : undefined} destructive={client.debt > 0} />
        <ContextRow icon={MessageCircle} label="Telegram" value={client.telegramUsername ? `@${client.telegramUsername}` : "Подключён"} />
      </div>
    </div>
  )
}

function ContextRow({ icon: Icon, label, value, hint, destructive }: { icon: typeof CreditCard; label: string; value: string; hint?: string; destructive?: boolean }) {
  return <div className="flex items-start gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted"><Icon className="size-4 text-muted-foreground" /></div><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 break-words text-sm font-medium">{value}</p>{hint && <p className={`mt-0.5 text-xs ${destructive ? "text-destructive" : "text-muted-foreground"}`}>{hint}</p>}</div></div>
}

function InboxEmpty() {
  return <div className="flex flex-1 flex-col items-center justify-center px-6 text-center"><div className="flex size-12 items-center justify-center rounded-lg bg-muted"><MessageCircle className="size-5 text-muted-foreground" /></div><p className="mt-4 text-sm font-medium">Выберите обращение</p><p className="mt-1 max-w-xs text-xs text-muted-foreground">Здесь появятся переписка и контекст клиента</p></div>
}

function TemplateManager({ open, onOpenChange, templates, onChanged }: { open: boolean; onOpenChange: (value: boolean) => void; templates: InboxReplyTemplate[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<InboxReplyTemplate | null>(null)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [shortcut, setShortcut] = useState("")
  const [category, setCategory] = useState<ClientConversationCategory>("other")
  const [pending, startTransition] = useTransition()

  function edit(template?: InboxReplyTemplate) {
    setEditing(template ?? null)
    setTitle(template?.title ?? "")
    setBody(template?.body ?? "")
    setShortcut(template?.shortcut ?? "")
    setCategory(template?.category ?? "other")
  }

  function save() {
    startTransition(async () => {
      const result = await saveReplyTemplateAction({ id: editing?.id, title, body, shortcut, category })
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить шаблон")
        return
      }
      toast.success(editing ? "Шаблон обновлён" : "Шаблон создан")
      edit()
      onChanged()
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-[520px]">
        <SheetHeader><SheetTitle>Шаблоны ответов</SheetTitle><Button variant="ghost" size="sm" onClick={() => edit()}>{editing ? "Новый" : "Очистить"}</Button></SheetHeader>
        <SheetBody className="space-y-6">
          <section className="space-y-3 rounded-lg border border-border p-4">
            <div><p className="text-sm font-semibold">{editing ? "Редактировать шаблон" : "Новый шаблон"}</p><p className="mt-1 text-xs text-muted-foreground">Переменные: {"{client_name}"}, {"{membership_name}"}, {"{expires_at}"}</p></div>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Название" />
            <div className="grid grid-cols-2 gap-2">
              <Select value={category} onValueChange={(value) => setCategory(value as ClientConversationCategory)}>
                <SelectTrigger><SelectValue>{categoryLabel(category)}</SelectValue></SelectTrigger><SelectContent>{CLIENT_INBOX_CATEGORIES.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input value={shortcut} onChange={(event) => setShortcut(event.target.value)} placeholder="Сокращение" />
            </div>
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Текст ответа" className="min-h-32" />
            <Button className="w-full" onClick={save} disabled={pending || !title.trim() || !body.trim()}>{pending ? <LoaderCircle className="animate-spin" /> : <Check />}Сохранить</Button>
          </section>
          <section>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Шаблоны клуба</p>
            <div className="divide-y divide-border rounded-lg border border-border">
              {templates.map((template) => (
                <div key={template.id} className="flex items-start gap-2 p-3">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => edit(template)}><p className="text-sm font-medium">{template.title}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{template.body}</p></button>
                  <Button variant="ghost" size="icon" aria-label="Удалить шаблон" onClick={() => startTransition(async () => { const result = await deleteReplyTemplateAction(template.id); if (!result.ok) toast.error(result.error ?? "Не удалось удалить"); else onChanged() })}><Trash2 /></Button>
                </div>
              ))}
              {!templates.length && <p className="p-4 text-center text-sm text-muted-foreground">Собственных шаблонов пока нет</p>}
            </div>
          </section>
          <section>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Встроенные ответы</p>
            <div className="divide-y divide-border rounded-lg border border-border">{BUILTIN_CLIENT_REPLIES.map((template) => <div key={template.id} className="p-3"><p className="text-sm font-medium">{template.title}</p><p className="mt-1 text-xs text-muted-foreground">{template.body}</p></div>)}</div>
          </section>
        </SheetBody>
        <SheetFooter><Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Готово</Button></SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
