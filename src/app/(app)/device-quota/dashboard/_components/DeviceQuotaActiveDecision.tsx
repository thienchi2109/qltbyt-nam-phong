"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { FileText, Calendar, CheckCircle, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { callRpc } from "@/lib/rpc-client"
import { useDeviceQuotaDashboardContext } from "../_hooks/useDeviceQuotaDashboardContext"

// ============================================
// Types
// ============================================

interface DecisionDetails {
  id: number
  don_vi_id: number
  so_quyet_dinh: string
  ngay_ban_hanh: string | null
  ngay_hieu_luc: string | null
  ngay_het_hieu_luc: string | null
  nguoi_ky: string | null
  chuc_vu_nguoi_ky: string | null
  trang_thai: string
  ghi_chu: string | null
}

// ============================================
// Helper Functions
// ============================================

function formatVietnameseDate(dateString: string | null): string {
  if (!dateString) return "—"
  try {
    return format(parseISO(dateString), "dd/MM/yyyy")
  } catch {
    return "—"
  }
}

// ============================================
// Component
// ============================================

export function DeviceQuotaActiveDecision() {
  const { complianceSummary, donViId, isLoading: isSummaryLoading, isError: isSummaryError } = useDeviceQuotaDashboardContext()

  const activeDecisionId = complianceSummary?.quyet_dinh_id

  // Fetch full decision details
  const {
    data: decisionData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["dinh_muc_quyet_dinh_get", { id: activeDecisionId, donViId }],
    queryFn: async () => {
      const result = await callRpc<DecisionDetails>({
        fn: "dinh_muc_quyet_dinh_get",
        args: {
          p_id: activeDecisionId,
          p_don_vi: donViId,
        },
      })
      return result
    },
    enabled: !!activeDecisionId && !!donViId,
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  })

  const hasActiveDecision = !!activeDecisionId && !!decisionData

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          Quyết định hiện hành
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || isSummaryLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : isError || isSummaryError ? (
          <div className="text-sm text-destructive">
            Không thể tải thông tin quyết định
          </div>
        ) : hasActiveDecision ? (
          <div className="space-y-3">
            {/* Decision number and status */}
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">
                {decisionData.so_quyet_dinh}
              </span>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Đang hiệu lực
              </Badge>
            </div>

            {/* Date information */}
            <div className="space-y-2 text-sm">
              {decisionData.ngay_ban_hanh ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Ngày ban hành:</span>
                  <span>{formatVietnameseDate(decisionData.ngay_ban_hanh)}</span>
                </div>
              ) : null}

              {decisionData.ngay_hieu_luc ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Ngày hiệu lực:</span>
                  <span>{formatVietnameseDate(decisionData.ngay_hieu_luc)}</span>
                </div>
              ) : null}

              {decisionData.ngay_het_hieu_luc ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Ngày hết hiệu lực:</span>
                  <span>{formatVietnameseDate(decisionData.ngay_het_hieu_luc)}</span>
                </div>
              ) : null}
            </div>

            {/* View details link */}
            <div className="pt-2">
              <Button variant="link" className="h-auto p-0" asChild>
                <Link href="/device-quota/decisions">
                  Xem chi tiết
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Chưa có quyết định định mức nào đang hiệu lực.
            </p>
            <Button variant="default" asChild>
              <Link href="/device-quota/decisions">
                Tạo quyết định mới
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
