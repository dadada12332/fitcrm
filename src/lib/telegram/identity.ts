export function normalizeTelegramPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.startsWith("998") && digits.length === 12) return digits.slice(3)
  if ((digits.startsWith("7") || digits.startsWith("8")) && digits.length === 11) return digits.slice(1)
  return digits
}

export function telegramDisplayName(identity: { firstName?: string | null; lastName?: string | null }) {
  return [identity.firstName, identity.lastName].filter(Boolean).join(" ").trim()
}
