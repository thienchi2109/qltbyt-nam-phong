"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { Calendar, Clock, Wrench } from "lucide-react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useEquipmentAttentionPaginated } from "@/hooks/use-dashboard-stats"
import { useMaintenancePlans } from "@/hooks/use-cached-maintenance"
import { useCalendarData, type CalendarStats } from "@/hooks/use-calendar-data"
import { getEquipmentAttentionHrefForRole } from "@/lib/equipment-attention-preset"
import { DashboardEquipmentTab } from "@/components/dashboard/dashboard-tabs/DashboardEquipmentTab"
import { DashboardMonthlyTab } from "@/components/dashboard/dashboard-tabs/DashboardMonthlyTab"
import { DashboardPlansTab } from "@/components/dashboard/dashboard-tabs/DashboardPlansTab"

type DashboardTab = "equipment" | "plans" | "monthly"

const EMPTY_CALENDAR_STATS: CalendarStats = {
  total: 0,
  completed: 0,
  pending: 0,
  byType: {} as CalendarStats["byType"],
}

export function DashboardTabs() {
  const { data: session } = useSession()
  const currentDate = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1
  const pageSize = 10

  const [activeTab, setActiveTab] = React.useState<DashboardTab>("equipment")
  const [equipmentPage, setEquipmentPage] = React.useState(1)
  const [planPage, setPlanPage] = React.useState(1)
  const equipmentAttentionHref = getEquipmentAttentionHrefForRole(session?.user?.role)

  const {
    data: equipmentPageData,
    isLoading: isLoadingEquipment,
    isFetching: isFetchingEquipment,
    error: equipmentError,
  } = useEquipmentAttentionPaginated({
    page: equipmentPage,
    pageSize,
    enabled: activeTab === "equipment",
  })

  const {
    data: planListData,
    isLoading: isLoadingPlans,
    isFetching: isFetchingPlans,
    error: plansError,
  } = useMaintenancePlans(
    { page: planPage, pageSize },
    { enabled: activeTab === "plans" }
  )

  const {
    data: calendarData,
    isLoading: isLoadingCalendar,
    isFetching: isFetchingCalendar,
    error: calendarError,
  } = useCalendarData(year, month, { enabled: activeTab === "monthly" })

  const equipmentNeedingAttention = equipmentPageData?.data ?? []
  const equipmentTotal = equipmentPageData?.total ?? 0
  const equipmentTotalPages = equipmentTotal > 0 ? Math.ceil(equipmentTotal / pageSize) : 1
  const equipmentHasMore = equipmentPageData?.hasMore ?? (equipmentPage < equipmentTotalPages)

  const planItems = planListData?.data ?? []
  const planTotal = planListData?.total ?? 0
  const planTotalPages = planTotal > 0 ? Math.ceil(planTotal / pageSize) : 1
  const planHasMore = planPage < planTotalPages

  React.useEffect(() => {
    if (!equipmentPageData) return
    if (equipmentPage > equipmentTotalPages) {
      setEquipmentPage(equipmentTotalPages)
    }
  }, [equipmentPage, equipmentPageData, equipmentTotalPages])

  React.useEffect(() => {
    if (!planListData) return
    if (planPage > planTotalPages) {
      setPlanPage(planTotalPages)
    }
  }, [planPage, planListData, planTotalPages])

  const events = calendarData?.events || []
  const calendarStats = calendarData?.stats || EMPTY_CALENDAR_STATS
  const pendingTasks = events.filter((event) => !event.isCompleted)
  const completedTasks = events.filter((event) => event.isCompleted)
  const priorityTasks = pendingTasks.filter(() => currentDate.getDate() > 15)

  const showEquipmentSkeleton = isLoadingEquipment || (isFetchingEquipment && !equipmentPageData)
  const showPlanSkeleton = isLoadingPlans || (isFetchingPlans && !planListData)
  const showCalendarSkeleton = isLoadingCalendar || (isFetchingCalendar && !calendarData)

  return (
    <TooltipProvider delayDuration={300}>
      <Card className="min-w-0 overflow-hidden xl:col-span-3">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as DashboardTab)}
          className="w-full"
        >
          <CardHeader className="pb-3 md:p-8 md:pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">Thông tin chi tiết</h3>
                  <p className="text-sm text-gray-500 mt-1">Thiết bị và kế hoạch cần theo dõi</p>
                </div>
              </div>

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

          <CardContent className="min-w-0 overflow-hidden md:p-8 md:pt-0">
            <DashboardEquipmentTab
              equipmentAttentionHref={equipmentAttentionHref}
              equipmentError={equipmentError}
              showEquipmentSkeleton={showEquipmentSkeleton}
              equipmentNeedingAttention={equipmentNeedingAttention}
              equipmentPageDataLoaded={Boolean(equipmentPageData)}
              equipmentPage={equipmentPage}
              equipmentTotalPages={equipmentTotalPages}
              equipmentTotal={equipmentTotal}
              equipmentHasMore={equipmentHasMore}
              isFetchingEquipment={isFetchingEquipment}
              onPreviousPage={() => setEquipmentPage((prev) => Math.max(1, prev - 1))}
              onNextPage={() => setEquipmentPage((prev) => prev + 1)}
            />

            <DashboardPlansTab
              plansError={plansError}
              showPlanSkeleton={showPlanSkeleton}
              planItems={planItems}
              planListDataLoaded={Boolean(planListData)}
              planPage={planPage}
              planTotalPages={planTotalPages}
              planTotal={planTotal}
              planHasMore={planHasMore}
              isFetchingPlans={isFetchingPlans}
              onPreviousPage={() => setPlanPage((prev) => Math.max(1, prev - 1))}
              onNextPage={() => setPlanPage((prev) => prev + 1)}
            />

            <DashboardMonthlyTab
              month={month}
              year={year}
              calendarError={calendarError}
              showCalendarSkeleton={showCalendarSkeleton}
              events={events}
              calendarStats={calendarStats}
              pendingTasks={pendingTasks}
              completedTasks={completedTasks}
              priorityTasks={priorityTasks}
            />
          </CardContent>
        </Tabs>
      </Card>
    </TooltipProvider>
  )
}
