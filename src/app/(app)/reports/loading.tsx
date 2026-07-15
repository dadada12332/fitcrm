export default function ReportsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-7 w-28 rounded-lg" style={{ background: "var(--border)" }} />
      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-lg" style={{ background: "var(--border)" }} />
        ))}
      </div>
      {/* Main chart */}
      <div className="h-72 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
      {/* Grid of smaller cards */}
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-48 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
        ))}
      </div>
    </div>
  )
}
