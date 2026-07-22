"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Database,
  Info,
  MessageCircle,
  Package,
  Phone,
  ReceiptText,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react"
import { askAiAction, type AiCard, type AiClientItem, type AiMessage, type Briefing, type BriefingStat } from "@/app/(app)/ai/actions"
import { showActionError } from "@/lib/plan-limit-client"
import { AiComposer } from "./AiComposer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const QUICK_QUERIES = [
  { icon: BarChart3, label: "Выручка за неделю", query: "покажи выручку за 7 дней" },
  { icon: CalendarClock, label: "Ближайшие продления", query: "у кого заканчивается абонемент за 7 дней" },
  { icon: Users, label: "Клиенты с долгом", query: "покажи должников" },
  { icon: Activity, label: "Посещаемость сегодня", query: "кто сегодня приходил" },
  { icon: Package, label: "Низкие остатки", query: "что заканчивается на складе" },
  { icon: ReceiptText, label: "Последние оплаты", query: "покажи последние оплаты" },
]

const STAT_META: Record<BriefingStat["key"], { icon: React.ComponentType<{ className?: string }>; iconClass: string; iconBg: string }> = {
  visits: { icon: Activity, iconClass: "text-chart-2", iconBg: "bg-chart-2/10" },
  payments: { icon: WalletCards, iconClass: "text-chart-1", iconBg: "bg-chart-1/10" },
  expiring: { icon: Clock3, iconClass: "text-chart-3", iconBg: "bg-chart-3/10" },
  revenue: { icon: CircleDollarSign, iconClass: "text-chart-4", iconBg: "bg-chart-4/10" },
}

function SourceBadge({ source }: { source?: { entity: string; count: number; period?: string } }) {
  if (!source) return null
  return (
    <Badge variant="secondary" className="max-w-48 truncate font-normal text-muted-foreground">
      {source.entity} · {source.count}{source.period ? ` · ${source.period}` : ""}
    </Badge>
  )
}

function Followups({ items, onPick }: { items?: string[]; onPick: (text: string) => void }) {
  if (!items?.length) return null
  return items.map((item) => (
    <Button key={item} type="button" variant="secondary" size="xs" onClick={() => onPick(item)}>
      {item}
    </Button>
  ))
}

