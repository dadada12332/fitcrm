import { createServiceClient } from "@/lib/supabase/service"
import { decryptSecret } from "@/lib/crypto"

export type ClickCredentials = { merchant_id: string; service_id: string; merchant_user_id: string; secret_key: string }
export type PaymeCredentials = { cashbox_id: string; key: string; test_key: string; account_field: string }

/** Расшифрованные креды мерчанта клуба (только server-side, для эндпоинтов приёма). null если не подключено. */
export async function getClubCredentials(clubId: string, provider: "click"): Promise<ClickCredentials | null>
export async function getClubCredentials(clubId: string, provider: "payme"): Promise<PaymeCredentials | null>
export async function getClubCredentials(clubId: string, provider: "click" | "payme"): Promise<ClickCredentials | PaymeCredentials | null> {
  const s = createServiceClient()
  const { data } = await s.from("club_payment_credentials")
    .select("enabled, secret_enc").eq("club_id", clubId).eq("provider", provider).maybeSingle()
  if (!data?.enabled || !data.secret_enc) return null
  try {
    return JSON.parse(decryptSecret(data.secret_enc))
  } catch {
    return null
  }
}
