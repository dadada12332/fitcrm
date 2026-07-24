"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  Banknote,
  Camera,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Send,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type IntegrationStatus = {
  key: string
  connected: boolean
  handle?: string
  clientCount?: number
  lastSync?: string
}

type CatalogItem = {
  key: string
  label: string
  description: string
  features: string[]
  category: string
  available: boolean
  beta?: boolean
  alwaysVisible?: boolean
  icon: LucideIcon
  iconClass: string
  dotClass: string
  featureClass: string
}

const CATALOG: CatalogItem[] = [
  {
    key: "telegram",
    label: "Telegram",
    description: "Личный кабинет клиентов",
    icon: Send,
    iconClass: "bg-chart-1 text-primary-foreground",
    dotClass: "text-chart-1",
    features: ["QR-чекин", "Уведомления", "Продление", "Рассылка"],
    featureClass: "bg-chart-1/10 text-chart-1",
    category: "Мессенджеры",
    available: true,
  },
  {
    key: "click",
    label: "Click",
    description: "Приём онлайн-платежей",
    icon: Banknote,
    iconClass: "bg-chart-2 text-primary-foreground",
    dotClass: "text-chart-2",
    features: ["Онлайн-оплата", "Webhooks", "Автооплата", "История"],
    featureClass: "bg-chart-2/10 text-chart-2",
    category: "Платежи",
    available: true,
  },
  {
    key: "payme",
    label: "Payme",
    description: "Приём онлайн-платежей",
    icon: Banknote,
    iconClass: "bg-chart-4 text-primary-foreground",
    dotClass: "text-chart-4",
    features: ["Онлайн-оплата", "Webhooks", "Автооплата", "История"],
    featureClass: "bg-chart-4/10 text-chart-4",
    category: "Платежи",
    available: true,
  },
  {
    key: "instagram",
    label: "Instagram",
    description: "Контент, Insights и CRM-атрибуция",
    icon: Camera,
    iconClass: "bg-chart-5 text-primary-foreground",
    dotClass: "text-chart-5",
    features: ["Публикации", "Insights", "Лиды", "Атрибуция"],
    featureClass: "bg-chart-5/10 text-chart-5",
    category: "Соцсети",
    available: true,
  },
  {
    key: "sigur",
    label: "Sigur",
    description: "Карты, браслеты и контроль проходов",
    icon: ShieldCheck,
    iconClass: "bg-primary text-primary-foreground",
    dotClass: "text-primary",
    features: ["Турникеты", "Web-делегирование", "Карты", "События"],
    featureClass: "bg-primary/10 text-primary",
    category: "Контроль доступа",
    available: true,
    beta: true,
    alwaysVisible: true,
  },
  {
    key: "zkteco",
    label: "ZKTeco",
    description: "Подключение ZKBio и терминалов доступа",
    icon: ShieldCheck,
    iconClass: "bg-chart-2 text-primary-foreground",
    dotClass: "text-chart-2",
    features: ["ZKBio", "RFID", "Браслеты", "Журнал проходов"],
    featureClass: "bg-chart-2/10 text-chart-2",
    category: "Контроль доступа",
    available: true,
    beta: true,
    alwaysVisible: true,
  },
  {
    key: "hikvision",
    label: "Hikvision",
    description: "Терминалы и контроллеры через ISAPI",
    icon: ShieldCheck,
    iconClass: "bg-chart-5 text-primary-foreground",
    dotClass: "text-chart-5",
    features: ["ISAPI", "RFID", "Терминалы", "События"],
    featureClass: "bg-chart-5/10 text-chart-5",
    category: "Контроль доступа",
    available: true,
    beta: true,
    alwaysVisible: true,
  },
  {
    key: "google-calendar",
    label: "Google Calendar",
    description: "Календарь, заметки и выборочный перенос",
    icon: CalendarDays,
    iconClass: "bg-chart-1 text-primary-foreground",
    dotClass: "text-chart-1",
    features: ["Календарь", "Заметки", "Ручной перенос", "События"],
    featureClass: "bg-chart-1/10 text-chart-1",
    category: "Продуктивность",
    available: true,
  },
]

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "только что"
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ч назад`
  return `${Math.floor(h / 24)} дн назад`
}

function IntegrationCard({
  integration,
  status,
}: {
  integration: CatalogItem
  status: IntegrationStatus | undefined
}) {
  const connected = status?.connected ?? false
  const Icon = integration.icon

  return (
    <Card className="gap-0 py-0 transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-lg", integration.iconClass)}>
            <Icon className="size-6" aria-hidden />
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {integration.beta && (
              <Badge variant="secondary">Beta · не проверено на железе</Badge>
            )}
            {integration.available ? (
              <Badge
                variant={connected ? "default" : "outline"}
                className={cn(connected && "bg-chart-2 text-primary-foreground")}
              >
                {connected ? <CheckCircle2 aria-hidden /> : <Circle aria-hidden />}
                {connected ? "Подключено" : "Не подключено"}
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Clock aria-hidden />
                Скоро
              </Badge>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-0.5 flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{integration.label}</h3>
            {integration.category === "Контроль доступа" && (
              <span className="text-xs text-muted-foreground">Контроль доступа</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{integration.description}</p>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {integration.features.map((feature) => (
            <span
              key={feature}
              className={cn("rounded-md px-2 py-0.5 text-xs font-medium", integration.featureClass)}
            >
              {feature}
            </span>
          ))}
        </div>

        {connected && status ? (
          <div className="space-y-1.5 rounded-lg bg-muted p-3">
            {status.handle && (
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Подключение</span>
                <span className="truncate font-medium text-foreground">{status.handle}</span>
              </div>
            )}
            {status.clientCount !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Клиентов</span>
                <span className="font-semibold text-foreground">{status.clientCount}</span>
              </div>
            )}
            {status.lastSync && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Обновлено</span>
                <span className="text-muted-foreground">{timeAgo(status.lastSync)}</span>
              </div>
            )}
          </div>
        ) : integration.available ? (
          <div className="space-y-1">
            {getBenefits(integration.key).map((benefit) => (
              <div key={benefit} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className={cn("mt-0.5 text-[10px]", integration.dotClass)}>●</span>
                {benefit}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="border-0 bg-transparent px-5 pb-5 pt-0">
        {integration.available ? (
          <Link
            href={
              integration.key === "click" || integration.key === "payme"
                ? "/settings/finance"
                : `/integrations/${integration.key}`
            }
            className={cn(
              "flex h-9 w-full items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors",
              connected
                ? "border-border bg-background text-foreground hover:bg-muted"
                : "border-primary bg-primary text-primary-foreground hover:bg-primary/80",
            )}
          >
            {connected ? "Управление" : "Подключить"}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <div className="flex h-9 w-full cursor-not-allowed items-center justify-center rounded-lg bg-muted text-sm font-medium text-muted-foreground">
            Скоро будет доступно
          </div>
        )}
      </CardFooter>
    </Card>
  )
}

function getBenefits(key: string): string[] {
  const map: Record<string, string[]> = {
    telegram: [
      "Клиенты управляют абонементом через бот",
      "Автоматические напоминания об истечении",
      "QR-код для входа в зал",
    ],
    click: [
      "Принимайте оплату онлайн через Click",
      "Автоматические webhooks о платежах",
      "История транзакций в CRM",
    ],
    payme: [
      "Принимайте оплату онлайн через Payme",
      "Автоматические webhooks о платежах",
      "История транзакций в CRM",
    ],
    instagram: [
      "Смотрите posts и reels в FitCRM",
      "Отделяйте охват от реальных лидов",
      "Связывайте клиентов и выручку с Instagram",
    ],
    "google-calendar": [
      "Смотрите календарь и заметки Google внутри CRM",
      "Создавайте новые события прямо из FitCRM",
      "Переносите только выбранные посещения — без автосинхронизации",
    ],
    sigur: [
      "Проверка абонемента перед проходом",
      "Карты и браслеты привязываются к клиентам",
      "Подтверждённый проход создаёт посещение",
    ],
    zkteco: [
      "События из ZKBio попадают в FitCRM",
      "Единый журнал разрешённых и отклонённых проходов",
      "Защита от повторной обработки событий",
    ],
    hikvision: [
      "Подключение терминалов по ISAPI",
      "Проверка карточки по активному абонементу",
      "Автоматическая регистрация посещений",
    ],
  }
  return map[key] ?? []
}

function SectionDivider({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3" aria-label={children}>
      <h2 className="shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {children}
      </h2>
      <div className="h-px flex-1 bg-border" aria-hidden />
    </div>
  )
}

export function IntegrationsCatalog({
  statuses,
  allowedKeys,
}: {
  statuses: IntegrationStatus[]
  allowedKeys?: string[]
}) {
  const statusMap = new Map(statuses.map((status) => [status.key, status]))
  const available = CATALOG.filter(
    (item) => item.available && (item.alwaysVisible || !allowedKeys || allowedKeys.includes(item.key)),
  )
  const services = available.filter((item) => item.category !== "Контроль доступа")
  const accessControl = available.filter((item) => item.category === "Контроль доступа")
  const comingSoon = CATALOG.filter((item) => !item.available)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <SectionDivider>Сервисы и платежи</SectionDivider>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((integration) => (
            <IntegrationCard
              key={integration.key}
              integration={integration}
              status={statusMap.get(integration.key)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <SectionDivider>Контроль доступа</SectionDivider>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accessControl.map((integration) => (
            <IntegrationCard
              key={integration.key}
              integration={integration}
              status={statusMap.get(integration.key)}
            />
          ))}
        </div>
      </div>

      {comingSoon.length > 0 && (
        <div className="space-y-3">
          <SectionDivider>Скоро</SectionDivider>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {comingSoon.map((integration) => (
              <IntegrationCard key={integration.key} integration={integration} status={undefined} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
