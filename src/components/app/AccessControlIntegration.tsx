"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Download,
  KeyRound,
  Link2,
  LoaderCircle,
  PackageCheck,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unplug,
  Wifi,
  WifiOff,
} from "lucide-react"

import {
  addAccessCredentialAction,
  disconnectAccessControlIntegrationAction,
  removeAccessCredentialAction,
  rotateAccessControlWebhookKeyAction,
  saveAccessControlIntegrationAction,
  simulateAccessEventAction,
  validateAccessControlSetupAction,
} from "@/app/(app)/integrations/access-control/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { runAction, toast } from "@/lib/use-action"
import {
  ACCESS_CONTROL_MODES,
  ACCESS_CONTROL_PROVIDER_META,
  type AccessControlCredentialType,
  type AccessControlDirection,
  type AccessControlIntegrationDTO,
  type AccessControlProvider,
} from "@/lib/access-control/types"

type ClientOption = {
  id: string
  name: string
}

export type AccessControlIntegrationProps = {
  provider: AccessControlProvider
  integration: AccessControlIntegrationDTO | null
  clients: ClientOption[]
}

const MODE_LABELS: Record<string, string> = {
  bridge: "FitCRM Bridge (локальная сеть)",
  web_delegation: "Web Delegation",
  rest_poll: "REST / периодическая синхронизация",
  zkbio: "ZKBio",
  isapi: "ISAPI",
  hikcentral: "HikCentral OpenAPI",
}

const STATUS_LABELS: Record<AccessControlIntegrationDTO["status"], string> = {
  draft: "Черновик",
  configured: "Настроено",
  connected: "На связи",
  error: "Ошибка",
  disabled: "Отключено",
}

const CREDENTIAL_LABELS: Record<AccessControlCredentialType, string> = {
  card: "Карта",
  bracelet: "Браслет",
  qr: "QR-код",
  face: "Лицо",
  external_id: "ID в СКУД",
}

const DIRECTION_LABELS: Record<AccessControlDirection, string> = {
  entry: "Вход",
  exit: "Выход",
  unknown: "Не определено",
}

const DECISION_LABELS: Record<AccessControlIntegrationDTO["events"][number]["decision"], string> = {
  received: "Получено",
  allowed: "Разрешено",
  denied: "Отказ",
  ignored: "Пропущено",
  error: "Ошибка",
}

function formatDate(value: string | null) {
  if (!value) return "Нет данных"
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value))
}

function CopyField({ label, value }: { label: string; value: string }) {
  async function copy() {
    await navigator.clipboard.writeText(value)
    toast.success("Адрес скопирован")
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button type="button" variant="outline" size="icon-lg" onClick={copy} aria-label={`Скопировать: ${label}`}>
          <Clipboard aria-hidden />
        </Button>
      </div>
    </div>
  )
}

function StatusBadge({ integration }: { integration: AccessControlIntegrationDTO | null }) {
  if (!integration) {
    return (
      <Badge variant="outline">
        <WifiOff />
        Не настроено
      </Badge>
    )
  }

  if (integration.status === "connected") {
    return (
      <Badge className="bg-chart-2 text-primary-foreground">
        <Wifi />
        {STATUS_LABELS[integration.status]}
      </Badge>
    )
  }

  if (integration.status === "error") {
    return (
      <Badge variant="destructive">
        <AlertTriangle />
        {STATUS_LABELS[integration.status]}
      </Badge>
    )
  }

  return <Badge variant="secondary">{STATUS_LABELS[integration.status]}</Badge>
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = href
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(href)
}

