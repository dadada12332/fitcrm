export default function ClientsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-28 rounded-lg" style={{ background: "var(--border)" }} />
          <div className="h-4 w-60 rounded" style={{ background: "var(--border)" }} />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 rounded-md" style={{ background: "var(--border)" }} />
          <div className="h-10 w-28 rounded-md" style={{ background: "var(--border)" }} />
          <div className="h-10 w-36 rounded-md" style={{ background: "var(--border)" }} />
        </div>
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
        ))}
      </div>
      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="h-12 border-b" style={{ background: "var(--card-2)", borderColor: "var(--border)" }} />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-14 border-b flex items-center px-4 gap-4" style={{ borderColor: "var(--border)" }}>
            <div className="h-8 w-8 rounded-full flex-shrink-0" style={{ background: "var(--border)" }} />
            <div className="h-4 w-40 rounded" style={{ background: "var(--border)" }} />
            <div className="h-4 w-28 rounded ml-4" style={{ background: "var(--border)" }} />
            <div className="h-4 w-24 rounded ml-auto" style={{ background: "var(--border)" }} />
          </div>
        ))}
      </div>
    </div>
  )
}
