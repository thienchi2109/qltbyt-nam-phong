"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useRepairRequests } from "@/hooks/use-cached-repair"
import { Wrench } from "lucide-react"

export function RepairRequestCard() {
  const { data: repairRequests, isLoading } = useRepairRequests()
  
  const repairRequestsCount = repairRequests?.filter(req => 
    req.trang_thai === 'Chờ xử lý' || req.trang_thai === 'Đã duyệt'
  )?.length || 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Yêu cầu sửa chữa</CardTitle>
        <Wrench className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-1/4" />
        ) : (
          <div className="text-2xl font-bold">{repairRequestsCount}</div>
        )}
        <p className="text-xs text-muted-foreground">
          Yêu cầu đang chờ xử lý hoặc đang thực hiện
        </p>
      </CardContent>
    </Card>
  )
} 