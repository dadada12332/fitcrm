type Props = {
  score: number
  expiringCount: number
  churnCount: number
  lowStockCount: number
}

export function ClubHealthCard({ score, expiringCount, churnCount, lowStockCount }: Props) {
  const color =
    score >= 80 ? "#16a34a" :
    score >= 60 ? "#f59e0b" :
    "#dc2626"

  const bg =
    score >= 80 ? "rgba(22,163,74,0.1)" :
    score >= 60 ? "#fffbeb" :
    "rgba(220,38,38,0.1)"

  const issues = [
    expiringCount > 0 && `${expiringCount} абонементов истекают`,
    churnCount > 0 && `${churnCount} клиентов в зоне риска`,
    lowStockCount > 0 && `${lowStockCount} позиций мало на складе`,
  ].filter(Boolean) as string[]

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: bg, border: `1px solid ${color}22` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-base">🏥</span>
          <span className="text-sm font-semibold" style={{ color: "var(--on-dark)" }}>
            Здоровье клуба
          </span>
        </div>
        <div className="flex items-end gap-0.5">
          <span className="text-2xl font-bold leading-none" style={{ color }}>
            {score}
          </span>
          <span className="text-xs mb-0.5 ml-0.5" style={{ color: "var(--gray-muted)" }}>/100</span>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: color }}
        />
      </div>

      {/* Issues or OK */}
      {issues.length === 0 ? (
        <p className="text-xs font-medium" style={{ color: "#16a34a" }}>
          ✓ Всё в порядке
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {issues.map((issue, i) => (
            <p key={i} className="text-xs" style={{ color: "var(--on-dark-soft)" }}>
              · {issue}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
