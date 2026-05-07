import Link from "next/link"
import { AlertTriangle, ArrowUpRight, Calendar, Clock, Wrench } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardDescription } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { TabsContent } from "@/components/ui/tabs"
import type { CalendarEvent, CalendarStats } from "@/hooks/use-calendar-data"

interface DashboardMonthlyTabProps {
  month: number
  year: number
  calendarError: unknown
  showCalendarSkeleton: boolean
  events: CalendarEvent[]
  calendarStats: CalendarStats
  pendingTasks: CalendarEvent[]
  completedTasks: CalendarEvent[]
  priorityTasks: CalendarEvent[]
}

function getTaskIcon(type: CalendarEvent["type"]) {
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

export function DashboardMonthlyTab({
  month,
  year,
  calendarError,
  showCalendarSkeleton,
  events,
  calendarStats,
  pendingTasks,
  completedTasks,
  priorityTasks,
}: DashboardMonthlyTabProps) {
  return (
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
          {showCalendarSkeleton ? (
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

              {priorityTasks.length > 0 && (
                <div className="p-3 bg-yellow-50/80 border border-yellow-200/50 rounded-xl backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium text-sm">{priorityTasks.length} công việc cần ưu tiên</span>
                  </div>
                </div>
              )}

              {Object.keys(calendarStats.byType).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(calendarStats.byType).map(([type, count]) => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {type}: {count}
                    </Badge>
                  ))}
                </div>
              )}

              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {pendingTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className={`p-3 rounded-xl border-l-4 backdrop-blur-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md ${priorityTasks.includes(task)
                        ? "border-yellow-500 bg-yellow-50/80"
                        : task.type === "Bảo trì"
                          ? "border-blue-500 bg-blue-50/80"
                          : task.type === "Hiệu chuẩn"
                            ? "border-orange-500 bg-orange-50/80"
                            : "border-purple-500 bg-purple-50/80"
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

                  {completedTasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl border border-green-200/60 bg-gradient-to-r from-green-100/70 via-green-50/80 to-white p-3 backdrop-blur-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md"
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
  )
}
