"use client"

import React from "react"
import { format, differenceInMinutes } from "date-fns"
import { vi } from "date-fns/locale"
import { Clock, User, FileText, Trash2, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useEquipmentUsageLogs, useEquipmentUsageLogsMore, useDeleteUsageLog } from "@/hooks/use-usage-logs"
import { useSession } from "next-auth/react"
import { useIsMobile } from "@/hooks/use-mobile"
import { type Equipment, type UsageLog, USAGE_STATUS } from "@/types/database"
import { EndUsageDialog } from "./end-usage-dialog"
import { UsageLogPrint } from "./usage-log-print"

interface UsageHistoryTabProps {
  equipment: Pick<Equipment, 'id' | 'ten_thiet_bi' | 'ma_thiet_bi'> & Partial<Equipment>
}

export function UsageHistoryTab({ equipment }: UsageHistoryTabProps) {
  const { data: session } = useSession()
  const user = session?.user as any
  const userId = React.useMemo(() => {
    const uid = (user?.id as any)
    const n = typeof uid === 'string' ? Number(uid) : uid
    return Number.isFinite(n) ? (n as number) : null
  }, [user?.id])
  const isMobile = useIsMobile()
  const [isEndDialogOpen, setIsEndDialogOpen] = React.useState(false)
  const [selectedUsageLog, setSelectedUsageLog] = React.useState<UsageLog | null>(null)
  const [loadMoreOffset, setLoadMoreOffset] = React.useState(0)
  const [allUsageLogs, setAllUsageLogs] = React.useState<UsageLog[]>([])

  // Initial load - recent usage logs (last 3 months, 50 records)
  const { data: recentUsageLogs, isLoading } = useEquipmentUsageLogs(equipment.id.toString(), {
    limit: 50,
    daysBack: 90, // Last 3 months
  })
  
  // Load more historical data
  const { data: moreUsageLogs, isLoading: isLoadingMore, isFetching: isFetchingMore } = useEquipmentUsageLogsMore(
    equipment.id.toString(),
    loadMoreOffset,
    {
      limit: 50,
      daysBack: 365, // Full year for load more
    }
  )

  // Combine recent and additional usage logs
  React.useEffect(() => {
    const combined = [...(recentUsageLogs || [])]
    if (moreUsageLogs && moreUsageLogs.length > 0) {
      // Add more logs, avoiding duplicates based on ID
      const existingIds = new Set(combined.map(log => log.id))
      const newLogs = moreUsageLogs.filter(log => !existingIds.has(log.id))
      combined.push(...newLogs)
    }
    setAllUsageLogs(combined)
  }, [recentUsageLogs, moreUsageLogs])

  const usageLogs = allUsageLogs
  const deleteUsageLogMutation = useDeleteUsageLog()

  // Find active usage session for current user
  const activeSession = usageLogs?.find(
    log => log.trang_thai === 'dang_su_dung' && (userId != null && log.nguoi_su_dung_id === userId)
  )

  // Check if equipment is currently in use by someone else
  const isInUseByOther = usageLogs?.some(
    log => log.trang_thai === 'dang_su_dung' && (userId == null || log.nguoi_su_dung_id !== userId)
  )

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date()
    const minutes = differenceInMinutes(end, start)
    
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const handleEndUsage = (usageLog: UsageLog) => {
    setSelectedUsageLog(usageLog)
    setIsEndDialogOpen(true)
  }

  const handleDeleteUsageLog = async (id: number) => {
    try {
      await deleteUsageLogMutation.mutateAsync(id)
    } catch (error) {
      // Error handling is done in the mutation
    }
  }

  const canEndUsage = !!activeSession
  
  const handleLoadMore = () => {
    const currentOffset = loadMoreOffset || (recentUsageLogs?.length || 0)
    setLoadMoreOffset(currentOffset + 50)
  }
  
  const hasMoreData = (moreUsageLogs?.length || 0) === 50 // If we got a full page, there might be more
  const showLoadMore = !isLoading && !isLoadingMore && usageLogs.length >= 50 && (loadMoreOffset === 0 || hasMoreData)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        {activeSession && (
          <Button
            onClick={() => handleEndUsage(activeSession)}
            disabled={!canEndUsage}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            Kết thúc sử dụng
          </Button>
        )}

        <UsageLogPrint equipment={equipment} />
      </div>

      {/* Status Messages */}
      {isInUseByOther && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Thiết bị này đang được sử dụng bởi người khác.
          </p>
        </div>
      )}

      {activeSession && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            Bạn đang sử dụng thiết bị này từ{" "}
            {format(new Date(activeSession.thoi_gian_bat_dau), "HH:mm dd/MM/yyyy", { locale: vi })}
          </p>
        </div>
      )}

      {/* Usage History */}
      <div>
        <h4 className="font-medium mb-3">Lịch sử sử dụng</h4>
        
        {!usageLogs || usageLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Chưa có lịch sử sử dụng</p>
          </div>
        ) : (
          <>
            {isMobile ? (
          // Mobile Card Layout
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {usageLogs.map((log) => (
                <Card key={log.id} className="mobile-card-spacing">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {log.nguoi_su_dung?.full_name || 'Không xác định'}
                          </span>
                        </div>
                        <Badge variant={log.trang_thai === 'dang_su_dung' ? 'default' : 'secondary'}>
                          {USAGE_STATUS[log.trang_thai]}
                        </Badge>
                      </div>
                      
                      {(user?.role === 'global' || user?.role === 'admin') && log.trang_thai === 'hoan_thanh' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
                              <AlertDialogDescription>
                                Bạn có chắc chắn muốn xóa bản ghi sử dụng này không?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUsageLog(log.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Xóa
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0 space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {format(new Date(log.thoi_gian_bat_dau), "HH:mm dd/MM/yyyy", { locale: vi })}
                        {log.thoi_gian_ket_thuc && (
                          <> - {format(new Date(log.thoi_gian_ket_thuc), "HH:mm dd/MM/yyyy", { locale: vi })}</>
                        )}
                      </span>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">Thời gian: </span>
                      <span className="font-medium">
                        {formatDuration(log.thoi_gian_bat_dau, log.thoi_gian_ket_thuc)}
                      </span>
                    </div>
                    
                    {log.tinh_trang_thiet_bi && (
                      <div>
                        <span className="text-muted-foreground">Tình trạng: </span>
                        <span>{log.tinh_trang_thiet_bi}</span>
                      </div>
                    )}
                    
                    {log.ghi_chu && (
                      <div className="flex gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{log.ghi_chu}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        ) : (
          // Desktop Table Layout
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người sử dụng</TableHead>
                  <TableHead>Thời gian bắt đầu</TableHead>
                  <TableHead>Thời gian kết thúc</TableHead>
                  <TableHead>Thời lượng</TableHead>
                  <TableHead>Tình trạng TB</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  {(user?.role === 'global' || user?.role === 'admin') && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {log.nguoi_su_dung?.full_name || 'Không xác định'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(log.thoi_gian_bat_dau), "HH:mm dd/MM/yyyy", { locale: vi })}
                    </TableCell>
                    <TableCell>
                      {log.thoi_gian_ket_thuc 
                        ? format(new Date(log.thoi_gian_ket_thuc), "HH:mm dd/MM/yyyy", { locale: vi })
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {formatDuration(log.thoi_gian_bat_dau, log.thoi_gian_ket_thuc)}
                    </TableCell>
                    <TableCell>{log.tinh_trang_thiet_bi || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={log.trang_thai === 'dang_su_dung' ? 'default' : 'secondary'}>
                        {USAGE_STATUS[log.trang_thai]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {log.ghi_chu || '-'}
                    </TableCell>
                    {(user?.role === 'global' || user?.role === 'admin') && (
                      <TableCell>
                        {log.trang_thai === 'hoan_thanh' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Bạn có chắc chắn muốn xóa bản ghi sử dụng này không?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUsageLog(log.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Xóa
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
            )}
            
            {/* Load More Button */}
            {showLoadMore && (
              <div className="text-center mt-4">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isFetchingMore}
                  className="gap-2"
                >
                  {isFetchingMore ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                      Đang tải...
                    </>
                  ) : (
                    'Tải thêm lịch sử'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      
      <EndUsageDialog
        open={isEndDialogOpen}
        onOpenChange={setIsEndDialogOpen}
        usageLog={selectedUsageLog}
      />
    </div>
  )
}
