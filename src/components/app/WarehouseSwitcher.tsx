"use client"

import { useState, useEffect } from "react"
import type { PosProduct, StockMovement, InventoryStats } from "@/lib/inventory"
import { InventoryClient } from "./InventoryClient"
import { PosClient } from "./PosClient"
import { WarehouseVersionToggle, type WarehouseVersion } from "./WarehouseVersionToggle"

const STORAGE_KEY = "fitcrm.warehouseVersion"

type Props = {
  products: PosProduct[]
  movements: StockMovement[]
  stats: InventoryStats
  connectedProviders: string[]
  canSell: boolean
}

export function WarehouseSwitcher({ products, movements, stats, connectedProviders, canSell }: Props) {
  const [version, setVersion] = useState<WarehouseVersion>("table")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === "pos" || saved === "table") setVersion(saved)
    setReady(true)
  }, [])

  function change(v: WarehouseVersion) {
    setVersion(v)
    localStorage.setItem(STORAGE_KEY, v)
  }

  const toggle = <WarehouseVersionToggle value={version} onChange={change} />

  // До гидратации рисуем таблицу без тумблера — чтобы не мигало.
  if (!ready) return <InventoryClient products={products} movements={movements} stats={stats} />

  return version === "pos"
    ? <PosClient products={products} connectedProviders={connectedProviders} canSell={canSell} versionControl={toggle} />
    : <InventoryClient products={products} movements={movements} stats={stats} versionControl={toggle} />
}
