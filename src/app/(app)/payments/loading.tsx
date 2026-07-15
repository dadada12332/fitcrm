export default function PaymentsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-7 w-24 rounded-lg" style={{ background: "var(--border)" }} />
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-0 rounded-lg overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-5 flex flex-col gap-3" style={{ borderLeft: i === 0 ? "none" : "1px solid var(--border)" }}>
            <div className="h-4 w-28 rounded" style={{ background: "var(--border)" }} />
            <div className="h-8 w-36 rounded" style={{ background: "var(--border)" }} />
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="h-14 border-b" style={{ background: "var(--card-2)", borderColor: "var(--border)" }} />
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-14 border-b flex items-center px-4 gap-4" style={{ borderColor: "var(--border)" }}>
            <div className="h-4 w-32 rounded" style={{ background: "var(--border)" }} />
            <div className="h-4 w-24 rounded ml-4" style={{ background: "var(--border)" }} />
            <div className="h-5 w-16 rounded-full ml-auto" style={{ background: "var(--border)" }} />
          </div>
        ))}
      </div>
    </div>
  )
}
