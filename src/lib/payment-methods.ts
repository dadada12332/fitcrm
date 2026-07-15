import { createServiceClient } from "@/lib/supabase/service"

export type PayMethodKey = "cash" | "card" | "click" | "payme" | "uzum"
export type PayMethod = {
  key: PayMethodKey
  label: string
  available: boolean   // можно ли выбрать (наличные всегда; online — только если интегрирован)
  online: boolean      // поддерживает онлайн-оплату (QR/ссылка)
  note?: string        // напр. «не подключён»
}

const LABELS: Record<PayMethodKey, string> = { cash: "Наличные", card: "Карта", click: "Click", payme: "Payme", uzum: "Uzum" }
const ORDER: PayMethodKey[] = ["cash", "card", "click", "payme", "uzum"]
const ONLINE = new Set<PayMethodKey>(["click", "payme"])

/**
 * Доступные методы оплаты клуба = включённые в настройках (settings.finance.methods)
 * с учётом интеграции: наличные всегда доступны; Click/Payme доступны только если
 * подключены (club_payment_credentials.enabled), иначе показываются disabled.
 */
export async function getPaymentMethods(clubId: string): Promise<PayMethod[]> {
  const svc = createServiceClient()
  const [{ data: clubRow }, { data: creds }] = await Promise.all([
    svc.from("clubs").select("settings").eq("id", clubId).maybeSingle(),
    svc.from("club_payment_credentials").select("provider").eq("club_id", clubId).eq("enabled", true),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enabled = new Set<string>((clubRow?.settings as any)?.finance?.methods ?? ["cash", "click", "payme", "uzum"])
  enabled.add("cash") // наличные всегда доступны
  const connected = new Set((creds ?? []).map((c: { provider: string }) => c.provider))

  return ORDER.filter((k) => enabled.has(k)).map((k) => {
    const online = ONLINE.has(k)
    const available = k === "cash" ? true : online ? connected.has(k) : true
    return { key: k, label: LABELS[k], available, online, note: online && !connected.has(k) ? "не подключён" : undefined }
  })
}
