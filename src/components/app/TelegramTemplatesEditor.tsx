"use client"

import { useRef, useState } from "react"
import { CalendarClock, Check, CircleDollarSign, RotateCcw, UserRoundPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DEFAULT_TG_SETTINGS, type TelegramSettings } from "@/app/(app)/integrations/types"
import { cn } from "@/lib/utils"

export type TelegramTemplateKey = "welcome_message" | "expiry_template" | "payment_template"

type TemplateValues = Pick<TelegramSettings, TelegramTemplateKey>

type TemplateVariable = {
  key: string
  label: string
  sample: string
}

const TEMPLATE_META: Array<{
  key: TelegramTemplateKey
  title: string
  trigger: string
  description: string
  icon: typeof UserRoundPlus
  variables: TemplateVariable[]
}> = [
  {
    key: "welcome_message",
    title: "Приветствие",
    trigger: "После привязки клиента",
    description: "Первое сообщение после команды /start и подтверждения номера.",
    icon: UserRoundPlus,
    variables: [
      { key: "name", label: "Имя", sample: "Алина" },
      { key: "club", label: "Клуб", sample: "FitCity" },
      { key: "expires", label: "Дата окончания", sample: "31.08.2026" },
    ],
  },
  {
    key: "expiry_template",
    title: "Абонемент заканчивается",
    trigger: "За 3 или 1 день",
    description: "Автоматическое напоминание перед окончанием активного абонемента.",
    icon: CalendarClock,
    variables: [
      { key: "name", label: "Имя", sample: "Алина" },
      { key: "club", label: "Клуб", sample: "FitCity" },
      { key: "days", label: "Осталось дней", sample: "3" },
      { key: "expires", label: "Дата окончания", sample: "31.08.2026" },
    ],
  },
  {
    key: "payment_template",
    title: "Оплата принята",
    trigger: "После подтверждения оплаты",
    description: "Чек об успешной оплате и новом сроке действия абонемента.",
    icon: CircleDollarSign,
    variables: [
      { key: "amount", label: "Сумма", sample: "590 000" },
      { key: "membership", label: "Абонемент", sample: "Standard · 30 дней" },
      { key: "expires", label: "Дата окончания", sample: "31.08.2026" },
    ],
  },
]

function renderPreview(value: string, variables: TemplateVariable[]) {
  return variables.reduce(
    (text, variable) => text.replaceAll(`{{${variable.key}}}`, variable.sample),
    value,
  )
}

function unknownVariables(value: string, variables: TemplateVariable[]) {
  const allowed = new Set(variables.map((variable) => variable.key))
  return [...value.matchAll(/\{\{([^{}]+)\}\}/g)]
    .map((match) => match[1].trim().toLowerCase())
    .filter((key, index, keys) => !allowed.has(key) && keys.indexOf(key) === index)
}

