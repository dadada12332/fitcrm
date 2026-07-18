"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  BarChart3,
  CalendarClock,
  Command,
  LoaderCircle,
  Package,
  Paperclip,
  Search,
  Send,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CommandItem = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  prefix: string
  query: string
}

const COMMANDS: CommandItem[] = [
  { icon: BarChart3, label: "Выручка", description: "сегодня или за период", prefix: "/выручка", query: "какая выручка сегодня" },
  { icon: Users, label: "Должники", description: "клиенты и сумма долга", prefix: "/должники", query: "покажи должников" },
  { icon: CalendarClock, label: "Истекающие", description: "продления на 7 дней", prefix: "/истекают", query: "у кого заканчивается абонемент за 7 дней" },
  { icon: Package, label: "Остатки", description: "низкий запас товаров", prefix: "/остатки", query: "что заканчивается на складе" },
  { icon: Search, label: "Найти клиента", description: "по имени или телефону", prefix: "/клиент", query: "найди клиента " },
]

function useAutoResize(min: number, max: number) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const adjust = useCallback((reset = false) => {
    const textarea = ref.current
    if (!textarea) return
    textarea.style.height = `${min}px`
    if (!reset) textarea.style.height = `${Math.max(min, Math.min(textarea.scrollHeight, max))}px`
  }, [max, min])
  return { ref, adjust }
}

export function AiComposer({ onSend, pending, autoFocus }: {
  onSend: (text: string, image: string | null) => void
  pending: boolean
  autoFocus?: boolean
}) {
  const [value, setValue] = useState("")
  const [image, setImage] = useState<{ name: string; url: string } | null>(null)
  const [fileError, setFileError] = useState("")
  const [showPalette, setShowPalette] = useState(false)
  const [active, setActive] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const { ref: textareaRef, adjust } = useAutoResize(48, 160)

  const filtered = value.startsWith("/") && !value.includes(" ")
    ? COMMANDS.filter((item) => item.prefix.startsWith(value.toLowerCase()))
    : COMMANDS

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(event.target as Node)) setShowPalette(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  function pickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setFileError("")
    if (!file.type.startsWith("image/")) {
      setFileError("Можно прикрепить только изображение")
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setFileError("Изображение должно быть меньше 8 МБ")
      return
    }
    const reader = new FileReader()
    reader.onload = () => setImage({ name: file.name, url: String(reader.result) })
    reader.readAsDataURL(file)
  }

  function chooseCommand(item: CommandItem) {
    setShowPalette(false)
    if (item.prefix === "/клиент") {
      setValue(item.query)
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
        adjust()
      })
      return
    }
    submit(item.query)
  }

  function submit(text = value) {
    const content = text.trim()
    if ((!content && !image) || pending) return
    onSend(content, image?.url ?? null)
    setValue("")
    setImage(null)
    setFileError("")
    adjust(true)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showPalette && filtered.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setActive((current) => (current + 1) % filtered.length)
        return
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        setActive((current) => (current - 1 + filtered.length) % filtered.length)
        return
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault()
        chooseCommand(filtered[active])
        return
      }
      if (event.key === "Escape") {
        event.preventDefault()
        setShowPalette(false)
        return
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="relative w-full">
      {showPalette && filtered.length > 0 && (
        <div ref={paletteRef} className="absolute inset-x-0 bottom-full z-50 mb-2 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">Быстрые запросы</div>
          <div className="p-1">
            {filtered.map((item, index) => {
              const Icon = item.icon
              return (
                <button
                  key={item.prefix}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => chooseCommand(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                    active === index ? "bg-muted" : "hover:bg-muted",
                  )}
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">{item.description}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{item.prefix}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-input bg-background shadow-sm transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
        {image && (
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" className="size-10 rounded-md object-cover" />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{image.name}</span>
            <Button type="button" variant="ghost" size="icon-xs" onClick={() => setImage(null)} aria-label="Удалить изображение">
              <X />
            </Button>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          autoFocus={autoFocus}
          rows={1}
          onChange={(event) => {
            const nextValue = event.target.value
            setValue(nextValue)
            setShowPalette(nextValue.startsWith("/") && !nextValue.includes(" "))
            setActive(0)
            adjust()
          }}
          onKeyDown={onKeyDown}
          placeholder="Спросите о клубе или введите / для команд"
          className="block min-h-12 w-full resize-none bg-transparent px-3 pt-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />

        <div className="flex min-h-11 items-center justify-between gap-2 px-2 pb-2">
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} aria-label="Прикрепить изображение" title="Прикрепить изображение">
              <Paperclip />
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
            <Button
              type="button"
              variant={showPalette ? "secondary" : "ghost"}
              size="icon"
              onClick={() => {
                setShowPalette((open) => !open)
                if (!value.startsWith("/")) setValue("/")
              }}
              aria-label="Открыть быстрые команды"
              title="Быстрые команды"
            >
              <Command />
            </Button>
            {fileError && <span className="pl-1 text-xs text-destructive">{fileError}</span>}
          </div>
          <Button type="button" size="lg" onClick={() => submit()} disabled={pending || (!value.trim() && !image)}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Send />}
            <span className="hidden sm:inline">Отправить</span>
          </Button>
        </div>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-muted-foreground">Ответы строятся только по данным вашего клуба</p>
    </div>
  )
}
