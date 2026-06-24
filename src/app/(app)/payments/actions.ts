"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { searchClientsForCheckin, type ClientSearchResult } from "@/lib/visits"

export type CreatePaymentInput = {
  clientId: string
  membershipId: string | null
  amount: number
  provider: "cash" | "click" | "payme" | "uzum"
  comment?: string
}

export type CreatePaymentResult = { ok?: boolean; error?: string }

export async function createPaymentAction(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { data: staff } = await supabase.from("staff").select("club_id").eq("user_id", user.id).single()
  if (!staff?.club_id) return { error: "Клуб не найден" }

  let subscriptionId: string | null = null

  // If membership selected — create subscription
  if (input.membershipId) {
    const { data: m } = await supabase
      .from("memberships")
      .select("duration_days, visits_limit")
      .eq("id", input.membershipId)
      .single()

    if (m) {
      const startsAt = new Date().toISOString().slice(0, 10)
      const expiresAt = new Date(Date.now() + m.duration_days * 86_400_000).toISOString().slice(0, 10)

      const { data: sub, error: subErr } = await supabase.from("subscriptions").insert({
        club_id:      staff.club_id,
        client_id:    input.clientId,
        membership_id: input.membershipId,
        starts_at:    startsAt,
        expires_at:   expiresAt,
        visits_total: m.visits_limit ?? null,
        visits_used:  0,
        status:       "active",
      }).select("id").single()

      if (subErr) return { error: subErr.message }
      subscriptionId = sub?.id ?? null
    }
  }

  const { error } = await supabase.from("payments").insert({
    club_id:         staff.club_id,
    client_id:       input.clientId,
    subscription_id: subscriptionId,
    amount:          input.amount,
    provider:        input.provider,
    status:          "paid",
    paid_at:         new Date().toISOString(),
  })

  if (error) return { error: error.message }

  revalidatePath("/payments")
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function searchClientsPayments(query: string): Promise<ClientSearchResult[]> {
  const supabase = await createClient()
  return searchClientsForCheckin(supabase, query)
}