export function TelegramTemplatesEditor({
  values,
  savedValues,
  connected,
  pending,
  clubName,
  onChange,
  onSave,
}: {
  values: TemplateValues
  savedValues: TemplateValues
  connected: boolean
  pending: boolean
  clubName: string
  onChange: (key: TelegramTemplateKey, value: string) => void
  onSave: () => void
}) {
  const [selected, setSelected] = useState<TelegramTemplateKey>("welcome_message")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const active = TEMPLATE_META.find((template) => template.key === selected) ?? TEMPLATE_META[0]
  const value = values[selected]
  const dirtyKeys = TEMPLATE_META.filter((template) => values[template.key] !== savedValues[template.key]).map((template) => template.key)
  const hasInvalidTemplate = TEMPLATE_META.some((template) => (
    !values[template.key].trim()
    || values[template.key].length > 4096
    || unknownVariables(values[template.key], template.variables).length > 0
  ))
  const currentUnknownVariables = unknownVariables(value, active.variables)
  const previewVariables = active.variables.map((variable) => variable.key === "club" ? { ...variable, sample: clubName } : variable)
  const preview = renderPreview(value, previewVariables)

  function insertVariable(variable: string) {
    const input = textareaRef.current
    const token = `{{${variable}}}`
    const start = input?.selectionStart ?? value.length
    const end = input?.selectionEnd ?? value.length
    onChange(selected, `${value.slice(0, start)}${token}${value.slice(end)}`)
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Шаблоны сообщений</h2>
            {dirtyKeys.length > 0 && (
              <span className="rounded-full bg-chart-3/10 px-2 py-0.5 text-[11px] font-medium text-chart-3">
                Не сохранено: {dirtyKeys.length}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Выберите событие, настройте текст и сразу проверьте результат.</p>
        </div>
        <Button onClick={onSave} disabled={!connected || pending || dirtyKeys.length === 0 || hasInvalidTemplate}>
          <Check />
          {pending ? "Сохранение…" : "Сохранить изменения"}
        </Button>
      </div>

      {!connected && (
        <div className="border-b border-border bg-chart-3/10 px-5 py-3 text-sm text-chart-3">
          Подключите бота на вкладке «Основное», чтобы сохранить шаблоны.
        </div>
      )}

      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        <div className="border-b border-border p-3 lg:border-b-0 lg:border-r">
          <p className="px-2 pb-2 text-[11px] font-medium uppercase text-muted-foreground">Сценарий отправки</p>
          <div className="grid gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {TEMPLATE_META.map((template) => {
              const Icon = template.icon
              const isActive = template.key === selected
              const isDirty = dirtyKeys.includes(template.key)
              return (
                <button
                  key={template.key}
                  type="button"
                  onClick={() => setSelected(template.key)}
                  className={cn(
                    "flex min-w-0 items-start gap-3 rounded-md px-3 py-3 text-left transition-colors",
                    isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md border", isActive ? "border-brand/20 bg-brand/10 text-brand" : "border-border bg-background")}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{template.title}</span>
                      {isDirty && <span className="size-1.5 shrink-0 rounded-full bg-chart-3" aria-label="Есть изменения" />}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] opacity-75">{template.trigger}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-w-0 border-b border-border p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{active.title}</h3>
              <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">{active.description}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Вернуть стандартный текст"
              onClick={() => onChange(selected, DEFAULT_TG_SETTINGS[selected])}
              disabled={value === DEFAULT_TG_SETTINGS[selected]}
            >
              <RotateCcw />
            </Button>
          </div>

          <div className="mt-4">
            <label htmlFor={`telegram-template-${selected}`} className="text-xs font-medium text-foreground">Текст сообщения</label>
            <Textarea
              ref={textareaRef}
              id={`telegram-template-${selected}`}
              value={value}
              onChange={(event) => onChange(selected, event.target.value)}
              rows={9}
              maxLength={4096}
              className="mt-2 min-h-52 resize-none font-mono leading-6"
              aria-invalid={!value.trim() || value.length > 4096}
            />
            <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px]">
              <span className={cn((!value.trim() || currentUnknownVariables.length > 0) ? "text-destructive" : "text-muted-foreground")}>
                {!value.trim()
                  ? "Сообщение не может быть пустым"
                  : currentUnknownVariables.length > 0
                    ? `Неизвестные переменные: ${currentUnknownVariables.map((key) => `{{${key}}}`).join(", ")}`
                    : "Telegram поддерживает до 4096 символов"}
              </span>
              <span className="shrink-0 text-muted-foreground">{value.length} / 4096</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium text-foreground">Вставить переменную</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {active.variables.map((variable) => (
                <button
                  key={variable.key}
                  type="button"
                  onClick={() => insertVariable(variable.key)}
                  className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  title={`Подставится: ${variable.sample}`}
                >
                  {variable.label} <span className="font-mono text-muted-foreground">{`{{${variable.key}}}`}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-muted/40 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-foreground">Предпросмотр</p>
            <span className="text-[11px] text-muted-foreground">Telegram</span>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-border bg-background">
            <div className="flex items-center gap-3 border-b border-border px-3 py-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
                {(clubName.trim()[0] || "F").toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">{clubName}</p>
                <p className="text-[10px] text-muted-foreground">бот</p>
              </div>
            </div>
            <div className="min-h-64 bg-muted/60 p-3">
              <div className="max-w-[92%] rounded-lg rounded-tl-sm bg-card px-3 py-2.5 text-sm leading-5 text-foreground shadow-xs">
                <p className="whitespace-pre-wrap break-words">{preview || "Введите текст сообщения"}</p>
                <p className="mt-1 text-right text-[10px] text-muted-foreground">сейчас</p>
              </div>
              {selected === "expiry_template" && (
                <div className="mt-1.5 max-w-[92%] rounded-md border border-border bg-card px-3 py-2 text-center text-xs font-medium text-brand">
                  Открыть абонемент
                </div>
              )}
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
            Для примера переменные заменены тестовыми данными. Клиент получит свои значения.
          </p>
        </div>
      </div>
    </div>
  )
}
