import type { StatementRow } from "@/lib/reconcile"
import { getClubCredentials } from "@/lib/club-credentials"

/**
 * Запрос выписки эквайринга у провайдера за период [from, to].
 *
 * ⚠️ Точный отчётный эндпоинт и подпись у Click/Payme нужно подтвердить по их
 * бизнес-докам / у интеграционного менеджера — публичная дока, что мы читали
 * (Click SHOP API / Payme Merchant JSON-RPC), это инвойс-сторона, не отчётная.
 * Ниже — единая точка, куда подставляется реальный запрос. Пока возвращает [].
 */
export async function fetchStatement(
  clubId: string, provider: "click" | "payme", from: Date, to: Date,
): Promise<StatementRow[]> {
  if (provider === "click") return fetchClickStatement(clubId, from, to)
  return fetchPaymeStatement(clubId, from, to)
}

async function fetchClickStatement(clubId: string, _from: Date, _to: Date): Promise<StatementRow[]> {
  const creds = await getClubCredentials(clubId, "click")
  if (!creds) return []
  // TODO: реальный запрос к отчётному API Click (merchant_user_id + service_id + secret_key, подпись md5).
  // Ожидаемый маппинг ответа → StatementRow: { externalId, amount(сум), paidAt(ISO), cardMask, payerName, raw }.
  return []
}

async function fetchPaymeStatement(clubId: string, _from: Date, _to: Date): Promise<StatementRow[]> {
  const creds = await getClubCredentials(clubId, "payme")
  if (!creds) return []
  // TODO: реальный запрос к Payme Business API (ключ бизнес-аккаунта).
  // Ответ приходит в тийинах — делить на 100 при маппинге в amount(сум).
  return []
}
