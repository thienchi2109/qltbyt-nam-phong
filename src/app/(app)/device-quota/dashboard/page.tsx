"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2, FileBarChart, ClipboardCheck, AlertTriangle } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function DeviceQuotaDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === "unauthenticated" || !session?.user) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Định mức - Tổng quan</h1>
        <p className="text-muted-foreground">
          Theo dõi và quản lý định mức trang thiết bị y tế theo quyết định của Bộ Y tế
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng số thiết bị</CardTitle>
            <FileBarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Đã phân loại theo định mức
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đạt định mức</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Đáp ứng tiêu chuẩn
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Thiếu thiết bị</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Cần bổ sung
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Placeholder */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tổng quan định mức</CardTitle>
              <CardDescription>
                Dashboard hiển thị trạng thái định mức thiết bị y tế
              </CardDescription>
            </div>
            <Badge variant="outline">Sắp ra mắt</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <FileBarChart className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <h3 className="mt-4 text-lg font-semibold">Dashboard đang được phát triển</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                Trang tổng quan sẽ hiển thị biểu đồ và thống kê chi tiết về định mức thiết bị y tế theo từng cơ sở và phân loại.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
