export default function MembershipsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="h-7 w-32 rounded-lg" style={{ background: "var(--border)" }} />
        <div className="h-10 w-40 rounded-md" style={{ background: "var(--border)" }} />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-40 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
        ))}
      </div>
    </div>
  )
}
