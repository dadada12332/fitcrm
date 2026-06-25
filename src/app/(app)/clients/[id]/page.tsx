import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Phone } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getClientProfile } from "@/lib/client-profile"
import { getActiveMemberships } from "@/lib/memberships"
import { ClientProfileCard } from "@/components/app/ClientProfileCard"
import { ClientProfileTabs } from "@/components/app/ClientProfileTabs"
import { AddClientButton } from "@/components/app/AddClientButton"

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [client, memberships] = await Promise.all([
    getClientProfile(supabase, id),
    getActiveMemberships(supabase),
  ])

  if (!client) notFound()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/clients" className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" style={{ color: "var(--on-dark-soft)" }}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>Карточка клиента</h1>
          </div>
          <p className="text-sm mt-1 flex items-center gap-1.5" style={{ color: "var(--on-dark-soft)" }}>
            {client.name}
            {client.phone && (
              <>
                <span>•</span>
                {client.phone}
                <Phone className="w-3.5 h-3.5" />
              </>
            )}
          </p>
        </div>
        <AddClientButton memberships={memberships} />
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-5 items-start">
        <ClientProfileTabs client={client} />
        <ClientProfileCard client={client} />
      </div>
    </div>
  )
}
