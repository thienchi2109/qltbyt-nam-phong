"use client"

import React from "react"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { 
  Clock, 
  Users, 
  Activity, 
  TrendingUp, 
  Calendar,
  BarChart3,
  PieChart,
  Download
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  useUsageOverview,
  useEquipmentUsageStats,
  useUserUsageStats,
  useDailyUsageData
} from "@/hooks/use-usage-analytics"

interface UsageAnalyticsDashboardProps {
  className?: string
}

export function UsageAnalyticsDashboard({ className = "" }: UsageAnalyticsDashboardProps) {
  const isMobile = useIsMobile()
  const [dateRange, setDateRange] = React.useState<{ from: Date; to: Date } | undefined>()

  const { data: overview, isLoading: overviewLoading } = useUsageOverview()
  const { data: equipmentStats, isLoading: equipmentLoading } = useEquipmentUsageStats(dateRange)
  const { data: userStats, isLoading: userLoading } = useUserUsageStats(dateRange)
  const { data: dailyData, isLoading: dailyLoading } = useDailyUsageData(30)

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} phút`
    }
    const hours = Math.floor(minutes / 60)
    const remainingMins = minutes % 60
    if (remainingMins === 0) {
      return `${hours} giờ`
    }
    return `${hours}h ${remainingMins}m`
  }

  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng phiên sử dụng</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{overview?.totalSessions || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {overview?.activeSessions || 0} đang hoạt động
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng thời gian sử dụng</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {formatTime(overview?.totalUsageTime || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              TB: {formatDuration(overview?.averageSessionTime || 0)}/phiên
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Thiết bị được dùng nhiều nhất</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : overview?.mostUsedEquipment ? (
              <>
                <div className="text-lg font-bold truncate">
                  {overview.mostUsedEquipment.ten_thiet_bi}
                </div>
                <p className="text-xs text-muted-foreground">
                  {overview.mostUsedEquipment.sessionCount} phiên
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Chưa có dữ liệu</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Người dùng tích cực nhất</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : overview?.topUser ? (
              <>
                <div className="text-lg font-bold truncate">
                  {overview.topUser.full_name}
                </div>
                <p className="text-xs text-muted-foreground">
                  {overview.topUser.sessionCount} phiên
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Chưa có dữ liệu</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="equipment" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="equipment">Thống kê thiết bị</TabsTrigger>
          <TabsTrigger value="users">Thống kê người dùng</TabsTrigger>
        </TabsList>

        <TabsContent value="equipment" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Thống kê sử dụng thiết bị</CardTitle>
                <CardDescription>
                  Danh sách thiết bị và mức độ sử dụng
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => equipmentStats && exportToCSV(
                  equipmentStats,
                  'thong-ke-thiet-bi',
                  ['ma_thiet_bi', 'ten_thiet_bi', 'khoa_phong_quan_ly', 'sessionCount', 'totalUsageTime', 'averageSessionTime']
                )}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Xuất CSV
              </Button>
            </CardHeader>
            <CardContent>
              {equipmentLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !equipmentStats || equipmentStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Chưa có dữ liệu thống kê thiết bị</p>
                </div>
              ) : isMobile ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {equipmentStats.map((equipment) => (
                      <Card key={equipment.id} className="mobile-card-spacing">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <CardTitle className="text-base">{equipment.ten_thiet_bi}</CardTitle>
                              <CardDescription>{equipment.ma_thiet_bi}</CardDescription>
                            </div>
                            {equipment.currentlyInUse && (
                              <Badge variant="default" className="gap-1">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                Đang dùng
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Số phiên:</span>
                            <span className="font-medium">{equipment.sessionCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tổng thời gian:</span>
                            <span className="font-medium">{formatTime(equipment.totalUsageTime)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">TB/phiên:</span>
                            <span className="font-medium">{formatDuration(equipment.averageSessionTime)}</span>
                          </div>
                          {equipment.khoa_phong_quan_ly && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Khoa/Phòng:</span>
                              <span className="font-medium">{equipment.khoa_phong_quan_ly}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mã thiết bị</TableHead>
                        <TableHead>Tên thiết bị</TableHead>
                        <TableHead>Khoa/Phòng</TableHead>
                        <TableHead className="text-right">Số phiên</TableHead>
                        <TableHead className="text-right">Tổng thời gian</TableHead>
                        <TableHead className="text-right">TB/phiên</TableHead>
                        <TableHead>Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {equipmentStats.map((equipment) => (
                        <TableRow key={equipment.id}>
                          <TableCell className="font-mono">{equipment.ma_thiet_bi}</TableCell>
                          <TableCell className="font-medium">{equipment.ten_thiet_bi}</TableCell>
                          <TableCell>{equipment.khoa_phong_quan_ly || '-'}</TableCell>
                          <TableCell className="text-right">{equipment.sessionCount}</TableCell>
                          <TableCell className="text-right">{formatTime(equipment.totalUsageTime)}</TableCell>
                          <TableCell className="text-right">{formatDuration(equipment.averageSessionTime)}</TableCell>
                          <TableCell>
                            {equipment.currentlyInUse ? (
                              <Badge variant="default" className="gap-1">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                Đang dùng
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Rảnh</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Thống kê người dùng</CardTitle>
                <CardDescription>
                  Danh sách người dùng và hoạt động sử dụng thiết bị
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => userStats && exportToCSV(
                  userStats,
                  'thong-ke-nguoi-dung',
                  ['full_name', 'khoa_phong', 'sessionCount', 'totalUsageTime', 'equipmentUsed', 'averageSessionTime']
                )}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Xuất CSV
              </Button>
            </CardHeader>
            <CardContent>
              {userLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !userStats || userStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Chưa có dữ liệu thống kê người dùng</p>
                </div>
              ) : isMobile ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {userStats.map((user) => (
                      <Card key={user.id} className="mobile-card-spacing">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">{user.full_name}</CardTitle>
                          {user.khoa_phong && (
                            <CardDescription>{user.khoa_phong}</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="pt-0 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Số phiên:</span>
                            <span className="font-medium">{user.sessionCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tổng thời gian:</span>
                            <span className="font-medium">{formatTime(user.totalUsageTime)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">TB/phiên:</span>
                            <span className="font-medium">{formatDuration(user.averageSessionTime)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Thiết bị đã dùng:</span>
                            <span className="font-medium">{user.equipmentUsed}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Họ tên</TableHead>
                        <TableHead>Khoa/Phòng</TableHead>
                        <TableHead className="text-right">Số phiên</TableHead>
                        <TableHead className="text-right">Tổng thời gian</TableHead>
                        <TableHead className="text-right">TB/phiên</TableHead>
                        <TableHead className="text-right">Thiết bị đã dùng</TableHead>
                        <TableHead>Hoạt động cuối</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userStats.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>{user.khoa_phong || '-'}</TableCell>
                          <TableCell className="text-right">{user.sessionCount}</TableCell>
                          <TableCell className="text-right">{formatTime(user.totalUsageTime)}</TableCell>
                          <TableCell className="text-right">{formatDuration(user.averageSessionTime)}</TableCell>
                          <TableCell className="text-right">{user.equipmentUsed}</TableCell>
                          <TableCell>
                            {user.lastActivity 
                              ? format(new Date(user.lastActivity), 'dd/MM/yyyy', { locale: vi })
                              : '-'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
