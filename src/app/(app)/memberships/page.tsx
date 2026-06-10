import { createClient } from "@/lib/supabase/server"
import { MembershipForm } from "@/components/app/MembershipForm"

type MembershipRow = {
  id: string
  name: string
  price: number
  duration_days: number
  visits_limit: number | null
  is_active: boolean
}

function formatSum(n: number) {
  return n.toLocaleString("ru-RU")
}

export default async function MembershipsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("memberships")
    .select("id, name, price, duration_days, visits_limit, is_active")
    .order("created_at", { ascending: false })

  const list = (data ?? []) as MembershipRow[]

  return (
    <div>
      <h1 className="text-3xl mb-1" style={{ color: "var(--on-dark)" }}>Абонементы</h1>
      <p className="text-sm mb-8" style={{ color: "var(--on-dark-soft)" }}>
        Типы абонементов: {list.length}
      </p>

      <div className="grid lg:grid-cols-[1fr_2fr] gap-6 items-start">
        <MembershipForm />

        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          {list.length === 0 ? (
            <div className="p-8 text-sm text-center" style={{ color: "var(--on-dark-soft)" }}>
              Пока нет абонементов. Создайте первый слева.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left font-medium px-5 py-3" style={{ color: "var(--on-dark-soft)" }}>Название</th>
                  <th className="text-left font-medium px-5 py-3" style={{ color: "var(--on-dark-soft)" }}>Цена</th>
                  <th className="text-left font-medium px-5 py-3" style={{ color: "var(--on-dark-soft)" }}>Срок</th>
                  <th className="text-left font-medium px-5 py-3" style={{ color: "var(--on-dark-soft)" }}>Визиты</th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="px-5 py-3" style={{ color: "var(--on-dark)" }}>{m.name}</td>
                    <td className="px-5 py-3" style={{ color: "var(--on-dark-soft)" }}>{formatSum(m.price)} сум</td>
                    <td className="px-5 py-3" style={{ color: "var(--on-dark-soft)" }}>{m.duration_days} дн.</td>
                    <td className="px-5 py-3" style={{ color: "var(--on-dark-soft)" }}>{m.visits_limit ?? "Безлимит"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
