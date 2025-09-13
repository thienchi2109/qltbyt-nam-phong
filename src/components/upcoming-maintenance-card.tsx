"use client"

import * as React from "react"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { Clock, Calendar, Wrench, AlertTriangle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useCalendarData } from "@/hooks/use-calendar-data"
import { TaskType } from "@/lib/data"
import Link from "next/link"

interface UpcomingMaintenanceCardProps {
  className?: string
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

export function UpcomingMaintenanceCard({ className }: UpcomingMaintenanceCardProps) {
  const currentDate = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1
  
  const { data, isLoading, error } = useCalendarData(year, month)
  
  const events = data?.events || []
  const stats = data?.stats || { total: 0, completed: 0, pending: 0, byType: {} }
  
  // Separate completed and pending tasks
  const pendingTasks = events.filter(event => !event.isCompleted)
  const completedTasks = events.filter(event => event.isCompleted)
  
  // Get overdue tasks (this is simplified - in reality you'd need actual due dates)
  const overdueTasks = pendingTasks.filter(task => {
    // For demo purposes, consider tasks overdue if they're in the first half of the month
    return currentDate.getDate() > 15
  })

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Lỗi tải dữ liệu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Không thể tải thông tin lịch bảo trì. Vui lòng thử lại sau.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-responsive-lg md:text-2xl font-semibold leading-none tracking-tight">
            <Calendar className="h-4 w-4 md:h-5 md:w-5" />
            Công việc tháng {month}/{year}
          </CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/maintenance">
              Xem tất cả
            </Link>
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-6">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Không có công việc nào được lên lịch cho tháng này.
            </p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">
                  {stats.total}
                </div>
                <div className="text-xs text-muted-foreground">Tổng</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-orange-600">
                  {stats.pending}
                </div>
                <div className="text-xs text-muted-foreground">Chưa HT</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {stats.completed}
                </div>
                <div className="text-xs text-muted-foreground">Đã HT</div>
              </div>
            </div>

            {/* Overdue Alert */}
            {overdueTasks.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Chú ý: {overdueTasks.length} công việc cần ưu tiên</span>
                </div>
                <p className="text-sm text-red-600">
                  Có {overdueTasks.length} công việc cần được hoàn thành sớm để đảm bảo tiến độ.
                </p>
              </div>
            )}

            {/* Tasks List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Danh sách công việc</h4>
                <div className="flex gap-2">
                  {Object.entries(stats.byType).map(([type, count]) => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {type}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {/* Show pending tasks first */}
                  {pendingTasks.map(task => (
                    <div
                      key={task.id}
                      className={`p-3 rounded-lg border ${
                        overdueTasks.includes(task) 
                          ? 'border-red-200 bg-red-50' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getTaskIcon(task.type)}
                          <Badge className={getTaskColor(task.type)}>
                            {task.type}
                          </Badge>
                          {overdueTasks.includes(task) && (
                            <Badge variant="destructive" className="text-xs">
                              Ưu tiên
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <h5 className="font-medium text-sm">{task.title}</h5>
                        <p className="text-xs text-muted-foreground">
                          Mã TB: {task.equipmentCode} • {task.department}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Kế hoạch: {task.planName}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {/* Show completed tasks */}
                  {completedTasks.map(task => (
                    <div
                      key={task.id}
                      className="p-3 rounded-lg border border-green-200 bg-green-50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getTaskIcon(task.type)}
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            {task.type} ✓
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <h5 className="font-medium text-sm line-through opacity-75">
                          {task.title}
                        </h5>
                        <p className="text-xs text-muted-foreground">
                          Mã TB: {task.equipmentCode} • {task.department}
                        </p>
                        <p className="text-xs text-green-600">
                          ✅ Đã hoàn thành
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
} 