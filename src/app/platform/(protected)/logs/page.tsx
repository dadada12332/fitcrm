import { getPlatformLogs, platformBase } from "@/lib/platform"
import { Panel, PageHeader, timeAgo, PT } from "@/components/platform/parts"
import Link from "next/link"

export const dynamic = "force-dynamic"

const ACTION_LABEL: Record<string, string> = {
  login: "Вход в Platform",
  impersonate: "Вход в CRM клуба",
  extend_trial: "Продление Trial",
  change_plan: "Смена тарифа",
  suspend: "Блокировка клуба",
  unsuspend: "Разблокировка клуба",
}
const ACTION_COLOR: Record<string, string> = {
  login: "#60a5fa",
  impersonate: "#a78bfa",
  extend_trial: "#4ade80",
  change_plan: "#fbbf24",
  suspend: "#f87171",
  unsuspend: "#4ade80",
}

export default async function LogsPage() {
  const [logs, base] = await Promise.all([getPlatformLogs(150), platformBase()])

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto">
      <PageHeader title="Логи" subtitle="Аудит действий администраторов платформы" />

      <Panel className="overflow-hidden">
        {logs.length === 0 ? (
          <p className="text-sm text-center py-16" style={{ color: PT.textMuted }}>
            Записей пока нет. Действия появятся здесь после применения миграции и первых операций.
          </p>
        ) : (
          <div className="p-2">
            {logs.map((l) => {
              const color = ACTION_COLOR[l.action] ?? PT.textSoft
              const club = (l.meta as { club?: string }).club
              return (
                <div key={l.id} className="flex items-center gap-3 px-2.5 py-2.5" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">
                      <span style={{ color }}>{ACTION_LABEL[l.action] ?? l.action}</span>
                      {club && <span style={{ color: PT.textSoft }}> · {club}</span>}
                      {l.clubId && (
                        <Link href={`${base}/clubs/${l.clubId}`} className="ml-2 text-xs" style={{ color: PT.textMuted }}>открыть клуб</Link>
                      )}
                    </p>
                    <p className="text-[11px]" style={{ color: PT.textMuted }}>{l.adminEmail ?? "—"}</p>
                  </div>
                  <span className="text-[11px] shrink-0" style={{ color: PT.textMuted }}>{timeAgo(l.createdAt)}</span>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
