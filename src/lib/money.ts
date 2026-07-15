// Единый формат денег для тарифов (без серверных зависимостей — можно в client).
// В БД валюта хранится кодом (USD/UZS), в UI показываем символ/«сум».
export function fmtMoney(price: number, currency: string): string {
  const n = price.toLocaleString("ru-RU")
  if (currency === "USD") return `$${n}`
  if (currency === "UZS") return `${n} сум`
  return `${n} ${currency}`
}

/** Короткая метка периода. */
export const PERIOD_SHORT: Record<string, string> = { monthly: "мес", quarterly: "кв", yearly: "год" }
