import type { ClientProfile } from "@/lib/client-profile"
import type { ClientStatus } from "@/lib/clients"

const statusMeta: Record<ClientStatus, { label: string; bg: string; color: string }> = {
  active: { label: "Активный", bg: "#dcfce7", color: "#16a34a" },
  expired: { label: "Истёк", bg: "#fee2e2", color: "#dc2626" },
  frozen: { label: "Заморожен", bg: "#dbeafe", color: "#2563eb" },
  none: { label: "Без абонемента", bg: "#f1f5f9", color: "#64748b" },
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function Field({ label, value, link }: { label: string; value: string | null; link?: string }) {
  return (
    <div className="py-3" style={{ borderTop: "1px solid #f1f5f9" }}>
      <p className="text-xs mb-1" style={{ color: "#94a3b8" }}>{label}</p>
      {link && value ? (
        <a href={link} className="text-sm font-medium hover:underline" style={{ color: "#2563eb" }}>{value}</a>
      ) : (
        <p className="text-sm font-medium" style={{ color: "#334155" }}>{value ?? "—"}</p>
      )}
    </div>
  )
}

export function ClientProfileCard({ client }: { client: ClientProfile }) {
  const sm = statusMeta[client.status]
  const comment = client.notes && client.notes !== "[demo]" ? client.notes : ""

  return (
    <div className="rounded-lg p-6 flex flex-col" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      {/* Аватар + имя */}
      <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-semibold text-white mb-4"
        style={{ background: "#60a5fa" }}>
        {initials(client.name)}
      </div>

      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-xl font-semibold tracking-[-0.12px]" style={{ color: "#020617" }}>{client.name}</h2>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: sm.bg, color: sm.color }}>
          {sm.label}
        </span>
      </div>
      <p className="text-sm mb-2" style={{ color: "#64748b" }}>Баланс: 0 сум</p>

      {/* Поля */}
      <div className="flex flex-col">
        <Field label="Телефон" value={client.phone} link={client.phone ? `tel:${client.phone}` : undefined} />
        <Field label="Телеграм" value={client.telegram} />
        <Field label="Источник" value={null} />
        <Field label="Цель" value={null} />
        <Field label="Тренер" value={null} />
        <Field label="Дата регистрации" value={fmtDate(client.createdAt)} />
        <Field label="Пол" value={null} />
      </div>

      {/* Комментарий */}
      <div className="py-3" style={{ borderTop: "1px solid #f1f5f9" }}>
        <p className="text-xs mb-2" style={{ color: "#94a3b8" }}>Комментарий</p>
        <textarea
          readOnly
          defaultValue={comment}
          placeholder="Нет комментария"
          rows={3}
          className="w-full rounded-md px-3 py-2 text-sm resize-none outline-none"
          style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#334155" }}
        />
      </div>

      {/* Действия */}
      <div className="flex flex-col gap-2 mt-2">
        <button className="h-11 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "#0f172a" }}>
          Добавить оплату
        </button>
        <button className="h-11 rounded-md text-sm font-medium transition-colors hover:bg-slate-50"
          style={{ background: "white", border: "1px solid #e2e8f0", color: "#334155" }}>
          Заморозить
        </button>
        <button className="h-11 rounded-md text-sm font-medium transition-colors hover:bg-red-50"
          style={{ background: "white", border: "1px solid #fecaca", color: "#dc2626" }}>
          Удалить клиента
        </button>
      </div>
    </div>
  )
}
