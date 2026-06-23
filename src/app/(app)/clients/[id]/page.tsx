import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Phone } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getClientProfile } from "@/lib/client-profile"
import { ClientProfileCard } from "@/components/app/ClientProfileCard"
import { ClientProfileTabs } from "@/components/app/ClientProfileTabs"
import { AddClientButton } from "@/components/app/AddClientButton"

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const client = await getClientProfile(supabase, id)

  if (!client) notFound()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/clients" className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors" style={{ color: "#64748b" }}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "#020617" }}>Карточка клиента</h1>
          </div>
          <p className="text-sm mt-1 flex items-center gap-1.5" style={{ color: "#64748b" }}>
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
        <AddClientButton />
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">
        <ClientProfileCard client={client} />
        <ClientProfileTabs client={client} />
      </div>
    </div>
  )
}
