import { createClient } from "@/lib/supabase/server"
import { ClientForm } from "@/components/app/ClientForm"

type ClientRow = {
  id: string
  full_name: string
  phone: string | null
  tags: string[]
  created_at: string
}

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name, phone, tags, created_at")
    .order("created_at", { ascending: false })

  const list = (clients ?? []) as ClientRow[]

  return (
    <div>
      <h1 className="text-3xl mb-1" style={{ color: "var(--on-dark)" }}>Клиенты</h1>
      <p className="text-sm mb-8" style={{ color: "var(--on-dark-soft)" }}>
        Всего: {list.length}
      </p>

      <div className="grid lg:grid-cols-[1fr_2fr] gap-6 items-start">
        <ClientForm />

        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          {list.length === 0 ? (
            <div className="p-8 text-sm text-center" style={{ color: "var(--on-dark-soft)" }}>
              Пока нет клиентов. Добавьте первого слева.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left font-medium px-5 py-3" style={{ color: "var(--on-dark-soft)" }}>ФИО</th>
                  <th className="text-left font-medium px-5 py-3" style={{ color: "var(--on-dark-soft)" }}>Телефон</th>
                  <th className="text-left font-medium px-5 py-3" style={{ color: "var(--on-dark-soft)" }}>Теги</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="px-5 py-3" style={{ color: "var(--on-dark)" }}>{c.full_name}</td>
                    <td className="px-5 py-3" style={{ color: "var(--on-dark-soft)" }}>{c.phone ?? "—"}</td>
                    <td className="px-5 py-3" style={{ color: "var(--on-dark-soft)" }}>
                      {c.tags?.length ? c.tags.join(", ") : "—"}
                    </td>
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
