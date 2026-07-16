"use client"

import dynamic from "next/dynamic"

// Ленивая загрузка recharts: тяжёлые чанки не блокируют первый рендер/гидрацию.
// Скелетон держит высоту (~400px) — без сдвига макета.
function ChartSkeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-2xl animate-pulse ${className}`} style={{ background: "rgba(0,0,0,0.03)", minHeight: 400 }} />
}

export const RevenueChart = dynamic(
  () => import("./RevenueChart").then((m) => m.RevenueChart),
  { ssr: false, loading: () => <ChartSkeleton className="flex-1" /> },
)

export const DashboardVisitRadial = dynamic(
  () => import("./DashboardVisitRadial").then((m) => m.DashboardVisitRadial),
  { ssr: false, loading: () => <ChartSkeleton className="w-[300px]" /> },
)
