import { notFound } from "next/navigation"
import { canPlatform, getPlatformAdmins, getPlatformAuth, getPlatformOperationalSettings } from "@/lib/platform"
import { Panel, PageHeader } from "@/components/platform/parts"
import { PlatformAdminsManager } from "@/components/platform/PlatformAdminsManager"
import { PlatformOperationalSettings } from "@/components/platform/PlatformOperationalSettings"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const auth = await getPlatformAuth()
  if (!auth || !canPlatform(auth, "settings.manage")) notFound()
  const [admins, operational] = auth?.role === "super_admin"
    ? await Promise.all([getPlatformAdmins(), getPlatformOperationalSettings()])
    : [[], null]

  const rows = [
    { label: "Ваш email", value: auth?.email ?? "—" },
    { label: "Роль на платформе", value: auth?.role === "super_admin" ? "Super Admin" : "Platform Admin" },
    { label: "Домен Platform", value: process.env.NEXT_PUBLIC_ADMIN_URL || "admin.fitcrm.uz" },
    { label: "Домен CRM", value: process.env.NEXT_PUBLIC_APP_URL || "app.fitcrm.uz" },
  ]

  return (
    <div className="mx-auto max-w-[1000px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Настройки платформы" subtitle="Доступ команды и параметры окружения" />
      <Panel>
        <div className="flex h-12 items-center border-b border-border px-4">
          <span className="text-sm font-semibold text-foreground">Аккаунт и окружение</span>
        </div>
        <div className="p-2">
          {rows.map((r, i) => (
            <div key={i} className={`flex items-center justify-between px-2.5 py-3 ${i < rows.length - 1 ? "border-b border-border" : ""}`}>
              <span className="text-sm text-muted-foreground">{r.label}</span>
              <span className="text-sm text-foreground">{r.value}</span>
            </div>
          ))}
        </div>
      </Panel>
      {auth?.role === "super_admin" && (
        <>
        <Panel className="mt-4">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Администраторы платформы</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Назначение ролей и отзыв доступа к Platform.</p>
          </div>
          <div className="p-4">
            <PlatformAdminsManager admins={admins} currentUserId={auth.userId} />
          </div>
        </Panel>
        {operational && (
          <Panel className="mt-4">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Операционное управление</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Управление доступностью регистрации новых клубов.</p>
            </div>
            <div className="p-4"><PlatformOperationalSettings initial={operational} /></div>
          </Panel>
        )}
        </>
      )}
    </div>
  )
}
