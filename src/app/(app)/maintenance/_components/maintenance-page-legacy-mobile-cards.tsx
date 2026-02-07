"use client"

import * as React from "react"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Check, Edit, MoreHorizontal, Trash2, X } from "lucide-react"

interface MaintenancePageLegacyMobileCardsProps {
  isLoading: boolean
  plans: MaintenancePlan[]
  canManagePlans: boolean
  onSelectPlan: (plan: MaintenancePlan) => void
  onOpenApproveDialog: (plan: MaintenancePlan) => void
  onOpenRejectDialog: (plan: MaintenancePlan) => void
  onOpenDeleteDialog: (plan: MaintenancePlan) => void
  onEditPlan: (plan: MaintenancePlan) => void
}

function getStatusVariant(status: MaintenancePlan["trang_thai"]) {
  switch (status) {
    case "Bản nháp":
      return "secondary"
    case "Đã duyệt":
      return "default"
    case "Không duyệt":
      return "destructive"
    default:
      return "outline"
  }
}

export function MaintenancePageLegacyMobileCards({
  isLoading,
  plans,
  canManagePlans,
  onSelectPlan,
  onOpenApproveDialog,
  onOpenRejectDialog,
  onOpenDeleteDialog,
  onEditPlan,
}: MaintenancePageLegacyMobileCardsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="mobile-card-spacing">
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!plans.length) {
    return (
      <Card className="mobile-card-spacing">
        <CardContent className="flex items-center justify-center h-24">
          <p className="text-muted-foreground text-center">Chưa có kế hoạch nào.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {plans.map((plan) => (
        <Card
          key={plan.id}
          className="mobile-card-spacing cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onSelectPlan(plan)}
        >
          <CardHeader className="flex flex-row items-start justify-between pb-4 mobile-interactive">
            <div className="max-w-[calc(100%-40px)]">
              <CardTitle className="heading-responsive-h4 font-bold leading-tight truncate">
                {plan.ten_ke_hoach}
              </CardTitle>
              <CardDescription className="body-responsive-sm">
                Năm {plan.nam} - {plan.khoa_phong || "Tổng thể"}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                <Button variant="ghost" className="h-8 w-8 p-0 touch-target-sm">
                  <span className="sr-only">Mở menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => onSelectPlan(plan)}>
                  Xem chi tiết công việc
                </DropdownMenuItem>
                {plan.trang_thai === "Bản nháp" && canManagePlans && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => onOpenApproveDialog(plan)}>
                      <Check className="mr-2 h-4 w-4" />
                      Duyệt
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onOpenRejectDialog(plan)}>
                      <X className="mr-2 h-4 w-4" />
                      Không duyệt
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onEditPlan(plan)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Sửa
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => onOpenDeleteDialog(plan)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Xóa
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent className="body-responsive-sm space-y-3 mobile-interactive">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Loại công việc:</span>
              <Badge variant="outline">{plan.loai_cong_viec}</Badge>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground">Trạng thái:</span>
              <Badge variant={getStatusVariant(plan.trang_thai)}>{plan.trang_thai}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
