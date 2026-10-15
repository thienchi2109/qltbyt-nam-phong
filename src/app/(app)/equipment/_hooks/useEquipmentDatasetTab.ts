"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  DEFAULT_EQUIPMENT_DATASET,
  normalizeEquipmentDataset,
  type EquipmentDataset,
} from "./equipmentDataset"

interface UseEquipmentDatasetTabOptions {
  onDatasetChange?: (dataset: EquipmentDataset) => void
}

function readDatasetFromLocation(): EquipmentDataset {
  if (typeof window === "undefined") return DEFAULT_EQUIPMENT_DATASET
  return normalizeEquipmentDataset(new URLSearchParams(window.location.search).get("tab"))
}

/** Owns URL-persisted equipment dataset state and browser history synchronization. */
export function useEquipmentDatasetTab(options: UseEquipmentDatasetTabOptions = {}) {
  const router = useRouter()
  const { onDatasetChange } = options
  const [dataset, setDatasetState] = React.useState<EquipmentDataset>(readDatasetFromLocation)
  const datasetRef = React.useRef(dataset)
  const initialSyncRef = React.useRef(true)

  React.useEffect(() => {
    const syncFromLocation = () => {
      const next = readDatasetFromLocation()
      if (next !== datasetRef.current || (initialSyncRef.current && next === "placed")) {
        onDatasetChange?.(next)
      }
      datasetRef.current = next
      setDatasetState(next)
      initialSyncRef.current = false
    }
    window.addEventListener("popstate", syncFromLocation)
    syncFromLocation()
    return () => window.removeEventListener("popstate", syncFromLocation)
  }, [onDatasetChange])

  const setDataset = React.useCallback(
    (nextDataset: EquipmentDataset) => {
      const normalized = normalizeEquipmentDataset(nextDataset)
      datasetRef.current = normalized
      setDatasetState(normalized)
      onDatasetChange?.(normalized)

      const params = new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search
      )
      params.set("tab", normalized)
      const pathname = typeof window === "undefined" ? "" : window.location.pathname
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [onDatasetChange, router]
  )

  return { dataset, setDataset }
}
