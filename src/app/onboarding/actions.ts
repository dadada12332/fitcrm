"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type OnboardingState = { error?: string }

export async function createClubAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const name = String(formData.get("name") ?? "").trim()
  const city = String(formData.get("city") ?? "").trim()

  if (!name) {
    return { error: "Введите название клуба" }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("create_club", {
    p_name: name,
    p_city: city || null,
  })

  if (error) {
    return { error: error.message }
  }

  redirect("/dashboard")
}
