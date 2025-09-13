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
import { useEquipmentAttention } from "@/hooks/use-dashboard-stats"

export function EquipmentAttentionTable() {
  const { data: equipmentNeedingAttention, isLoading, error } = useEquipmentAttention()

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Chờ sửa chữa':
        return 'destructive'
      case 'Chờ bảo trì':
        return 'secondary'
      case 'Chờ hiệu chuẩn/kiểm định':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center">
        <div className="grid gap-2">
          <CardTitle className="text-responsive-lg md:text-2xl font-semibold leading-none tracking-tight">
            Thiết bị cần chú ý
          </CardTitle>
          <CardDescription>
            Danh sách các thiết bị cần sửa chữa hoặc đang bảo trì.
          </CardDescription>
        </div>
        <Button asChild size="sm" className="ml-auto gap-1">
          <Link href="/equipment">
            Xem tất cả
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Lỗi tải dữ liệu thiết bị</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên thiết bị</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="hidden md:table-cell">Vị trí</TableHead>
                <TableHead className="text-right">Ngày BT tiếp theo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Loading skeleton rows
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-20" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  </TableRow>
                ))
              ) : equipmentNeedingAttention && equipmentNeedingAttention.length > 0 ? (
                equipmentNeedingAttention.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.ten_thiet_bi}</div>
                      <div className="hidden text-sm text-muted-foreground md:inline">
                        {item.model || item.ma_thiet_bi}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(item.tinh_trang_hien_tai)}>
                        {item.tinh_trang_hien_tai}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {item.vi_tri_lap_dat || 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.ngay_bt_tiep_theo || 'N/A'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Không có thiết bị nào cần chú ý.
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
