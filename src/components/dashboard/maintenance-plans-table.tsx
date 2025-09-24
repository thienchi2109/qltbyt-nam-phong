"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useMaintenancePlanStats } from "@/hooks/use-dashboard-stats"

export function MaintenancePlansTable() {
  const { data: planStats, isLoading, error } = useMaintenancePlanStats()

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Bản nháp":
        return "secondary"
      case "Đã duyệt":
        return "default"
      default:
        return "outline"
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center md:p-8">
        <div className="grid gap-2">
          <CardTitle className="text-responsive-lg md:text-2xl font-semibold leading-none tracking-tight">
            Kế hoạch BT/HC/KĐ gần đây
          </CardTitle>
          <CardDescription>
            Danh sách các kế hoạch bảo trì, hiệu chuẩn, kiểm định mới nhất.
          </CardDescription>
        </div>
        <Button asChild size="sm" className="ml-auto gap-1">
          <Link href="/maintenance">
            Xem tất cả
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="md:p-8 md:pt-0">
        {error ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Lỗi tải dữ liệu kế hoạch</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên kế hoạch</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Năm</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Loading skeleton rows
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-20" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                  </TableRow>
                ))
              ) : planStats?.plans && planStats.plans.length > 0 ? (
                planStats.plans.map((plan) => (
                  <TableRow key={plan.id} className="hover:bg-muted/50">
                    <TableCell>
                      <Link 
                        href={`/maintenance?planId=${plan.id}&tab=tasks`}
                        className="block w-full hover:no-underline"
                      >
                        <div className="font-medium">{plan.ten_ke_hoach}</div>
                        <div className="text-sm text-muted-foreground">
                          {plan.khoa_phong || 'Tổng thể'}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link 
                        href={`/maintenance?planId=${plan.id}&tab=tasks`}
                        className="block w-full hover:no-underline"
                      >
                        <Badge variant="outline">{plan.loai_cong_viec}</Badge>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link 
                        href={`/maintenance?planId=${plan.id}&tab=tasks`}
                        className="block w-full hover:no-underline"
                      >
                        <Badge variant={getStatusVariant(plan.trang_thai)}>
                          {plan.trang_thai}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link 
                        href={`/maintenance?planId=${plan.id}&tab=tasks`}
                        className="block w-full hover:no-underline"
                      >
                        {plan.nam}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Chưa có kế hoạch nào.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
