export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-32 rounded-lg" style={{ background: "var(--border)" }} />
          <div className="h-4 w-72 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3 w-40 rounded" style={{ background: "var(--border)" }} />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 rounded-md" style={{ background: "var(--border)" }} />
          <div className="h-10 w-28 rounded-md" style={{ background: "var(--border)" }} />
        </div>
      </div>
      {/* Two-column layout */}
      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <div className="h-72 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
          <div className="h-48 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
        </div>
        <div className="flex-shrink-0 flex flex-col gap-4" style={{ width: 510 }}>
          <div className="h-56 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
          <div className="h-36 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
        </div>
      </div>
    </div>
  )
}
