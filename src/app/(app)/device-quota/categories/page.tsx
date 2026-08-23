"use client"

import * as React from "react"
import type { Session } from "next-auth"

import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { AuthenticatedPageSpinnerFallback } from "@/app/(app)/_components/AuthenticatedPageFallbacks"
import { TenantSelector } from "@/components/shared/TenantSelector"
import { isEquipmentManagerRole } from "@/lib/rbac"
import { DeviceQuotaSuggestedMappingAction } from "../_components/suggested-mapping/DeviceQuotaSuggestedMappingAction"
import { DeviceQuotaCategoryProvider } from "./_components/DeviceQuotaCategoryContext"
import { DeviceQuotaCategoryToolbar } from "./_components/DeviceQuotaCategoryToolbar"
import { DeviceQuotaCategoryTree } from "./_components/DeviceQuotaCategoryTree"
import { DeviceQuotaCategoryDialog } from "./_components/DeviceQuotaCategoryDialog"
import { DeviceQuotaCategoryDeleteDialog } from "./_components/DeviceQuotaCategoryDeleteDialog"
import { DeviceQuotaCategoryImportDialog } from "./_components/DeviceQuotaCategoryImportDialog"
import { useDeviceQuotaCategoryContext } from "./_hooks/useDeviceQuotaCategoryContext"

/** Renders the authenticated Device Quota categories workspace. */
export default function DeviceQuotaCategoriesPage() {
  return (
    <AuthenticatedPageBoundary fallback={<AuthenticatedPageSpinnerFallback />}>
      {(user) => <DeviceQuotaCategoriesPageContent user={user} />}
    </AuthenticatedPageBoundary>
  )
}

type DeviceQuotaCategoriesPageContentProps = {
  user: Session["user"]
}

function DeviceQuotaCategoriesPageContent({ user }: DeviceQuotaCategoriesPageContentProps) {
  const userRole = user.role
  const canManageCategories = isEquipmentManagerRole(userRole)
  const [isAssignmentActive, setIsAssignmentActive] = React.useState(false)

  return (
    <DeviceQuotaCategoryProvider>
      <div
        data-testid="device-quota-categories-workspace"
        className="min-w-0 w-full max-w-none space-y-6 py-6"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Tiêu chuẩn, định mức sử dụng thiết bị y tế</h1>
              <p className="text-sm text-muted-foreground">
                Quản lý tiêu chuẩn, định mức trang thiết bị y tế theo quy định
              </p>
            </div>
            <DeviceQuotaCategoriesPageActions isAssignmentActive={isAssignmentActive} />
          </div>
          <DeviceQuotaCategoryToolbar />
        </div>

        <DeviceQuotaCategoryTree onAssignmentActiveChange={setIsAssignmentActive} />

        {canManageCategories && (
          <>
            <DeviceQuotaCategoryDialog />
            <DeviceQuotaCategoryDeleteDialog />
            <DeviceQuotaCategoryImportDialog />
          </>
        )}
      </div>
    </DeviceQuotaCategoryProvider>
  )
}

function DeviceQuotaCategoriesPageActions({
  isAssignmentActive,
}: Readonly<{ isAssignmentActive: boolean }>) {
  const { donViId, user } = useDeviceQuotaCategoryContext()

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      <DeviceQuotaSuggestedMappingAction
        donViId={donViId}
        userRole={user?.role ?? null}
        label="Gợi ý phân loại hàng loạt"
      />
      <fieldset disabled={isAssignmentActive} className="min-w-0 border-0 p-0">
        <TenantSelector hideAllOption />
      </fieldset>
    </div>
  )
}