export function AccessControlIntegration({
  provider,
  integration,
  clients,
}: AccessControlIntegrationProps) {
  const router = useRouter()
  const meta = ACCESS_CONTROL_PROVIDER_META[provider]
  const modes = ACCESS_CONTROL_MODES[provider]
  const [mode, setMode] = useState(integration?.mode ?? modes[0])
  const [clientId, setClientId] = useState(clients[0]?.id ?? "")
  const [credentialType, setCredentialType] = useState<AccessControlCredentialType>("card")
  const [simDirection, setSimDirection] = useState<"entry" | "exit">("entry")
  const [simResult, setSimResult] = useState<string | null>(null)
  const [newWebhookKey, setNewWebhookKey] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function refresh() {
    router.refresh()
  }

  function saveSettings(formData: FormData) {
    const secret = String(formData.get("secret") ?? "")
    startTransition(async () => {
      const result = await runAction(
        () =>
          saveAccessControlIntegrationAction({
            provider,
            displayName: String(formData.get("displayName") ?? ""),
            mode,
            baseUrl: String(formData.get("baseUrl") ?? ""),
            username: String(formData.get("username") ?? ""),
            secret,
          }),
        {
          loading: "Сохраняем подключение…",
          success: "Настройки сохранены",
          onSuccess: refresh,
        },
      )
      if (result && "webhookKey" in result && result.webhookKey) {
        setNewWebhookKey(result.webhookKey)
      }
    })
  }

  function validateSetup() {
    startTransition(async () => {
      await runAction(() => validateAccessControlSetupAction(provider), {
        loading: "Проверяем конфигурацию…",
        success: "Конфигурация заполнена",
        onSuccess: refresh,
      })
    })
  }

  function rotateWebhookKey() {
    if (
      integration?.webhookKeyMask
      && !newWebhookKey
      && !window.confirm("Ротация ключа сразу отключит работающий Bridge. Продолжить?")
    ) {
      return
    }
    startTransition(async () => {
      const result = await runAction(() => rotateAccessControlWebhookKeyAction(provider), {
        loading: "Обновляем ключ…",
        success: "Новый webhook-ключ создан",
        onSuccess: refresh,
      })
      if (result && "webhookKey" in result && result.webhookKey) {
        setNewWebhookKey(result.webhookKey)
      }
    })
  }

  function disconnect() {
    if (!window.confirm(`Отключить интеграцию ${meta.label}? Входящие события перестанут обрабатываться.`)) {
      return
    }
    startTransition(async () => {
      await runAction(() => disconnectAccessControlIntegrationAction(provider), {
        loading: "Отключаем интеграцию…",
        success: "Интеграция отключена",
        onSuccess: refresh,
      })
    })
  }

  function downloadBridgeConfig() {
    if (!integration || !newWebhookKey) {
      toast.error("Сначала создайте новый Bridge-ключ")
      return
    }

    const providerConfig = provider === "sigur"
      ? {
          type: "sigur",
          mode: "rest_poll",
          baseUrl: "https://192.168.1.20",
          username: "${VENDOR_USERNAME}",
          password: "${VENDOR_PASSWORD}",
          pollIntervalMs: 1000,
          eventMap: {
            externalEventId: "id",
            occurredAt: "timestamp",
            credentialUid: "accessObjectId",
            deviceId: "accessPointId",
            eventType: "type",
          },
          eventTypes: {
            REPLACE_WITH_PASSAGE_TYPE_FROM_GET_EVENTS_TYPES: "passage",
          },
        }
      : provider === "zkteco"
        ? {
            type: "zkteco",
            baseUrl: "https://192.168.1.20",
            allowInsecureHttp: false,
            auth: {
              mode: "token",
              path: "/REPLACE_FROM_INSTALLED_VERSION_API_MANUAL",
              body: {
                username: "${VENDOR_USERNAME}",
                password: "${VENDOR_PASSWORD}",
              },
              tokenPath: ["token"],
            },
            events: {
              path: "/REPLACE_FROM_INSTALLED_VERSION_API_MANUAL",
              query: {},
              sinceParam: "REPLACE_FROM_INSTALLED_VERSION_API_MANUAL",
            },
            mapping: {
              profile: "zkbiotime-attendance",
            },
            pollIntervalMs: 1000,
          }
        : {
            type: "hikvision",
            mode: "isapi",
            baseUrl: "https://192.168.1.20",
            username: "${VENDOR_USERNAME}",
            password: "${VENDOR_PASSWORD}",
            pollIntervalMs: 1000,
          }

    downloadJson(`fitcrm-bridge-${provider}.json`, {
      bridge: {
        id: `${provider}-${integration.id.slice(0, 8)}`,
        listenHost: "127.0.0.1",
        listenPort: 8787,
        stateDir: "./data",
        heartbeatIntervalMs: 60000,
        deliveryIntervalMs: 1000,
        maxQueueEntries: 100000,
        maxQueueBytes: 536870912,
        maxFailureFiles: 10000,
      },
      fitcrm: {
        baseUrl: new URL(integration.eventUrl).origin,
        integrationId: integration.id,
        accessKey: newWebhookKey,
        timeoutMs: 5000,
      },
      provider: providerConfig,
      mapping: {
        entryReaders: ["ENTRY_READER_ID"],
        exitReaders: ["EXIT_READER_ID"],
        timezone: "Asia/Tashkent",
      },
    })
    toast.success("Персональный config.json скачан")
  }

  function addCredential(formData: FormData) {
    const credentialUid = String(formData.get("credentialUid") ?? "").trim()
    if (!clientId || !credentialUid) {
      toast.error("Выберите клиента и укажите идентификатор")
      return
    }

    startTransition(async () => {
      await runAction(
        () =>
          addAccessCredentialAction({
            provider,
            clientId,
            credentialType,
            credentialUid,
          }),
        {
          loading: "Привязываем идентификатор…",
          success: "Идентификатор привязан",
          onSuccess: refresh,
        },
      )
    })
  }

  function removeCredential(credentialId: string) {
    startTransition(async () => {
      await runAction(() => removeAccessCredentialAction(credentialId), {
        loading: "Удаляем привязку…",
        success: "Привязка удалена",
        onSuccess: refresh,
      })
    })
  }

  function simulate(formData: FormData) {
    const credentialUid = String(formData.get("simulationCredentialUid") ?? "").trim()
    if (!credentialUid) {
      toast.error("Укажите идентификатор карты или браслета")
      return
    }

    startTransition(async () => {
      const result = await runAction(
        () =>
          simulateAccessEventAction({
            provider,
            credentialUid,
            direction: simDirection,
          }),
        {
          loading: "Обрабатываем тестовое событие…",
          success: "Тестовое событие обработано",
          onSuccess: refresh,
        },
      )
      if (result && "result" in result && result.result) {
        const decision = result.result
        setSimResult(
          `${decision.allowed ? "Проход разрешён" : "Проход отклонён"} · ${decision.reason}`,
        )
      }
    })
  }

  return (
    <div className="space-y-5">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" aria-hidden />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <CardTitle>{meta.label}</CardTitle>
                <Badge variant="secondary">Beta · не проверено на железе</Badge>
              </div>
              <CardDescription>{meta.description}</CardDescription>
            </div>
          </div>
          <CardAction>
            <StatusBadge integration={integration} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-chart-3" aria-hidden />
            {meta.verification}. До проверки на реальном контроллере используйте симулятор ниже и не включайте
            автоматическое открытие турникета.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Настройки подключения</CardTitle>
            <CardDescription>
              Укажите адрес локального FitCRM Bridge. Секрет хранится на сервере и не возвращается в браузер.
            </CardDescription>
          </CardHeader>
          <form action={saveSettings}>
            <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="access-display-name" className="text-sm font-medium text-foreground">
                  Название подключения
                </label>
                <Input
                  id="access-display-name"
                  name="displayName"
                  defaultValue={integration?.displayName ?? `${meta.label} клуба`}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Режим</label>
                <Select value={mode} onValueChange={(value) => setMode(value ?? modes[0])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modes.map((item) => (
                      <SelectItem key={item} value={item}>
                        {MODE_LABELS[item] ?? item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label htmlFor="access-base-url" className="text-sm font-medium text-foreground">
                  Адрес FitCRM Bridge
                </label>
                <Input
                  id="access-base-url"
                  name="baseUrl"
                  type="url"
                  inputMode="url"
                  placeholder="https://192.168.1.10:8080"
                  defaultValue={integration?.baseUrl ?? ""}
                />
                <p className="text-xs text-muted-foreground">
                  Адрес локального агента в сети клуба. FitCRM Cloud к нему не обращается.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="access-username" className="text-sm font-medium text-foreground">
                  Логин Bridge
                </label>
                <Input
                  id="access-username"
                  name="username"
                  autoComplete="username"
                  defaultValue={integration?.username ?? ""}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="access-secret" className="text-sm font-medium text-foreground">
                  Секрет Bridge
                </label>
                <Input
                  id="access-secret"
                  name="secret"
                  type="password"
                  autoComplete="new-password"
                  placeholder={integration?.hasSecret ? "Оставьте пустым, чтобы не менять" : "Введите секрет"}
                  required={
                    ["rest_poll", "zkbio", "isapi", "hikcentral"].includes(mode)
                    && !integration?.hasSecret
                  }
                />
              </div>
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {integration?.hasSecret ? "Секрет сохранён и скрыт" : "Секрет ещё не сохранён"}
              </p>
              <Button type="submit" disabled={pending}>
                {pending && <LoaderCircle className="animate-spin" aria-hidden />}
                Сохранить
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Состояние</CardTitle>
            <CardDescription>Состояние событий и проверка заполнения конфигурации.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Последняя связь</p>
                <p className="mt-1 text-sm font-medium text-foreground">{formatDate(integration?.lastSeenAt ?? null)}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Последнее событие</p>
                <p className="mt-1 text-sm font-medium text-foreground">{formatDate(integration?.lastEventAt ?? null)}</p>
              </div>
            </div>

            {integration?.lastError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {integration.lastError}
              </div>
            )}

            <Button type="button" variant="outline" className="w-full" onClick={validateSetup} disabled={pending}>
              <RefreshCw className={pending ? "animate-spin" : ""} aria-hidden />
              Проверить настройку
            </Button>
            {integration && (
              <Button type="button" variant="destructive" className="w-full" onClick={disconnect} disabled={pending}>
                <Unplug aria-hidden />
                Отключить
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {integration && (
        <>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Webhook-адреса</CardTitle>
              <CardDescription>
                Добавьте эти адреса в FitCRM Bridge. Прямой Web Delegation включается только по
                активированной спецификации производителя.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 lg:grid-cols-2">
              <CopyField label="Приём событий" value={integration.eventUrl} />
              <CopyField label="Проверка допуска" value={integration.decisionUrl} />
              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-sm font-medium text-foreground">Webhook-ключ</label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={newWebhookKey ?? integration.webhookKeyMask}
                    className="font-mono text-xs"
                  />
                  <Button type="button" variant="outline" onClick={rotateWebhookKey} disabled={pending}>
                    <KeyRound aria-hidden />
                    Обновить
                  </Button>
                </div>
                {newWebhookKey && (
                  <p className="text-xs font-medium text-chart-3">
                    Скопируйте новый ключ сейчас — после обновления страницы он будет скрыт.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <PackageCheck className="size-5" aria-hidden />
                </div>
                <div>
                  <CardTitle>Установка FitCRM Bridge</CardTitle>
                  <CardDescription className="mt-1">
                    Готовая локальная сборка для Windows, Linux и Docker. Она работает внутри сети клуба
                    и передаёт проходы в FitCRM.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 lg:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground">1. Скачать сборку</p>
                <p className="mt-1 min-h-10 text-xs text-muted-foreground">
                  В архиве агент, установщики, Docker и документация по {meta.label}.
                </p>
                <Button
                  nativeButton={false}
                  render={<a href="/downloads/fitcrm-access-bridge.zip" download />}
                  variant="outline"
                  className="mt-4 w-full"
                >
                    <Download aria-hidden />
                    Скачать ZIP
                </Button>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground">2. Получить ключ</p>
                <p className="mt-1 min-h-10 text-xs text-muted-foreground">
                  Ключ показывается один раз и уже привязан к этому клубу и интеграции.
                </p>
                <Button type="button" variant="outline" className="mt-4 w-full" onClick={rotateWebhookKey} disabled={pending}>
                  <KeyRound aria-hidden />
                  {newWebhookKey
                    ? "Обновить ключ"
                    : integration.webhookKeyMask
                      ? "Ротировать Bridge-ключ"
                      : "Создать Bridge-ключ"}
                </Button>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground">3. Скачать конфигурацию</p>
                <p className="mt-1 min-h-10 text-xs text-muted-foreground">
                  Заполните адрес СКУД, логин, пароль и ID входного и выходного считывателя.
                </p>
                <Button
                  type="button"
                  className="mt-4 w-full"
                  onClick={downloadBridgeConfig}
                  disabled={pending || !newWebhookKey}
                >
                  <Download aria-hidden />
                  Скачать config.json
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-2 border-t text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Integration ID: <span className="font-mono text-foreground">{integration.id}</span>
              </span>
              <span>Перед запуском: <span className="font-mono text-foreground">npm run doctor</span></span>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Карты и браслеты</CardTitle>
              <CardDescription>Привяжите внешний идентификатор к клиенту FitCRM.</CardDescription>
            </CardHeader>
            <form action={addCredential}>
              <CardContent className="grid gap-3 pt-4 md:grid-cols-[minmax(12rem,1fr)_11rem_minmax(12rem,1fr)_auto]">
                <Select value={clientId} onValueChange={(value) => setClientId(value ?? "")}>
                  <SelectTrigger aria-label="Клиент">
                    <SelectValue placeholder="Выберите клиента" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={credentialType}
                  onValueChange={(value) => setCredentialType((value ?? "card") as AccessControlCredentialType)}
                >
                  <SelectTrigger aria-label="Тип идентификатора">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CREDENTIAL_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input name="credentialUid" placeholder="UID карты или браслета" aria-label="UID карты или браслета" />
                <Button type="submit" size="lg" disabled={pending || clients.length === 0}>
                  <Plus aria-hidden />
                  Добавить
                </Button>
              </CardContent>
            </form>

            {integration.credentials.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Клиент</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Идентификатор</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integration.credentials.map((credential) => (
                    <TableRow key={credential.id}>
                      <TableCell className="font-medium">{credential.clientName}</TableCell>
                      <TableCell>{CREDENTIAL_LABELS[credential.credentialType]}</TableCell>
                      <TableCell className="font-mono text-xs">{credential.credentialUid}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCredential(credential.id)}
                          disabled={pending}
                          aria-label={`Удалить привязку ${credential.clientName}`}
                        >
                          <Trash2 className="text-destructive" aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <CardContent className="pt-0">
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Пока нет привязанных карт или браслетов.
                </div>
              </CardContent>
            )}
          </Card>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Последние события</CardTitle>
                <CardDescription>Реальные и тестовые события, нормализованные FitCRM.</CardDescription>
              </CardHeader>
              {integration.events.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Время</TableHead>
                      <TableHead>Клиент / UID</TableHead>
                      <TableHead>Направление</TableHead>
                      <TableHead>Результат</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {integration.events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(event.occurredAt)}</TableCell>
                        <TableCell>
                          <p className="font-medium">{event.clientName ?? "Клиент не найден"}</p>
                          <p className="font-mono text-xs text-muted-foreground">{event.credentialUid ?? "—"}</p>
                        </TableCell>
                        <TableCell>{DIRECTION_LABELS[event.direction]}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              event.decision === "allowed"
                                ? "default"
                                : event.decision === "denied" || event.decision === "error"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className={event.decision === "allowed" ? "bg-chart-2 text-primary-foreground" : undefined}
                          >
                            {event.decision === "allowed" && <CheckCircle2 aria-hidden />}
                            {DECISION_LABELS[event.decision]}
                          </Badge>
                          {event.reasonMessage && (
                            <p className="mt-1 max-w-52 text-xs text-muted-foreground">{event.reasonMessage}</p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <CardContent className="pt-4">
                  <div className="rounded-lg border border-dashed border-border p-8 text-center">
                    <Link2 className="mx-auto mb-2 size-5 text-muted-foreground" aria-hidden />
                    <p className="text-sm text-muted-foreground">События ещё не поступали.</p>
                  </div>
                </CardContent>
              )}
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Симулятор прохода</CardTitle>
                <CardDescription>
                  Проверяет весь CRM-сценарий без подключения физического устройства.
                </CardDescription>
              </CardHeader>
              <form action={simulate}>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <label htmlFor="simulation-credential" className="text-sm font-medium text-foreground">
                      UID карты или браслета
                    </label>
                    <Input id="simulation-credential" name="simulationCredentialUid" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Направление</label>
                    <Select
                      value={simDirection}
                      onValueChange={(value) => setSimDirection((value ?? "entry") as "entry" | "exit")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entry">Вход</SelectItem>
                        <SelectItem value="exit">Выход</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {simResult && (
                    <div className="rounded-lg border border-border bg-muted p-3 text-sm font-medium text-foreground">
                      {simResult}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Тестовый вход создаёт реальное посещение и списывает один визит по абонементу.
                    Для безопасной проверки используйте отдельного тестового клиента.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={pending}>
                    <Play aria-hidden />
                    Отправить тестовое событие
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
