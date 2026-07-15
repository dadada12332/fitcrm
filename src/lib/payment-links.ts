import { getClubCredentials } from "@/lib/club-credentials"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.fitcrm.uz"

/**
 * Ссылка оплаты Click (redirect на my.click.uz).
 * amount — в сумах. transaction_param — id нашего платежа (merchant_trans_id).
 */
export async function buildClickPayUrl(clubId: string, paymentId: string, amountSum: number, returnUrl?: string): Promise<string | null> {
  const c = await getClubCredentials(clubId, "click")
  if (!c) return null
  const u = new URL("https://my.click.uz/services/pay")
  u.searchParams.set("service_id", c.service_id)
  u.searchParams.set("merchant_id", c.merchant_id)
  u.searchParams.set("amount", String(amountSum))
  u.searchParams.set("transaction_param", paymentId)
  if (returnUrl) u.searchParams.set("return_url", returnUrl)
  return u.toString()
}

/**
 * Ссылка оплаты Payme (checkout.paycom.uz).
 * Параметры кодируются base64: m=cashbox;ac.<field>=<paymentId>;a=<amount_в_тийинах>.
 */
export async function buildPaymePayUrl(clubId: string, paymentId: string, amountSum: number, returnUrl?: string): Promise<string | null> {
  const c = await getClubCredentials(clubId, "payme")
  if (!c) return null
  const amountTiyin = Math.round(amountSum * 100)
  const parts = [`m=${c.cashbox_id}`, `ac.${c.account_field || "order_id"}=${paymentId}`, `a=${amountTiyin}`]
  if (returnUrl) parts.push(`c=${returnUrl}`)
  const encoded = Buffer.from(parts.join(";"), "utf8").toString("base64")
  return `https://checkout.paycom.uz/${encoded}`
}

export { APP_URL }
