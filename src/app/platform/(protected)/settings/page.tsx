import { getPlatformAuth } from "@/lib/platform"
import { Panel, PageHeader, PT } from "@/components/platform/parts"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const auth = await getPlatformAuth()

  const rows = [
    { label: "Ваш email", value: auth?.email ?? "—" },
    { label: "Роль на платформе", value: auth?.role === "super_admin" ? "Super Admin" : "Platform Admin" },
    { label: "Домен Platform", value: process.env.NEXT_PUBLIC_ADMIN_URL || "admin.fitcrm.uz" },
    { label: "Домен CRM", value: process.env.NEXT_PUBLIC_APP_URL || "app.fitcrm.uz" },
  ]

  return (
    <div className="p-6 lg:p-8 max-w-[800px] mx-auto">
      <PageHeader title="Настройки платформы" subtitle="Параметры и информация об окружении" />
      <Panel>
        <div className="px-4 h-12 flex items-center" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
          <span className="text-sm font-semibold text-white">Аккаунт и окружение</span>
        </div>
        <div className="p-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-2.5 py-3" style={{ borderBottom: i < rows.length - 1 ? `1px solid ${PT.panelBorder}` : "none" }}>
              <span className="text-sm" style={{ color: PT.textMuted }}>{r.label}</span>
              <span className="text-sm text-white">{r.value}</span>
            </div>
          ))}
        </div>
      </Panel>
      <p className="text-xs mt-4" style={{ color: PT.textMuted }}>
        Управление списком администраторов платформы, тарифными ценами и глобальными фиче-флагами будет добавлено здесь.
      </p>
    </div>
  )
}
