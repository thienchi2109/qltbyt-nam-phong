"use client"

import * as React from "react"
import type { Session } from "next-auth"
import { AlertTriangle, Shield } from "lucide-react"

import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { AuthenticatedPageSpinnerFallback } from "@/app/(app)/_components/AuthenticatedPageFallbacks"
import { TenantSelector } from "@/components/shared/TenantSelector"
import { Card, CardContent } from "@/components/ui/card"
import { canAccessDeviceQuotaModule, isEquipmentManagerRole } from "@/lib/rbac"
import { DeviceQuotaSuggestedMappingAction } from "../_components/suggested-mapping/DeviceQuotaSuggestedMappingAction"
import { DeviceQuotaCategoryProvider } from "./_components/DeviceQuotaCategoryContext"
import { DeviceQuotaCategoryToolbar } from "./_components/DeviceQuotaCategoryToolbar"
import { DeviceQuotaCategoryTree } from "./_components/DeviceQuotaCategoryTree"
import { DeviceQuotaCategoryDialog } from "./_components/DeviceQuotaCategoryDialog"
import { DeviceQuotaCategoryDeleteDialog } from "./_components/DeviceQuotaCategoryDeleteDialog"
import { DeviceQuotaCategoryImportDialog } from "./_components/DeviceQuotaCategoryImportDialog"
import { useDeviceQuotaCategoryContext } from "./_hooks/useDeviceQuotaCategoryContext"

/** Renders the permission-gated Device Quota categories workspace. */
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
  const canAccessWorkspace = canAccessDeviceQuotaModule(userRole)
  const [isAssignmentActive, setIsAssignmentActive] = React.useState(false)

  if (!canAccessWorkspace) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-3 bg-red-100 rounded-full">
                  <Shield className="size-6 text-red-600" />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Truy cập bị hạn chế</h2>
                <p className="text-gray-600 text-sm">
                  Tính năng &quot;Tiêu chuẩn, định mức sử dụng thiết bị y tế&quot; chỉ dành cho quản
                  trị viên hoặc bộ phận quản lý thiết bị. Bạn không có quyền truy cập vào trang này.
                </p>
              </div>
              <div className="flex items-center justify-center text-xs text-gray-500 mt-4">
                <AlertTriangle className="size-4 mr-1" />
                <span>Liên hệ quản trị viên nếu bạn cần hỗ trợ</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

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
