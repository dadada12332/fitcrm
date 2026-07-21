"use client"

import dynamic from "next/dynamic"

// Ленивая загрузка: ReportsClient тянет recharts (тяжёлые чанки). ssr:false —
// чтобы не блокировать первый рендер/гидрацию страницы; скелетон держит высоту.
const ReportsClient = dynamic(
  () => import("@/components/app/ReportsClient").then((m) => m.ReportsClient),
  { ssr: false, loading: () => <div className="h-[70vh] rounded-2xl animate-pulse" style={{ background: "rgba(0,0,0,0.03)" }} /> },
)

// Данные больше не грузятся одним тяжёлым массивом: каждая вкладка тянет свой
// серверный агрегат (RPC) лениво. Экспорт грузит сырые данные по требованию.
export function ReportsShell({ canExport }: { canExport: boolean }) {
  return <ReportsClient canExport={canExport} />
}
