import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, Phone } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getCurrentClub } from "@/lib/club"
import { getClientProfile } from "@/lib/client-profile"
import { getActiveMemberships } from "@/lib/memberships"
import { ClientProfileCard } from "@/components/app/ClientProfileCard"
import { ClientProfileTabs } from "@/components/app/ClientProfileTabs"
import { EditClientButton } from "@/components/app/EditClientButton"

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const club = await getCurrentClub()
  if (!club) redirect("/onboarding")
  if (!club.permissions.clients.view) redirect("/dashboard")
  const canViewPayments = club.permissions.payments.view
  const canSellMembership = club.permissions.memberships.sell || club.permissions.clients.extend
  const [client, memberships] = await Promise.all([
    getClientProfile(supabase, id, club.clubId, {
      includePayments: canViewPayments,
      includeVisits: club.permissions.visits.view,
      includeFinancials: canViewPayments || club.permissions.dashboard.view_finance,
    }),
    canSellMembership ? getActiveMemberships(supabase, club.clubId) : Promise.resolve([]),
  ])

  if (!client) notFound()

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href="/clients"
              aria-label="Вернуться к клиентам"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <h1 className="truncate text-2xl font-semibold tracking-[-0.144px] text-foreground">{client.name}</h1>
          </div>
          <p className="ml-10 mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            Карточка клиента
            {client.phone && (
              <>
                <span>•</span>
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-1 text-brand hover:underline"
                >
                  {client.phone}
                  <Phone className="size-3.5" />
                </a>
              </>
            )}
          </p>
        </div>
        {club.permissions.clients.edit && (
          <div className="w-full sm:w-auto [&>button]:w-full sm:[&>button]:w-auto">
            <EditClientButton client={client} />
          </div>
        )}
      </div>

      <ClientProfileTabs
        client={client}
        canExport={club.permissions.payments.export}
        canViewVisits={club.permissions.visits.view}
        canViewPayments={canViewPayments}
        sidePanel={
          <ClientProfileCard
            client={client}
            memberships={memberships}
            canCreatePayment={club.permissions.payments.create}
            canExtend={canSellMembership}
            canFreeze={club.permissions.clients.freeze}
            canDelete={club.permissions.clients.delete}
            showFinancials={canViewPayments || club.permissions.dashboard.view_finance}
          />
        }
      />
    </div>
  )
}
