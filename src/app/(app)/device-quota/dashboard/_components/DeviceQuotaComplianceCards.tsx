"use client"

import { CheckCircle2, AlertTriangle, XCircle, Layers } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeviceQuotaDashboardContext } from "../_hooks/useDeviceQuotaDashboardContext"

/**
 * DeviceQuotaComplianceCards
 *
 * Displays 4 KPI cards showing compliance summary:
 * 1. Total categories (Tổng danh mục) - blue/neutral
 * 2. Compliant (Đạt định mức) - green
 * 3. Under quota (Thiếu định mức) - red/destructive
 * 4. Over quota (Vượt định mức) - amber/warning
 *
 * Pattern: RepairRequestCard with context-based data fetching
 */
export function DeviceQuotaComplianceCards() {
  const { complianceSummary, isLoading, isError } = useDeviceQuotaDashboardContext()

  if (isError) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Không thể tải dữ liệu</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Total Categories */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Layers className="h-8 w-8 text-blue-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold">
                  {complianceSummary?.total_categories || 0}
                </p>
                <p className="text-sm text-muted-foreground">Tổng danh mục</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compliant */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold">
                  {complianceSummary?.dat_count || 0}
                </p>
                <p className="text-sm text-muted-foreground">Đạt định mức</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Under Quota */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold">
                  {complianceSummary?.thieu_count || 0}
                </p>
                <p className="text-sm text-muted-foreground">Thiếu định mức</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Over Quota */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold">
                  {complianceSummary?.vuot_count || 0}
                </p>
                <p className="text-sm text-muted-foreground">Vượt định mức</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
