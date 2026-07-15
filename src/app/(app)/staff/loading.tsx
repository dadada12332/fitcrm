export default function StaffLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="h-7 w-28 rounded-lg" style={{ background: "var(--border)" }} />
        <div className="h-10 w-36 rounded-md" style={{ background: "var(--border)" }} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
        ))}
      </div>
    </div>
  )
}
