"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2, ListTree, Link2, FileText } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function DeviceQuotaMappingPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Định mức - Phân loại thiết bị</h1>
        <p className="text-muted-foreground">
          Ánh xạ thiết bị với định mức theo quyết định của Bộ Y tế
        </p>
      </div>

      {/* Feature Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Danh mục định mức</CardTitle>
            <ListTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Danh sách thiết bị theo quyết định BYT
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Thiết bị cơ sở</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Danh sách thiết bị thực tế tại đơn vị
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ánh xạ</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Liên kết thiết bị với danh mục định mức
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Placeholder */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Giao diện phân loại thiết bị</CardTitle>
              <CardDescription>
                Giao diện split-screen để ánh xạ thiết bị với định mức
              </CardDescription>
            </div>
            <Badge variant="outline">Sắp ra mắt</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[500px] items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="flex flex-col items-center">
                  <ListTree className="h-10 w-10 text-blue-500/40 mb-2" />
                  <span className="text-xs text-muted-foreground">Danh mục định mức</span>
                </div>
                <Link2 className="h-6 w-6 text-muted-foreground/40" />
                <div className="flex flex-col items-center">
                  <FileText className="h-10 w-10 text-green-500/40 mb-2" />
                  <span className="text-xs text-muted-foreground">Thiết bị cơ sở</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold">Giao diện phân loại đang được phát triển</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Giao diện split-screen sẽ cho phép kéo thả hoặc chọn để ánh xạ thiết bị thực tế với danh mục định mức từ quyết định của Bộ Y tế. Hỗ trợ tìm kiếm và lọc nhanh.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hướng dẫn sử dụng</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="font-bold text-foreground mt-0.5">1.</span>
              <span>Chọn quyết định định mức từ danh sách (VD: Quyết định 7396/QĐ-BYT)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-foreground mt-0.5">2.</span>
              <span>Tìm thiết bị từ danh mục định mức bên trái</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-foreground mt-0.5">3.</span>
              <span>Chọn thiết bị tương ứng từ danh sách thiết bị cơ sở bên phải</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-foreground mt-0.5">4.</span>
              <span>Nhấn nút "Liên kết" hoặc kéo thả để tạo ánh xạ</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-foreground mt-0.5">5.</span>
              <span>Hệ thống sẽ tự động tính toán tình trạng đạt/thiếu định mức</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
