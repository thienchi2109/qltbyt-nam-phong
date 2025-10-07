"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, Wrench, Calendar, Clock, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEquipmentAttention, useMaintenancePlanStats } from "@/hooks/use-dashboard-stats"
import { useCalendarData } from "@/hooks/use-calendar-data"
import { TaskType } from "@/lib/data"

export function DashboardTabs() {
  const currentDate = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const { data: equipmentNeedingAttention, isLoading: isLoadingEquipment, error: equipmentError } = useEquipmentAttention()
  const { data: planStats, isLoading: isLoadingPlans, error: plansError } = useMaintenancePlanStats()
  const { data: calendarData, isLoading: isLoadingCalendar, error: calendarError } = useCalendarData(year, month)

  const events = calendarData?.events || []
  const calendarStats = calendarData?.stats || { total: 0, completed: 0, pending: 0, byType: {} }
  const pendingTasks = events.filter(event => !event.isCompleted)
  const completedTasks = events.filter(event => event.isCompleted)
  const priorityTasks = pendingTasks.filter(task => currentDate.getDate() > 15)

  const getEquipmentStatusColor = (status: string) => {
    switch (status) {
      case 'Chờ sửa chữa':
        return 'border-red-500 bg-red-50/80'
      case 'Chờ bảo trì':
        return 'border-orange-500 bg-orange-50/80'
      case 'Chờ hiệu chuẩn/kiểm định':
        return 'border-blue-500 bg-blue-50/80'
      default:
        return 'border-gray-500 bg-gray-50/80'
    }
  }

  const getPlanStatusVariant = (status: string) => {
    switch (status) {
      case "Bản nháp":
        return "secondary"
      case "Đã duyệt":
        return "default"
      default:
        return "outline"
    }
  }

  const getTaskIcon = (type: TaskType) => {
    switch (type) {
      case "Bảo trì":
        return <Wrench className="h-4 w-4" />
      case "Hiệu chuẩn":
        return <Calendar className="h-4 w-4" />
      case "Kiểm định":
        return <Clock className="h-4 w-4" />
      default:
        return <Calendar className="h-4 w-4" />
    }
  }

  const getTaskColor = (type: TaskType) => {
    switch (type) {
      case "Bảo trì":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "Hiệu chuẩn":
        return "bg-orange-50 text-orange-700 border-orange-200"
      case "Kiểm định":
        return "bg-purple-50 text-purple-700 border-purple-200"
      default:
        return "bg-gray-50 text-gray-700 border-gray-200"
    }
  }

  return (
    <Card className="xl:col-span-3">
      <Tabs defaultValue="equipment" className="w-full">
        {/* Modern Tabbed Header */}
        <CardHeader className="pb-3 md:p-8 md:pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900">Thông tin chi tiết</h3>
                <p className="text-sm text-gray-500 mt-1">Thiết bị và kế hoạch cần theo dõi</p>
              </div>
            </div>

            {/* Enhanced Tabs with Icons and Glassmorphism */}
            <TabsList className="grid w-full grid-cols-3 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200/50 p-1">
              <TabsTrigger 
                value="equipment" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg transition-all duration-200 gap-2"
              >
                <Wrench className="h-4 w-4" />
                <span className="hidden sm:inline">Thiết bị</span>
                <span className="sm:hidden text-xs">TB</span>
              </TabsTrigger>
              <TabsTrigger 
                value="plans" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg transition-all duration-200 gap-2"
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Kế hoạch</span>
                <span className="sm:hidden text-xs">KH</span>
              </TabsTrigger>
              <TabsTrigger 
                value="monthly" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg transition-all duration-200 gap-2"
              >
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Tháng này</span>
                <span className="sm:hidden text-xs">T{month}</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>

        <CardContent className="md:p-8 md:pt-0">
          {/* Equipment Tab Content */}
          <TabsContent value="equipment" className="mt-0 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <CardDescription>
                Danh sách các thiết bị cần sửa chữa hoặc đang bảo trì
              </CardDescription>
              <Button asChild size="sm" variant="ghost" className="gap-1 text-blue-600 hover:text-blue-700">
                <Link href="/equipment">
                  Xem tất cả
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            {equipmentError ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Lỗi tải dữ liệu thiết bị</p>
              </div>
            ) : (
              <div className="space-y-3">
                {isLoadingEquipment ? (
                  // Loading skeleton
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="p-4 rounded-xl border border-gray-200/50 bg-white/60 backdrop-blur-sm">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                      </div>
                    </div>
                  ))
                ) : equipmentNeedingAttention && equipmentNeedingAttention.length > 0 ? (
                  equipmentNeedingAttention.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border-l-4 backdrop-blur-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md ${getEquipmentStatusColor(item.tinh_trang_hien_tai)}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 mb-1 truncate">
                            {item.ten_thiet_bi}
                          </h4>
                          <p className="text-sm text-gray-600 mb-2">
                            {item.model || item.ma_thiet_bi}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Vị trí:</span>
                              <span>{item.vi_tri_lap_dat || 'N/A'}</span>
                            </span>
                            {item.ngay_bt_tiep_theo && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <span className="font-medium">BT tiếp:</span>
                                  <span>{item.ngay_bt_tiep_theo}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Badge 
                          variant={item.tinh_trang_hien_tai === 'Chờ sửa chữa' ? 'destructive' : 'secondary'}
                          className="shrink-0"
                        >
                          {item.tinh_trang_hien_tai}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="p-4 bg-gray-100/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Wrench className="h-8 w-8 text-gray-400" />
                    </div>
                    <p>Không có thiết bị nào cần chú ý</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Maintenance Plans Tab Content */}
          <TabsContent value="plans" className="mt-0 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <CardDescription>
                Danh sách các kế hoạch bảo trì, hiệu chuẩn, kiểm định mới nhất
              </CardDescription>
              <Button asChild size="sm" variant="ghost" className="gap-1 text-blue-600 hover:text-blue-700">
                <Link href="/maintenance">
                  Xem tất cả
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            {plansError ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Lỗi tải dữ liệu kế hoạch</p>
              </div>
            ) : (
              <div className="space-y-3">
                {isLoadingPlans ? (
                  // Loading skeleton
                  Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="p-4 rounded-xl border border-gray-200/50 bg-white/60 backdrop-blur-sm">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-5 w-56" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-6 w-16" />
                          <Skeleton className="h-6 w-20" />
                        </div>
                      </div>
                    </div>
                  ))
                ) : planStats?.plans && planStats.plans.length > 0 ? (
                  planStats.plans.map((plan) => (
                    <Link
                      key={plan.id}
                      href={`/maintenance?planId=${plan.id}&tab=tasks`}
                      className="block"
                    >
                      <div className="p-4 rounded-xl border-l-4 border-blue-500 bg-blue-50/80 backdrop-blur-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 mb-1 truncate">
                              {plan.ten_ke_hoach}
                            </h4>
                            <p className="text-sm text-gray-600 mb-2">
                              {plan.khoa_phong || 'Tổng thể'}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {plan.loai_cong_viec}
                              </Badge>
                              <Badge variant={getPlanStatusVariant(plan.trang_thai)} className="text-xs">
                                {plan.trang_thai}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                Năm {plan.nam}
                              </span>
                            </div>
                          </div>
                          <ArrowUpRight className="h-5 w-5 text-gray-400 shrink-0" />
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="p-4 bg-gray-100/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Calendar className="h-8 w-8 text-gray-400" />
                    </div>
                    <p>Chưa có kế hoạch nào</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Monthly Summary Tab Content */}
          <TabsContent value="monthly" className="mt-0 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <CardDescription>
                Công việc tháng {month}/{year}
              </CardDescription>
              <Button asChild size="sm" variant="ghost" className="gap-1 text-blue-600 hover:text-blue-700">
                <Link href="/maintenance">
                  Xem tất cả
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            {calendarError ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Lỗi tải dữ liệu công việc</p>
              </div>
            ) : (
              <div className="space-y-4">
                {isLoadingCalendar ? (
                  // Loading skeleton
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="p-4 rounded-xl border border-gray-200/50 bg-white/60 backdrop-blur-sm">
                        <div className="flex items-start gap-3">
                          <Skeleton className="h-8 w-8 rounded" />
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="p-4 bg-gray-100/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Calendar className="h-8 w-8 text-gray-400" />
                    </div>
                    <p>Không có công việc nào trong tháng này</p>
                  </div>
                ) : (
                  <>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200/50 text-center">
                        <div className="text-2xl font-bold text-blue-600">{calendarStats.total}</div>
                        <div className="text-xs text-blue-600/80 mt-1">Tổng</div>
                      </div>
                      <div className="p-3 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-200/50 text-center">
                        <div className="text-2xl font-bold text-orange-600">{calendarStats.pending}</div>
                        <div className="text-xs text-orange-600/80 mt-1">Chưa HT</div>
                      </div>
                      <div className="p-3 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-200/50 text-center">
                        <div className="text-2xl font-bold text-green-600">{calendarStats.completed}</div>
                        <div className="text-xs text-green-600/80 mt-1">Đã HT</div>
                      </div>
                    </div>

                    {/* Priority Alert */}
                    {priorityTasks.length > 0 && (
                      <div className="p-3 bg-yellow-50/80 border border-yellow-200/50 rounded-xl backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-yellow-700">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium text-sm">{priorityTasks.length} công việc cần ưu tiên</span>
                        </div>
                      </div>
                    )}

                    {/* Type Summary */}
                    {Object.keys(calendarStats.byType).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(calendarStats.byType).map(([type, count]) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {type}: {count}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Tasks List */}
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {/* Pending tasks first */}
                        {pendingTasks.slice(0, 5).map(task => (
                          <div
                            key={task.id}
                            className={`p-3 rounded-xl border-l-4 backdrop-blur-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md ${
                              priorityTasks.includes(task)
                                ? 'border-yellow-500 bg-yellow-50/80'
                                : task.type === 'Bảo trì'
                                ? 'border-blue-500 bg-blue-50/80'
                                : task.type === 'Hiệu chuẩn'
                                ? 'border-orange-500 bg-orange-50/80'
                                : 'border-purple-500 bg-purple-50/80'
                            }`}
                          >
                            <div className="flex items-start gap-2 mb-2">
                              {getTaskIcon(task.type)}
                              <Badge variant="outline" className="text-xs">
                                {task.type}
                              </Badge>
                              {priorityTasks.includes(task) && (
                                <Badge variant="secondary" className="text-xs bg-yellow-200 text-yellow-800">
                                  Ưu tiên
                                </Badge>
                              )}
                            </div>
                            <h5 className="font-semibold text-sm text-gray-900 mb-1">{task.title}</h5>
                            <p className="text-xs text-gray-600">
                              {task.equipmentCode} • {task.department}
                            </p>
                          </div>
                        ))}

                        {/* Completed tasks */}
                        {completedTasks.slice(0, 3).map(task => (
                          <div
                            key={task.id}
                            className="p-3 rounded-xl border-l-4 border-green-500 bg-green-50/80 backdrop-blur-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md"
                          >
                            <div className="flex items-start gap-2 mb-2">
                              {getTaskIcon(task.type)}
                              <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                                {task.type} ✓
                              </Badge>
                            </div>
                            <h5 className="font-semibold text-sm text-gray-900 line-through opacity-75 mb-1">
                              {task.title}
                            </h5>
                            <p className="text-xs text-green-600">✅ Đã hoàn thành</p>
                          </div>
                        ))}

                        {/* Show more indicator */}
                        {events.length > 8 && (
                          <div className="text-center py-2">
                            <Link href="/maintenance">
                              <Button variant="link" size="sm" className="text-blue-600">
                                Xem thêm {events.length - 8} công việc khác...
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </div>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}
