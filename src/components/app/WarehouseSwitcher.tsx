"use client"

import { useCallback, useSyncExternalStore } from "react"
import type { PosProduct, StockMovement, InventoryStats } from "@/lib/inventory"
import { InventoryClient } from "./InventoryClient"
import { PosClient } from "./PosClient"
import { WarehouseVersionToggle, type WarehouseVersion } from "./WarehouseVersionToggle"

const STORAGE_KEY = "fitcrm.warehouseVersion"
const STORAGE_EVENT = "fitcrm:warehouse-version"

function readVersion(): WarehouseVersion {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === "pos" ? "pos" : "table"
}

type Props = {
  clubId: string
  products: PosProduct[]
  movements: StockMovement[]
  stats: InventoryStats
  connectedProviders: string[]
  canSell: boolean
  canSupply: boolean
  canWriteoff: boolean
}

export function WarehouseSwitcher({ clubId, products, movements, stats, connectedProviders, canSell, canSupply, canWriteoff }: Props) {
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener("storage", onStoreChange)
    window.addEventListener(STORAGE_EVENT, onStoreChange)
    return () => {
      window.removeEventListener("storage", onStoreChange)
      window.removeEventListener(STORAGE_EVENT, onStoreChange)
    }
  }, [])
  const version = useSyncExternalStore<WarehouseVersion>(subscribe, readVersion, () => "table")

  function change(v: WarehouseVersion) {
    localStorage.setItem(STORAGE_KEY, v)
    window.dispatchEvent(new Event(STORAGE_EVENT))
  }

  const toggle = <WarehouseVersionToggle value={version} onChange={change} />

  return version === "pos"
    ? <PosClient clubId={clubId} products={products} connectedProviders={connectedProviders} canSell={canSell} versionControl={toggle} />
    : <InventoryClient clubId={clubId} products={products} movements={movements} stats={stats} canSupply={canSupply} canWriteoff={canWriteoff} versionControl={toggle} />
}
