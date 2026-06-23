import { Sparkles, TrendingUp, TrendingDown, Plus, ArrowRightLeft } from "lucide-react"
import type { AiRecommendation, DaySummary } from "@/lib/schedule"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid #f1f5f9" }}>
      <span className="text-sm" style={{ color: "#64748b" }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: "#020617" }}>{value}</span>
    </div>
  )
}

const recMeta = {
  overload: { icon: TrendingUp, color: "#dc2626", bg: "#fee2e2" },
  underload: { icon: TrendingDown, color: "#d97706", bg: "#fef3c7" },
  suggest: { icon: Plus, color: "#16a34a", bg: "#dcfce7" },
  move: { icon: ArrowRightLeft, color: "#2563eb", bg: "#dbeafe" },
} as const

export function ScheduleSidebar({ summary, recommendations }: { summary: DaySummary; recommendations: AiRecommendation[] }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Сводка дня */}
      <div className="rounded-lg p-5" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <h3 className="text-base font-semibold mb-3" style={{ color: "#020617" }}>Сводка дня</h3>
        <Row label="Занятий" value={String(summary.classes)} />
        <Row label="Посещений" value={String(summary.visits)} />
        <Row label="Загруженность" value={`${summary.loadPct}%`} />
        <Row label="Пиковое время" value={summary.peakTime ?? "—"} />
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm" style={{ color: "#64748b" }}>Отменено занятий</span>
          <span className="text-sm font-semibold" style={{ color: summary.cancelled ? "#dc2626" : "#020617" }}>{summary.cancelled}</span>
        </div>
      </div>

      {/* AI рекомендации */}
      <div className="rounded-lg p-5" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4" style={{ color: "#7c3aed" }} />
          <h3 className="text-base font-semibold" style={{ color: "#020617" }}>AI-рекомендации</h3>
        </div>
        <p className="text-xs mb-4" style={{ color: "#94a3b8" }}>На основе загрузки дня (правила, не модель)</p>

        {recommendations.length === 0 ? (
          <p className="text-sm" style={{ color: "#94a3b8" }}>Загрузка сбалансирована — рекомендаций нет.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recommendations.map((r, i) => {
              const m = recMeta[r.type]
              const Icon = m.icon
              return (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: m.bg }}>
                    <Icon className="w-4 h-4" style={{ color: m.color }} />
                  </div>
                  <p className="text-sm leading-snug pt-1" style={{ color: "#334155" }}>{r.text}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