function CardShell({ icon, title, source, children, footer, openHref }: {
  icon: React.ReactNode
  title: string
  source?: { entity: string; count: number; period?: string }
  children: React.ReactNode
  footer?: React.ReactNode
  openHref?: string
}) {
  return (
    <div className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex min-h-11 items-center gap-2 border-b border-border px-3 py-2">
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</span>
        <SourceBadge source={source} />
      </div>
      <div className="p-3">{children}</div>
      {(footer || openHref) && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2">
          {footer}
          {openHref && (
            <Button render={<Link href={openHref} />} variant="ghost" size="xs" className="ml-auto text-brand">
              Открыть <ArrowRight />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function ClientRow({ client }: { client: AiClientItem }) {
  const digits = (client.phone ?? "").replace(/\D/g, "")
  return (
    <div className="flex min-h-14 items-center gap-2.5 border-b border-border py-2 last:border-b-0">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
        {client.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{client.name}</p>
        <p className="truncate text-xs text-muted-foreground">{client.phone ? `${client.phone} · ` : ""}{client.line1 ?? ""}</p>
      </div>
      {client.right && <span className="shrink-0 text-xs font-semibold text-destructive">{client.right}</span>}
      <div className="flex shrink-0 items-center">
        {digits && (
          <Button render={<a href={`tel:${digits}`} />} variant="ghost" size="icon-xs" aria-label="Позвонить" title="Позвонить">
            <Phone />
          </Button>
        )}
        {digits && (
          <Button render={<a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" />} variant="ghost" size="icon-xs" aria-label="Открыть WhatsApp" title="WhatsApp">
            <MessageCircle className="text-chart-2" />
          </Button>
        )}
        {client.id && (
          <Button render={<Link href={`/clients/${client.id}`} />} variant="ghost" size="icon-xs" aria-label="Открыть клиента" title="Открыть клиента">
            <ArrowUpRight />
          </Button>
        )}
      </div>
    </div>
  )
}

function CardView({ card, onFollow }: { card: AiCard; onFollow: (text: string) => void }) {
  if (card.type === "success") {
    return (
      <div className="flex w-full max-w-xl items-start gap-2.5 rounded-lg border border-chart-2/30 bg-chart-2/10 p-3">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-chart-2" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">{card.text.replace(/^✅\s*/, "")}</p>
          {card.followups && <div className="mt-2 flex flex-wrap gap-1.5"><Followups items={card.followups} onPick={onFollow} /></div>}
        </div>
      </div>
    )
  }
  if (card.type === "info") {
    return (
      <div className="flex w-full max-w-xl items-start gap-2.5 rounded-lg border border-border bg-card p-3">
        <Info className="mt-0.5 size-4 shrink-0 text-brand" />
        <p className="text-sm text-foreground">{card.text}</p>
      </div>
    )
  }
  if (card.type === "kpi") {
    return (
      <CardShell icon={<TrendingUp className="size-4" />} title={card.title} source={card.source} footer={<Followups items={card.followups} onPick={onFollow} />}>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-semibold text-foreground">{card.value}</span>
          {card.delta && <span className={cn("text-sm font-semibold", card.deltaUp ? "text-chart-2" : "text-destructive")}>{card.delta}</span>}
        </div>
        {card.sub && <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>}
      </CardShell>
    )
  }
  if (card.type === "client_list") {
    return (
      <CardShell icon={<Users className="size-4" />} title={card.title} source={card.source} openHref={card.openHref} footer={<Followups items={card.followups} onPick={onFollow} />}>
        {card.clients.length === 0
          ? <p className="text-sm text-muted-foreground">Ничего не найдено</p>
          : card.clients.map((client, index) => <ClientRow key={client.id || index} client={client} />)}
      </CardShell>
    )
  }
  if (card.type === "table") {
    return (
      <CardShell icon={<BarChart3 className="size-4" />} title={card.title} source={card.source} openHref={card.openHref} footer={<Followups items={card.followups} onPick={onFollow} />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead><tr>{card.columns.map((column) => <th key={column} className="px-2 pb-2 text-left text-xs font-medium text-muted-foreground first:pl-0 last:pr-0">{column}</th>)}</tr></thead>
            <tbody>{card.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-border">
                {row.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-nowrap px-2 py-2 text-foreground first:pl-0 last:pr-0">{cell}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </CardShell>
    )
  }
  if (card.type === "list") {
    return (
      <CardShell icon={<Package className="size-4" />} title={card.title} source={card.source} openHref={card.openHref} footer={<Followups items={card.followups} onPick={onFollow} />}>
        {card.items.length === 0 ? <p className="text-sm text-muted-foreground">Нет данных</p> : card.items.map((item, index) => (
          <div key={`${item.title}-${index}`} className="flex min-h-11 items-center gap-3 border-b border-border py-2 last:border-b-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
              {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
            </div>
            {item.badge && <Badge variant={item.badgeTone === "danger" ? "destructive" : "secondary"}>{item.badge}</Badge>}
          </div>
        ))}
      </CardShell>
    )
  }
  return null
}

function BriefingPanel({ briefing, onPick }: { briefing: Briefing | null; onPick: (query: string) => void }) {
  const expiring = briefing?.stats.find((stat) => stat.key === "expiring")
  const expiringCount = Number(expiring?.value ?? 0)

  return (
    <aside className="order-2 min-w-0 space-y-5">
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Сегодня</h2>
            <p className="mt-0.5 text-xs capitalize text-muted-foreground">{briefing?.date ?? "Загрузка данных"}</p>
          </div>
          <Badge variant="outline"><Database /> Live</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {briefing ? briefing.stats.map((stat) => {
            const meta = STAT_META[stat.key]
            const Icon = meta.icon
            return (
              <button key={stat.key} type="button" onClick={() => onPick(stat.query)} className="min-h-28 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
                <span className={cn("flex size-7 items-center justify-center rounded-md", meta.iconBg)}><Icon className={cn("size-4", meta.iconClass)} /></span>
                <span className="mt-3 block text-lg font-semibold text-foreground">{stat.value}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{stat.label}</span>
              </button>
            )
          }) : Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-lg border border-border bg-muted" />)}
        </div>
      </div>

      {expiringCount > 0 && expiring && (
        <div className="rounded-lg border border-chart-3/30 bg-chart-3/10 p-3.5">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-chart-3/15"><CalendarClock className="size-4 text-chart-3" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{expiringCount} продлений требуют внимания</p>
              <p className="mt-1 text-xs text-muted-foreground">Абонементы закончатся в ближайшие 3 дня</p>
              <Button type="button" variant="outline" size="sm" className="mt-3 bg-background" onClick={() => onPick(expiring.query)}>
                Посмотреть клиентов <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Быстрый анализ</h2>
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {QUICK_QUERIES.slice(0, 4).map((item) => {
            const Icon = item.icon
            return (
              <button key={item.label} type="button" onClick={() => onPick(item.query)} className="flex min-h-11 w-full items-center gap-2.5 px-3 text-left text-sm text-foreground transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-muted/50">
                <Icon className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

export function AiChat({ initialBriefing }: { initialBriefing: Briefing | null }) {
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [pending, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }) }, [messages, pending])

  function send(text: string, image: string | null = null) {
    const content = text.trim()
    if ((!content && !image) || pending) return
    const next: AiMessage[] = [...messages, { role: "user", content, image }]
    setMessages(next)
    startTransition(async () => {
      const result = await askAiAction(next.map((message) => ({ role: message.role, content: message.content, image: message.image })))
      if (result.error) { showActionError(result.error); return }
      setMessages((current) => [...current, { role: "assistant", content: result.error ?? result.reply, cards: result.cards }])
    })
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">AI Аналитика</h1>
            <Badge variant="secondary" className="text-brand"><Sparkles /> AI</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{initialBriefing ? `${initialBriefing.greeting}. ${initialBriefing.date}` : "Актуальные данные клуба"}</p>
        </div>
        {messages.length > 0 && (
          <Button type="button" variant="outline" onClick={() => setMessages([])}>
            <RefreshCw /> Новый запрос
          </Button>
        )}
      </header>

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="order-1 flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card lg:h-[calc(100vh-188px)]">
          <div className="flex min-h-12 items-center gap-2 border-b border-border px-4">
            <span className="flex size-7 items-center justify-center rounded-md bg-brand/10"><Sparkles className="size-4 text-brand" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Ассистент</p>
              <p className="text-xs text-muted-foreground">Данные обновляются при каждом запросе</p>
            </div>
            <Badge variant="outline" className="text-chart-2">Онлайн</Badge>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
                <div className="w-full max-w-2xl">
                  <div className="mb-5">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Быстрый старт</p>
                    <h2 className="mt-1 text-xl font-semibold text-foreground">Что проверить в клубе?</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {QUICK_QUERIES.map((item) => {
                      const Icon = item.icon
                      return (
                        <button key={item.label} type="button" onClick={() => send(item.query)} className="group flex min-h-14 items-center gap-3 rounded-lg border border-border bg-background px-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted"><Icon className="size-4 text-foreground" /></span>
                          <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{item.label}</span>
                          <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
                {messages.map((message, index) => (
                  <div key={index} className={cn("flex items-start gap-2", message.role === "user" ? "justify-end" : "justify-start")}>
                    {message.role === "assistant" && <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand/10"><Sparkles className="size-4 text-brand" /></span>}
                    <div className={cn("min-w-0 space-y-2", message.role === "user" ? "max-w-[85%]" : "max-w-[calc(100%-36px)] flex-1")}>
                      {message.image && message.role === "user" && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={message.image} alt="" className="ml-auto max-h-48 max-w-full rounded-lg object-cover" />
                      )}
                      {message.content && (
                        <div className={cn(
                          "inline-block rounded-lg px-3 py-2.5 text-sm whitespace-pre-wrap",
                          message.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-background text-foreground",
                        )}>{message.content}</div>
                      )}
                      {message.cards?.map((card, cardIndex) => <CardView key={cardIndex} card={card} onFollow={send} />)}
                    </div>
                  </div>
                ))}
                {pending && (
                  <div className="flex items-start gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand/10"><Sparkles className="size-4 text-brand" /></span>
                    <div className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground">
                      <span className="size-1.5 animate-pulse rounded-full bg-brand" /> Анализирую данные
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border bg-card p-3 sm:p-4">
            <div className="mx-auto max-w-3xl"><AiComposer onSend={send} pending={pending} autoFocus={messages.length === 0} /></div>
          </div>
        </section>

        <BriefingPanel briefing={initialBriefing} onPick={send} />
      </div>
    </div>
  )
}
