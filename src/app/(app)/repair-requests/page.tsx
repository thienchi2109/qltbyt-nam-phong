import * as React from "react"

import { Skeleton } from "@/components/ui/skeleton"

import RepairRequestsPageClient from "./_components/RepairRequestsPageClient"

export type { EquipmentSelectItem, RepairRequestWithEquipment, RepairUnit } from "./types"

function RepairRequestsPageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-32 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    </div>
  )
}

export default function RepairRequestsPage() {
  return (
    <React.Suspense fallback={<RepairRequestsPageFallback />}>
      <RepairRequestsPageClient />
    </React.Suspense>
  )
}

