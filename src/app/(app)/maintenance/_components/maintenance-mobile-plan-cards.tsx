"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { CalendarDays, MoreHorizontal, PlusCircle } from "lucide-react"
import { getPlanStatusTone, resolveStatusBadgeVariant } from "./maintenance-mobile-status"

interface MaintenanceMobilePlanCardsProps {
  plans: MaintenancePlan[]
  isLoadingPlans: boolean
  showFacilityFilter: boolean
  canManagePlans: boolean
  onOpenAddPlanDialog: () => void
  onSelectPlan: (plan: MaintenancePlan) => void
  onSetTasksTab: () => void
  onEditPlan: (plan: MaintenancePlan) => void
  onOpenApproveDialog: (plan: MaintenancePlan) => void
  onOpenRejectDialog: (plan: MaintenancePlan) => void
  onOpenDeleteDialog: (plan: MaintenancePlan) => void
}

export function MaintenanceMobilePlanCards({
  plans,
  isLoadingPlans,
  showFacilityFilter,
  canManagePlans,
  onOpenAddPlanDialog,
  onSelectPlan,
  onSetTasksTab,
  onEditPlan,
  onOpenApproveDialog,
  onOpenRejectDialog,
  onOpenDeleteDialog,
}: MaintenanceMobilePlanCardsProps) {
  if (isLoadingPlans) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border-muted shadow-none">
            <CardHeader className="space-y-2">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!plans.length) {
    return (
      <Card className="border-dashed bg-muted/40">
        <CardContent className="flex flex-col items-center justify-center space-y-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <CalendarDays className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Chưa có kế hoạch</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Hãy tạo kế hoạch mới hoặc điều chỉnh bộ lọc để xem dữ liệu phù hợp.
            </p>
          </div>
          {canManagePlans && (
            <Button onClick={onOpenAddPlanDialog} className="h-11 px-6">
              <PlusCircle className="mr-2 h-4 w-4" />
              Tạo kế hoạch mới
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {plans.map((plan) => {
        const statusTone = getPlanStatusTone(plan.trang_thai)
        return (
          <Card
            key={plan.id}
            className="cursor-pointer overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm transition-transform active:scale-[0.985]"
            onClick={() => onSelectPlan(plan)}
          >
            <div className={`px-4 py-3 ${statusTone.header}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold leading-tight line-clamp-2">{plan.ten_ke_hoach}</h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                    Năm {plan.nam} • {plan.khoa_phong || "Tổng thể"}
                  </p>
                </div>
                <Badge variant={resolveStatusBadgeVariant(plan.trang_thai)} className="shrink-0">
                  {plan.trang_thai}
                </Badge>
              </div>
            </div>
            <CardContent className="space-y-3 px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">Loại công việc</span>
                <Badge variant="outline" className="shrink-0">{plan.loai_cong_viec}</Badge>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">Người lập</span>
                <span className="max-w-[55%] text-right font-medium">{plan.nguoi_lap_ke_hoach || "Chưa cập nhật"}</span>
              </div>
              {showFacilityFilter && (
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Cơ sở</span>
                  <span className="max-w-[55%] text-right font-medium">{plan.facility_name || "Tất cả"}</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">Ngày phê duyệt</span>
                <span className="max-w-[55%] text-right font-medium text-sm">
                  {plan.ngay_phe_duyet
                    ? format(parseISO(plan.ngay_phe_duyet), "dd/MM/yyyy HH:mm", { locale: vi })
                    : "Chưa duyệt"}
                </span>
              </div>
            </CardContent>
            <CardFooter className="px-4 py-3">
              <div className="flex w-full items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-0 text-sm"
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelectPlan(plan)
                    onSetTasksTab()
                  }}
                >
                  Xem công việc
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => onSelectPlan(plan)}>Xem chi tiết công việc</DropdownMenuItem>
                    {plan.trang_thai === "Bản nháp" && canManagePlans && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => onEditPlan(plan)}>Sửa kế hoạch</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onOpenApproveDialog(plan)}>Duyệt kế hoạch</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onOpenRejectDialog(plan)}>Không duyệt</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => onOpenDeleteDialog(plan)} className="text-destructive">
                          Xóa kế hoạch
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
