"use client"

import { useState } from "react"

/** Только цифры из строки. */
function digitsOf(s: string): string {
  return String(s ?? "").replace(/\D/g, "")
}
/** Группировка разрядов: "1000000" → "1 000 000". */
function grouped(d: string): string {
  return d ? Number(d).toLocaleString("ru-RU") : ""
}

type Props = {
  /** Имя скрытого поля — для форм на FormData. Значение — «сырое» число (без пробелов). */
  name?: string
  /** Контролируемое значение (число или строка-число). */
  value?: number | string
  /** Начальное значение для неконтролируемого режима (FormData-формы). */
  defaultValue?: number | string
  /** Колбэк с числом при вводе (для контролируемых форм). */
  onChange?: (value: number) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  required?: boolean
  autoFocus?: boolean
  disabled?: boolean
  /** Приписка в конце (по умолчанию «сум»). Пустая строка — без приписки. */
  suffix?: string
  /** Цвет приписки (по умолчанию токен var(--on-dark-soft)). */
  suffixColor?: string
}

/**
 * Инпут денежной суммы: при вводе разбивает число по разрядам (1 000 / 100 000)
 * и показывает приписку «сум» вторичным цветом. Работает и в контролируемом режиме
 * (value/onChange), и в FormData-формах (name + defaultValue → скрытый input с числом).
 */
export function MoneyInput({
  name, value, defaultValue, onChange, placeholder,
  className, style, required, autoFocus, disabled, suffix = "сум", suffixColor = "var(--on-dark-soft)",
}: Props) {
  const controlled = value !== undefined
  const [inner, setInner] = useState<string>(() => digitsOf(String(defaultValue ?? "")))
  const raw = controlled ? digitsOf(String(value ?? "")) : inner
  const display = grouped(raw)

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const d = digitsOf(e.target.value)
    if (!controlled) setInner(d)
    onChange?.(d ? parseInt(d, 10) : 0)
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handle}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        className={className}
        style={{ ...style, paddingRight: suffix ? 46 : (style?.paddingRight as number | undefined) }}
      />
      {suffix && (
        <span
          className="absolute top-1/2 -translate-y-1/2 text-sm pointer-events-none"
          style={{ right: 12, color: suffixColor }}
        >
          {suffix}
        </span>
      )}
      {name && <input type="hidden" name={name} value={raw || "0"} />}
    </div>
  )
}
