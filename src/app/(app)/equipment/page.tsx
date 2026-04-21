"use client"

import * as React from "react"

import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { AuthenticatedPageSkeletonFallback } from "@/app/(app)/_components/AuthenticatedPageFallbacks"

import { EquipmentPageClient } from "./_components/EquipmentPageClient"

export default function EquipmentPage() {
  return (
    <AuthenticatedPageBoundary fallback={<AuthenticatedPageSkeletonFallback />}>
      {() => <EquipmentPageClient />}
    </AuthenticatedPageBoundary>
  )
}
