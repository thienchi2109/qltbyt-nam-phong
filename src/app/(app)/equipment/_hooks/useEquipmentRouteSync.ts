"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { Equipment } from "../types"

export interface UseEquipmentRouteSyncParams {
  data: Equipment[]
  setIsAddDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  setSelectedEquipment: React.Dispatch<React.SetStateAction<Equipment | null>>
  setIsDetailModalOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export interface UseEquipmentRouteSyncReturn {
  router: ReturnType<typeof useRouter>
}

export function useEquipmentRouteSync(params: UseEquipmentRouteSyncParams): UseEquipmentRouteSyncReturn {
  const {
    data,
    setIsAddDialogOpen,
    setSelectedEquipment,
    setIsDetailModalOpen,
  } = params

  const router = useRouter()
  const searchParams = useSearchParams()

  // Handle URL parameters for dialog opening and equipment highlighting
  React.useEffect(() => {
    const actionParam = searchParams.get("action")
    const highlightParam = searchParams.get("highlight")

    if (actionParam === "add") {
      setIsAddDialogOpen(true)
      router.replace("/equipment", { scroll: false })
    }

    if (highlightParam && data.length > 0) {
      const equipmentToHighlight = data.find((eq) => eq.id === Number(highlightParam))
      if (equipmentToHighlight) {
        setSelectedEquipment(equipmentToHighlight)
        setIsDetailModalOpen(true)
        router.replace("/equipment", { scroll: false })

        setTimeout(() => {
          const element = document.querySelector(`[data-equipment-id="${highlightParam}"]`)
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        }, 300)
      }
    }
  }, [searchParams, router, data, setIsAddDialogOpen, setSelectedEquipment, setIsDetailModalOpen])

  return React.useMemo(() => ({ router }), [router])
}
