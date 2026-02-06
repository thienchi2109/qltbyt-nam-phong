"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2, Shield } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { isEquipmentManagerRole } from "@/lib/rbac"
import { DeviceQuotaCategoryProvider } from "./_components/DeviceQuotaCategoryContext"
import { DeviceQuotaCategoryToolbar } from "./_components/DeviceQuotaCategoryToolbar"
import { DeviceQuotaCategoryTree } from "./_components/DeviceQuotaCategoryTree"
import { DeviceQuotaCategoryDialog } from "./_components/DeviceQuotaCategoryDialog"
import { DeviceQuotaCategoryDeleteDialog } from "./_components/DeviceQuotaCategoryDeleteDialog"
import { DeviceQuotaCategoryImportDialog } from "./_components/DeviceQuotaCategoryImportDialog"

export default function DeviceQuotaCategoriesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const userRole = (session?.user as { role?: string } | undefined)?.role
  const canManageCategories = isEquipmentManagerRole(userRole)

  if (!canManageCategories) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-3 bg-red-100 rounded-full">
                  <Shield className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Truy cập bị hạn chế
                </h2>
                <p className="text-gray-600 text-sm">
                  Tính năng &quot;Danh mục thiết bị&quot; chỉ dành cho quản trị viên hoặc bộ phận quản lý thiết bị.
                  Bạn không có quyền truy cập vào trang này.
                </p>
              </div>
              <div className="flex items-center justify-center text-xs text-gray-500 mt-4">
                <AlertTriangle className="h-4 w-4 mr-1" />
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
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold">Danh mục thiết bị</h1>
            <p className="text-sm text-muted-foreground">
              Quản lý danh mục nhóm thiết bị phục vụ phân loại và định mức
            </p>
          </div>
          <DeviceQuotaCategoryToolbar />
        </div>

        <DeviceQuotaCategoryTree />

        <DeviceQuotaCategoryDialog />
        <DeviceQuotaCategoryDeleteDialog />
        <DeviceQuotaCategoryImportDialog />
      </div>
    </DeviceQuotaCategoryProvider>
  )
}
