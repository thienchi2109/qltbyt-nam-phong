"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { DeviceQuotaMappingProvider } from "./_components/DeviceQuotaMappingContext"
import { DeviceQuotaMappingSplitView } from "./_components/DeviceQuotaMappingSplitView"
import { DeviceQuotaUnassignedList } from "./_components/DeviceQuotaUnassignedList"
import { DeviceQuotaCategoryTree } from "./_components/DeviceQuotaCategoryTree"
import { DeviceQuotaMappingActions } from "./_components/DeviceQuotaMappingActions"

export default function DeviceQuotaMappingPage() {
  const { status } = useSession()
  const router = useRouter()

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/")
    return null
  }

  return (
    <DeviceQuotaMappingProvider>
      <div className="container mx-auto py-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold">Phân loại thiết bị</h1>
          <p className="text-muted-foreground">
            Gán thiết bị vào các nhóm định mức
          </p>
        </div>

        {/* Split view */}
        <DeviceQuotaMappingSplitView
          leftPanel={<DeviceQuotaUnassignedList />}
          rightPanel={<DeviceQuotaCategoryTree />}
        />

        {/* Action bar (sticky footer) */}
        <DeviceQuotaMappingActions />
      </div>
    </DeviceQuotaMappingProvider>
  )
}
