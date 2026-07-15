export default function VisitsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-32 rounded-lg" style={{ background: "var(--border)" }} />
          <div className="h-4 w-56 rounded" style={{ background: "var(--border)" }} />
        </div>
        <div className="h-10 w-36 rounded-md" style={{ background: "var(--border)" }} />
      </div>
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-0 rounded-lg overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-5 flex flex-col gap-3" style={{ borderLeft: i === 0 ? "none" : "1px solid var(--border)" }}>
            <div className="h-4 w-28 rounded" style={{ background: "var(--border)" }} />
            <div className="h-9 w-16 rounded" style={{ background: "var(--border)" }} />
          </div>
        ))}
      </div>
      {/* Check-in panel */}
      <div className="h-20 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
      {/* Visits table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="h-12 border-b" style={{ background: "var(--card-2)", borderColor: "var(--border)" }} />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-14 border-b flex items-center px-4 gap-4" style={{ borderColor: "var(--border)" }}>
            <div className="h-4 w-36 rounded" style={{ background: "var(--border)" }} />
            <div className="h-4 w-24 rounded ml-4" style={{ background: "var(--border)" }} />
            <div className="h-4 w-20 rounded ml-auto" style={{ background: "var(--border)" }} />
          </div>
        ))}
      </div>
    </div>
  )
}
