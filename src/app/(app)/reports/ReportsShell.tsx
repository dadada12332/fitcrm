"use client"

import { ReportsClient } from "@/components/app/ReportsClient"

// Данные больше не грузятся одним тяжёлым массивом: каждая вкладка тянет свой
// серверный агрегат (RPC) лениво. Экспорт грузит сырые данные по требованию.
export function ReportsShell() {
  return <ReportsClient />
}
