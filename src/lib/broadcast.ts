import type { SupabaseClient } from "@supabase/supabase-js"

// ── Аудитория ──────────────────────────────────────────────────────

export type AudienceOption = { key: string; label: string }

export type Recipient = {
  telegramId: number
  fullName: string
  membership: string | null
  membershipId: string | null
  expiresAt: string | null
  visitsLeft: number | null
  // для live-фильтрации на клиенте
  status: string | null // active | frozen | expired | null
  daysLeft: number | null
}

/** Список переменных для кнопки {} */
export const VARIABLES = [
  { token: "{{Имя}}", label: "Имя" },
  { token: "{{Название клуба}}", label: "Название клуба" },
  { token: "{{Абонемент}}", label: "Абонемент" },
  { token: "{{Дата окончания}}", label: "Дата окончания" },
  { token: "{{Осталось посещений}}", label: "Осталось посещений" },
  { token: "{{Баланс}}", label: "Баланс" },
]

export const EMOJIS = [
  "😀", "😁", "😍", "🥳", "💪", "🔥", "🎉", "✅", "⚡", "👍",
  "🏋️", "🤸", "🧘", "🏃", "💰", "🎁", "📢", "⏰", "❤️", "⭐",
  "📅", "📍", "💧", "🥤", "🏆", "👏", "🙌", "😎", "🤩", "🚀",
]

export const FIXED_AUDIENCES: AudienceOption[] = [
  { key: "all", label: "Всем" },
  { key: "active", label: "Только активным" },
  { key: "expiring", label: "Истекает через 7 дней" },
]

/** Сегменты по тарифам + ручной выбор (для селектора). */
export async function resolveAudienceOptions(supabase: SupabaseClient, clubId: string): Promise<AudienceOption[]> {
  const { data } = await supabase
    .from("memberships")
    .select("id, name")
    .eq("club_id", clubId)
    .eq("is_active", true)
    .order("name", { ascending: true })

  const tariffs = (data ?? []).map((m) => ({ key: `membership:${m.id}`, label: m.name as string }))
  return [...FIXED_AUDIENCES, ...tariffs, { key: "manual", label: "Выбрать вручную" }]
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

type Sub = {
  status: string
  expires_at: string | null
  visits_total: number | null
  visits_used: number | null
  membership_id: string | null
  memberships: { name: string } | { name: string }[] | null
}

type ClientRow = {
  id: string
  full_name: string
  telegram_id: number | null
  subscriptions: Sub[] | null
}

function pickSub(subs: Sub[] | null) {
  if (!subs?.length) return null
  return subs.find((s) => s.status === "active")
    ?? subs.find((s) => s.status === "frozen")
    ?? [...subs].sort((a, b) => (b.expires_at ?? "").localeCompare(a.expires_at ?? ""))[0]
}

function memName(m: Sub["memberships"]): string | null {
  if (!m) return null
  const o = Array.isArray(m) ? m[0] : m
  return o?.name ?? null
}

/** Полный датасет tg-подписчиков клуба — для live-подсчёта и ручного выбора на клиенте. */
export async function getRecipientsDataset(supabase: SupabaseClient, clubId: string): Promise<Recipient[]> {
  const { data } = await supabase
    .from("clients")
    .select("id, full_name, telegram_id, subscriptions(status, expires_at, visits_total, visits_used, membership_id, memberships(name))")
    .eq("club_id", clubId)
    .not("telegram_id", "is", null)

  const rows = (data ?? []) as ClientRow[]
  return rows.map((c) => {
    const sub = pickSub(c.subscriptions)
    const expiresAt = sub?.expires_at ?? null
    const status = sub?.status ?? null
    return {
      telegramId: c.telegram_id as number,
      fullName: c.full_name,
      membership: memName(sub?.memberships ?? null),
      membershipId: sub?.membership_id ?? null,
      expiresAt,
      visitsLeft: sub && sub.visits_total != null ? sub.visits_total - (sub.visits_used ?? 0) : null,
      status,
      daysLeft: status === "active" || status === "frozen" ? daysUntil(expiresAt) : null,
    }
  })
}

/** Фильтр получателей по аудитории (server-side, для реальной отправки). */
export function filterByAudience(
  recipients: Recipient[],
  audience: string,
  manualIds?: number[],
): Recipient[] {
  if (audience === "all") return recipients
  if (audience === "active") return recipients.filter((r) => r.status === "active")
  if (audience === "expiring") return recipients.filter((r) => r.status === "active" && r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 7)
  if (audience === "manual") {
    const set = new Set(manualIds ?? [])
    return recipients.filter((r) => set.has(r.telegramId))
  }
  if (audience.startsWith("membership:")) {
    const id = audience.slice("membership:".length)
    return recipients.filter((r) => r.membershipId === id)
  }
  return recipients
}

/** Отправка рассылки списку получателей через Telegram API. Возвращает счётчики. */
export async function sendBroadcast(
  token: string,
  recipients: Recipient[],
  message: string,
  imageUrl: string | null,
  clubName: string,
): Promise<{ delivered: number; failed: number }> {
  let delivered = 0
  let failed = 0
  for (const r of recipients) {
    const text = personalize(message ?? "", r, clubName)
    try {
      let res: Response
      if (imageUrl) {
        res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: r.telegramId, photo: imageUrl, caption: text || undefined }),
        })
      } else {
        res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: r.telegramId, text }),
        })
      }
      const j = await res.json()
      if (j.ok) delivered++
      else failed++
    } catch {
      failed++
    }
  }
  return { delivered, failed }
}

/** Подстановка переменных в текст для конкретного получателя. */
export function personalize(text: string, r: Recipient, clubName: string): string {
  if (!text) return text
  const firstName = r.fullName.split(" ")[0] || r.fullName
  const expires = r.expiresAt
    ? new Date(r.expiresAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })
    : "—"
  return text
    .replaceAll("{{Имя}}", firstName)
    .replaceAll("{{Название клуба}}", clubName)
    .replaceAll("{{Абонемент}}", r.membership ?? "—")
    .replaceAll("{{Дата окончания}}", expires)
    .replaceAll("{{Осталось посещений}}", r.visitsLeft != null ? String(r.visitsLeft) : "∞")
    .replaceAll("{{Баланс}}", "0")
}
