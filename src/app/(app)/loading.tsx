export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-8 w-48 rounded-lg" style={{ background: "var(--border)" }} />
      <div className="h-4 w-72 rounded" style={{ background: "var(--border-subtle)" }} />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
        ))}
      </div>
      <div className="h-64 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
      <div className="h-48 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
    </div>
  )
}
