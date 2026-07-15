import { PT } from "@/components/platform/parts"

function Shimmer({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{ background: "#131c2e", ...style }}
    />
  )
}

export default function PlatformLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Shimmer style={{ height: 28, width: 240 }} />
        <Shimmer className="mt-2" style={{ height: 16, width: 160 }} />
      </div>

      {/* Hero row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl px-4 py-4" style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}` }}>
            <Shimmer style={{ height: 14, width: 90 }} />
            <Shimmer className="mt-3" style={{ height: 28, width: 110 }} />
            <Shimmer className="mt-2" style={{ height: 12, width: 70 }} />
          </div>
        ))}
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl px-4 py-3.5" style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}` }}>
            <Shimmer style={{ height: 12, width: 80 }} />
            <Shimmer className="mt-2" style={{ height: 24, width: 60 }} />
          </div>
        ))}
      </div>

      {/* Big panel */}
      <div className="rounded-xl overflow-hidden" style={{ background: PT.panel, border: `1px solid ${PT.panelBorder}` }}>
        <div className="px-4 h-12 flex items-center" style={{ borderBottom: `1px solid ${PT.panelBorder}` }}>
          <Shimmer style={{ height: 14, width: 140 }} />
        </div>
        <div className="p-3 flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Shimmer style={{ height: 32, width: 32, borderRadius: 8 }} />
              <Shimmer className="flex-1" style={{ height: 14 }} />
              <Shimmer style={{ height: 14, width: 80 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
