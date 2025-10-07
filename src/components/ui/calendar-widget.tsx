"use client"

import * as React from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns"
import { vi } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useCalendarData, type CalendarEvent } from "@/hooks/use-calendar-data"
import { TaskType } from "@/lib/data"

interface CalendarWidgetProps {
  className?: string
}

const getEventTypeColor = (type: TaskType, isCompleted: boolean) => {
  if (isCompleted) {
    return "bg-green-100 text-green-800 border-green-200"
  }
  
  switch (type) {
    case "Bảo trì":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "Hiệu chuẩn":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "Kiểm định":
      return "bg-purple-100 text-purple-800 border-purple-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

const getEventTypeIcon = (type: TaskType) => {
  switch (type) {
    case "Bảo trì":
      return "🔧"
    case "Hiệu chuẩn":
      return "📏"
    case "Kiểm định":
      return "✅"
    default:
      return "📅"
  }
}

// Loading skeleton component
function CalendarSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-4 md:p-8 md:pb-6">
        <CardTitle className="flex items-center gap-2 text-responsive-lg md:text-2xl font-semibold leading-none tracking-tight">
          <CalendarIcon className="h-4 w-4 md:h-5 md:w-5" />
          <span className="line-clamp-2 md:line-clamp-1">Lịch Bảo trì/Hiệu chuẩn/Kiểm định</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="md:p-8 md:pt-0">
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="grid grid-cols-7 gap-1">
              {[...Array(7)].map((_, j) => (
                <Skeleton key={j} className="h-20 w-full" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Props for CalendarWidgetImpl including navigation handlers
interface CalendarWidgetImplProps extends CalendarWidgetProps {
  currentDate: Date
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
}

// Main calendar implementation
function CalendarWidgetImpl({
  className,
  currentDate,
  onPrevMonth,
  onNextMonth,
  onToday
}: CalendarWidgetImplProps) {
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>("all")
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null)
  const { toast } = useToast()

  // Get calendar range
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Fetch data using custom hook
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1
  const { data, isLoading, error } = useCalendarData(year, month)

  const events = data?.events || []
  const departments = data?.departments || []
  const stats = data?.stats || { total: 0, completed: 0, pending: 0, byType: {} }

  // Show error toast
  React.useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Lỗi tải dữ liệu",
        description: error.message || "Không thể tải lịch bảo trì."
      })
    }
  }, [error, toast])

  // Filter events by department
  const filteredEvents = React.useMemo(() => {
    if (selectedDepartment === "all") return events
    return events.filter(event => event.department === selectedDepartment)
  }, [events, selectedDepartment])

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter(event => isSameDay(event.date, date))
  }

  // Get filtered statistics
  const filteredStats = React.useMemo(() => {
    const total = filteredEvents.length
    const completed = filteredEvents.filter(e => e.isCompleted).length
    const pending = total - completed
    const byType = filteredEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1
      return acc
    }, {} as Record<TaskType, number>)

    return { total, completed, pending, byType }
  }, [filteredEvents])

  // Swipe gesture handlers for mobile month navigation
  const [touchStart, setTouchStart] = React.useState<number | null>(null)
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null)

  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      onNextMonth()
    } else if (isRightSwipe) {
      onPrevMonth()
    }
  }

  return (
    <Card className={className}>
      {/* Mobile-first Enhanced Header */}
      <CardHeader className="pb-4 md:p-8 md:pb-6">
        {/* Mobile: Sticky glassmorphism header */}
        <div className="xl:hidden sticky top-0 z-10 -mx-4 -mt-4 bg-white/80 backdrop-blur-md border-b border-gray-200/50 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <CalendarIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Lịch công việc</h2>
                <p className="text-sm text-gray-500">{format(currentDate, 'MMMM yyyy', { locale: vi })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="h-9 w-9 rounded-lg" onClick={onPrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="h-9 w-9 rounded-lg" onClick={onNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Desktop: Enhanced glassmorphism header */}
        <div className="hidden xl:block">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <CalendarIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-gray-900">Lịch công việc</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Bảo trì, Hiệu chuẩn và Kiểm định thiết bị</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200/50 p-1">
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="w-[200px] border-0 bg-transparent">
                    <SelectValue placeholder="Chọn khoa/phòng" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả khoa/phòng</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile department filter */}
        <div className="xl:hidden mb-3">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200/50 p-1">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-full border-0 bg-transparent">
                <SelectValue placeholder="Chọn khoa/phòng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả khoa/phòng</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Enhanced Mobile Statistics Cards */}
        <div className="grid grid-cols-2 gap-3 xl:hidden">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 backdrop-blur-sm rounded-xl p-3 border border-blue-200/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">{filteredStats.total}</p>
                <p className="text-xs text-blue-600/80">Tổng công việc</p>
              </div>
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <CalendarIcon className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100/50 backdrop-blur-sm rounded-xl p-3 border border-green-200/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{filteredStats.completed}</p>
                <p className="text-xs text-green-600/80">Đã hoàn thành</p>
              </div>
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Check className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 backdrop-blur-sm rounded-xl p-3 border border-orange-200/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-600">{filteredStats.pending}</p>
                <p className="text-xs text-orange-600/80">Chưa hoàn thành</p>
              </div>
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <CalendarIcon className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 backdrop-blur-sm rounded-xl p-3 border border-purple-200/50">
            <div className="flex flex-col">
              <p className="text-xs text-purple-600/80 mb-1">Loại công việc</p>
              {Object.keys(filteredStats.byType).length > 0 ? (
                <div className="space-y-0.5">
                  {Object.entries(filteredStats.byType).map(([type, count]) => (
                    <div key={type} className="text-xs">
                      <span className="font-semibold text-purple-600">{type}:</span>
                      <span className="text-purple-600 ml-1">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-2xl font-bold text-purple-600">0</p>
              )}
            </div>
          </div>
        </div>

        {/* Desktop: Enhanced statistics cards with glassmorphism */}
        <div className="hidden xl:grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 backdrop-blur-sm rounded-xl p-4 border border-blue-200/50 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-blue-600">{filteredStats.total}</p>
                <p className="text-sm text-blue-600/80 mt-1">Tổng công việc</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <CalendarIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100/50 backdrop-blur-sm rounded-xl p-4 border border-green-200/50 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-green-600">{filteredStats.completed}</p>
                <p className="text-sm text-green-600/80 mt-1">Đã hoàn thành</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-xl">
                <Check className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 backdrop-blur-sm rounded-xl p-4 border border-orange-200/50 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-orange-600">{filteredStats.pending}</p>
                <p className="text-sm text-orange-600/80 mt-1">Chưa hoàn thành</p>
              </div>
              <div className="p-3 bg-orange-500/20 rounded-xl">
                <CalendarIcon className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 backdrop-blur-sm rounded-xl p-4 border border-purple-200/50 hover:shadow-md transition-shadow">
            <div>
              <p className="text-sm text-purple-600/80 mb-2">Loại công việc</p>
              {Object.keys(filteredStats.byType).length > 0 ? (
                <div className="space-y-1">
                  {Object.entries(filteredStats.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-purple-600">{type}</span>
                      <span className="text-sm font-bold text-purple-600">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-3xl font-bold text-purple-600">0</p>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="md:p-8 md:pt-0" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {/* Desktop Calendar Header - Enhanced */}
        <div className="hidden xl:flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="default" onClick={onPrevMonth} className="rounded-xl hover:bg-gray-100">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="default" onClick={onToday} className="rounded-xl hover:bg-gray-100 font-medium">
              Hôm nay
            </Button>
            <Button variant="outline" size="default" onClick={onNextMonth} className="rounded-xl hover:bg-gray-100">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <h3 className="text-xl font-bold text-gray-700">
            {format(currentDate, 'MMMM yyyy', { locale: vi })}
          </h3>
        </div>

        {/* Mobile: Today button below header */}
        <div className="xl:hidden flex justify-center mb-3">
          <Button variant="outline" size="sm" onClick={onToday} className="rounded-lg">
            Hôm nay
          </Button>
        </div>

        {/* Calendar Grid */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="grid grid-cols-7 gap-1">
                {[...Array(7)].map((_, j) => (
                  <Skeleton key={j} className="h-20 w-full" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="xl:space-y-1">
            {/* Mobile-Enhanced Calendar Grid */}
            <div className="xl:hidden">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-sm overflow-hidden">
                {/* Day headers */}
                <div className="grid grid-cols-7 bg-gray-50/80 backdrop-blur-sm border-b border-gray-200/50">
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
                    <div key={day} className="p-3 text-center">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{day}</span>
                    </div>
                  ))}
                </div>
                
                {/* Calendar days with enhanced touch targets */}
                <div className="grid grid-cols-7 gap-1 p-2">
                  {calendarDays.map(day => {
                    const dayEvents = getEventsForDate(day)
                    const isCurrentMonth = isSameMonth(day, currentDate)
                    const isToday = isSameDay(day, new Date())

                    return (
                      <Dialog key={day.toISOString()}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            className={`h-12 p-1 flex flex-col items-center justify-center relative rounded-xl transition-all duration-200 ${
                              !isCurrentMonth ? 'text-gray-400' : 'text-gray-900'
                            } ${isToday ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg scale-105' : 'hover:bg-gray-100'}`}
                            onClick={() => setSelectedDate(day)}
                          >
                            <span className="text-sm font-medium">{format(day, 'd')}</span>
                            
                            {/* Enhanced event indicators */}
                            {dayEvents.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {dayEvents.slice(0, 3).map((event, index) => (
                                  <div
                                    key={event.id}
                                    className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                      event.isCompleted ? 'bg-green-400' : 
                                      event.type === 'Bảo trì' ? 'bg-blue-400' :
                                      event.type === 'Hiệu chuẩn' ? 'bg-orange-400' : 'bg-purple-400'
                                    }`}
                                    style={{ animationDelay: `${index * 50}ms` }}
                                  />
                                ))}
                              </div>
                            )}
                          </Button>
                        </DialogTrigger>

                        {/* Enhanced Mobile Modal */}
                        <DialogContent className="xl:hidden max-w-sm mx-4 bg-white/95 backdrop-blur-xl border-0 shadow-2xl rounded-2xl">
                          <DialogHeader className="pb-4 border-b border-gray-200/50">
                            <DialogTitle className="text-lg font-bold text-gray-900">
                              {format(day, 'EEEE, dd MMMM yyyy', { locale: vi })}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="py-4">
                            {dayEvents.length > 0 ? (
                              <div className="space-y-3">
                                {dayEvents.map(event => (
                                  <div
                                    key={event.id}
                                    className={`p-4 rounded-xl border-l-4 backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] ${
                                      event.isCompleted ? 'border-green-500 bg-green-50/80' :
                                      event.type === 'Bảo trì' ? 'border-blue-500 bg-blue-50/80' :
                                      event.type === 'Hiệu chuẩn' ? 'border-orange-500 bg-orange-50/80' :
                                      'border-purple-500 bg-purple-50/80'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="text-lg">{getEventTypeIcon(event.type)}</span>
                                          <Badge className={`text-xs font-medium ${getEventTypeColor(event.type, event.isCompleted)}`}>
                                            {event.type}
                                          </Badge>
                                        </div>
                                        <h4 className="font-semibold text-gray-900 mb-1">{event.title}</h4>
                                        <p className="text-sm text-gray-600 mb-2">{event.department}</p>
                                        {event.equipmentCode && (
                                          <p className="text-xs text-gray-500">{event.equipmentCode}</p>
                                        )}
                                      </div>
                                      {event.isCompleted && (
                                        <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs ml-2">
                                          ✓ Hoàn thành
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <div className="p-4 bg-gray-100/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                  <CalendarIcon className="h-8 w-8 text-gray-400" />
                                </div>
                                <p className="text-gray-500 text-sm">Không có công việc nào trong ngày này</p>
                              </div>
                            )}
                          </div>
                        </DialogContent>

                        {/* Desktop Modal (unchanged) */}
                        <DialogContent className="hidden xl:block max-w-md">
                          <DialogHeader>
                            <DialogTitle>
                              {format(day, 'EEEE, dd MMMM yyyy', { locale: vi })}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            {dayEvents.length > 0 ? (
                              <ScrollArea className="max-h-60">
                                <div className="space-y-2">
                                  {dayEvents.map(event => (
                                    <div
                                      key={event.id}
                                      className={`p-3 rounded-md border-l-4 ${
                                        event.isCompleted ? 'border-green-500 bg-green-50' :
                                        event.type === 'Bảo trì' ? 'border-blue-500 bg-blue-50' :
                                        event.type === 'Hiệu chuẩn' ? 'border-orange-500 bg-orange-50' :
                                        'border-purple-500 bg-purple-50'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="text-lg">{getEventTypeIcon(event.type)}</span>
                                            <Badge className={getEventTypeColor(event.type, event.isCompleted)}>
                                              {event.type}
                                            </Badge>
                                          </div>
                                          <h4 className="font-medium mt-1">{event.title}</h4>
                                          <p className="text-sm text-muted-foreground">
                                            {event.department}
                                          </p>
                                        </div>
                                        {event.isCompleted && (
                                          <Badge variant="secondary" className="ml-2">
                                            Hoàn thành
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            ) : (
                              <p className="text-center text-muted-foreground py-4">
                                Không có công việc nào trong ngày này.
                              </p>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Desktop: Enhanced Calendar Grid with glassmorphism */}
            <div className="hidden xl:block">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-sm overflow-hidden">
                {/* Day headers */}
                <div className="grid grid-cols-7 bg-gray-50/80 backdrop-blur-sm border-b border-gray-200/50">
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
                    <div key={day} className="p-4 text-center">
                      <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{day}</span>
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-2 p-3">
                {calendarDays.map(day => {
                  const dayEvents = getEventsForDate(day)
                  const isCurrentMonth = isSameMonth(day, currentDate)
                  const isToday = isSameDay(day, new Date())

                  return (
                    <Dialog key={day.toISOString()}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          className={`h-24 p-2 flex flex-col items-center justify-center relative rounded-xl transition-all duration-200 ${
                            !isCurrentMonth ? 'text-gray-400' : 'text-gray-900'
                          } ${isToday ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg scale-105' : 'hover:bg-gray-100 hover:shadow-md'}`}
                          onClick={() => setSelectedDate(day)}
                        >
                          <span className="text-base font-semibold mb-1">
                            {format(day, 'd')}
                          </span>
                          
                          {/* Enhanced event indicators */}
                          {dayEvents.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap justify-center">
                              {dayEvents.slice(0, 4).map((event, index) => (
                                <div
                                  key={event.id}
                                  className={`w-2 h-2 rounded-full animate-pulse ${
                                    event.isCompleted ? 'bg-green-400' : 
                                    event.type === 'Bảo trì' ? 'bg-blue-400' :
                                    event.type === 'Hiệu chuẩn' ? 'bg-orange-400' : 'bg-purple-400'
                                  }`}
                                  title={`${event.type}: ${event.title}`}
                                  style={{ animationDelay: `${index * 50}ms` }}
                                />
                              ))}
                              {dayEvents.length > 4 && (
                                <span className={`text-xs font-medium ${
                                  isToday ? 'text-white' : 'text-gray-600'
                                }`}>
                                  +{dayEvents.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </Button>
                      </DialogTrigger>

                      {/* Desktop Day details dialog - Enhanced with glassmorphism */}
                      <DialogContent className="max-w-lg bg-white/95 backdrop-blur-xl border-0 shadow-2xl rounded-2xl">
                        <DialogHeader className="pb-4 border-b border-gray-200/50">
                          <DialogTitle className="text-xl font-bold text-gray-900">
                            {format(day, 'EEEE, dd MMMM yyyy', { locale: vi })}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                          {dayEvents.length > 0 ? (
                            <ScrollArea className="max-h-96">
                              <div className="space-y-3 pr-4">
                                {dayEvents.map(event => (
                                  <div
                                    key={event.id}
                                    className={`p-4 rounded-xl border-l-4 backdrop-blur-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md ${
                                      event.isCompleted ? 'border-green-500 bg-green-50/80' :
                                      event.type === 'Bảo trì' ? 'border-blue-500 bg-blue-50/80' :
                                      event.type === 'Hiệu chuẩn' ? 'border-orange-500 bg-orange-50/80' :
                                      'border-purple-500 bg-purple-50/80'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="text-xl">{getEventTypeIcon(event.type)}</span>
                                          <Badge className={`text-xs font-medium ${getEventTypeColor(event.type, event.isCompleted)}`}>
                                            {event.type}
                                          </Badge>
                                        </div>
                                        <h4 className="font-semibold text-gray-900 mb-1 text-base">{event.title}</h4>
                                        <p className="text-sm text-gray-600 mb-2">{event.department}</p>
                                        {event.equipmentCode && (
                                          <p className="text-xs text-gray-500">{event.equipmentCode}</p>
                                        )}
                                      </div>
                                      {event.isCompleted && (
                                        <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs ml-2">
                                          ✓ Hoàn thành
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          ) : (
                            <div className="text-center py-12">
                              <div className="p-4 bg-gray-100/50 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                                <CalendarIcon className="h-10 w-10 text-gray-400" />
                              </div>
                              <p className="text-gray-500">Không có công việc nào trong ngày này</p>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )
                })}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Main wrapper component
export function CalendarWidget({ className }: CalendarWidgetProps) {
  const [currentDate, setCurrentDate] = React.useState<Date | null>(null)

  // Initialize current date on client side only
  React.useEffect(() => {
    setCurrentDate(new Date())
  }, [])

  const handlePrevMonth = () => {
    if (currentDate) {
      setCurrentDate(subMonths(currentDate, 1))
    }
  }

  const handleNextMonth = () => {
    if (currentDate) {
      setCurrentDate(addMonths(currentDate, 1))
    }
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Show loading skeleton until currentDate is initialized
  if (!currentDate) {
    return <CalendarSkeleton className={className} />
  }

  return (
    <CalendarWidgetImpl
      className={className}
      currentDate={currentDate}
      onPrevMonth={handlePrevMonth}
      onNextMonth={handleNextMonth}
      onToday={handleToday}
    />
  )
} 