"use client"

import * as React from "react"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeviceQuotaChiTietContext } from "../_hooks/useDeviceQuotaChiTietContext"
import type { QuotaDetail } from "./DeviceQuotaChiTietContext"

// ============================================
// Helper: Compliance Status
// ============================================

interface ComplianceStatusProps {
  soLuongHienCo: number
  soLuongDinhMuc: number
  soLuongToiThieu: number | null
}

function ComplianceStatus({ soLuongHienCo, soLuongDinhMuc, soLuongToiThieu }: ComplianceStatusProps) {
  // Check if over quota (exceeds maximum allowed)
  const isOverQuota = soLuongHienCo > soLuongDinhMuc

  // Check if under minimum (if minimum is specified)
  const isUnderMinimum = soLuongToiThieu !== null && soLuongHienCo < soLuongToiThieu

  // Compliant = within range [toi_thieu, dinh_muc]
  if (isOverQuota) {
    return (
      <Badge variant="destructive" className="bg-orange-600 hover:bg-orange-700">
        <AlertCircle className="h-3 w-3 mr-1" />
        Vượt định mức
      </Badge>
    )
  }

  if (isUnderMinimum) {
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Chưa đạt
      </Badge>
    )
  }

  // Within range: meets minimum (or no minimum) AND doesn't exceed maximum
  return (
    <Badge variant="default" className="bg-green-600 hover:bg-green-700">
      <CheckCircle className="h-3 w-3 mr-1" />
      Đạt định mức
    </Badge>
  )
}

// ============================================
// Loading Skeleton
// ============================================

function TableLoadingSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, idx) => (
        <TableRow key={idx}>
          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

// ============================================
// Empty State
// ============================================

function EmptyState({ isDraft }: { isDraft: boolean }) {
  return (
    <TableRow>
      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
        <div className="flex flex-col items-center justify-center gap-2">
          <span className="text-lg font-medium">Chưa có định mức nào</span>
          {isDraft && (
            <span className="text-sm">Nhấn "Nhập từ Excel" để thêm định mức hàng loạt</span>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

// ============================================
// Mobile Card View (Responsive)
// ============================================

interface MobileQuotaCardProps {
  detail: QuotaDetail
  index: number
}

function MobileQuotaCard({ detail, index }: MobileQuotaCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1">
          <p className="text-sm text-muted-foreground">#{index + 1}</p>
          <p className="font-medium text-base">{detail.ten_nhom}</p>
          <p className="text-xs text-muted-foreground">Mã: {detail.ma_nhom}</p>
        </div>
        <ComplianceStatus
          soLuongHienCo={detail.so_luong_hien_co}
          soLuongDinhMuc={detail.so_luong_dinh_muc}
          soLuongToiThieu={detail.so_luong_toi_thieu}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-muted-foreground">Đơn vị tính</p>
          <p className="font-medium">{detail.don_vi_tinh || "-"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Định mức</p>
          <p className="font-medium">{detail.so_luong_dinh_muc}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Tối thiểu</p>
          <p className="font-medium">{detail.so_luong_toi_thieu ?? "-"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Hiện có</p>
          <p className="font-medium">{detail.so_luong_hien_co}</p>
        </div>
      </div>

      {detail.ghi_chu && (
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">Ghi chú</p>
          <p className="text-sm">{detail.ghi_chu}</p>
        </div>
      )}
    </div>
  )
}

// ============================================
// Main Table Component
// ============================================

export function DeviceQuotaChiTietTable() {
  const {
    quotaDetails,
    isDetailsLoading,
    decision,
  } = useDeviceQuotaChiTietContext()

  const isDraft = decision?.trang_thai === 'draft'

  return (
    <>
      {/* Desktop Table View (hidden on mobile) */}
      <div className="hidden md:block rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-muted/50 border-b border-border/60">
              <TableHead className="text-xs font-semibold uppercase tracking-wider w-[60px]">
                STT
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">
                Mã nhóm
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">
                Tên thiết bị
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider w-[120px]">
                Đơn vị tính
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider w-[130px] text-right">
                Định mức
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider w-[130px] text-right">
                Tối thiểu
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider w-[130px] text-right">
                Hiện có
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider w-[150px]">
                Trạng thái
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isDetailsLoading ? (
              <TableLoadingSkeleton />
            ) : quotaDetails.length === 0 ? (
              <EmptyState isDraft={isDraft} />
            ) : (
              quotaDetails.map((detail, index) => (
                <TableRow key={detail.id} className="hover:bg-muted/40">
                  <TableCell className="text-center text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {detail.ma_nhom}
                  </TableCell>
                  <TableCell className="font-medium">
                    {detail.ten_nhom}
                  </TableCell>
                  <TableCell>
                    {detail.don_vi_tinh || "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {detail.so_luong_dinh_muc}
                  </TableCell>
                  <TableCell className="text-right">
                    {detail.so_luong_toi_thieu ?? "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {detail.so_luong_hien_co}
                  </TableCell>
                  <TableCell>
                    <ComplianceStatus
                      soLuongHienCo={detail.so_luong_hien_co}
                      soLuongDinhMuc={detail.so_luong_dinh_muc}
                      soLuongToiThieu={detail.so_luong_toi_thieu}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {isDetailsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton key={idx} className="h-48 w-full" />
            ))}
          </div>
        ) : quotaDetails.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            <p className="font-medium">Chưa có định mức nào</p>
            {isDraft && (
              <p className="text-sm mt-1">Nhấn "Nhập từ Excel" để thêm định mức</p>
            )}
          </div>
        ) : (
          quotaDetails.map((detail, index) => (
            <MobileQuotaCard
              key={detail.id}
              detail={detail}
              index={index}
            />
          ))
        )}
      </div>
    </>
  )
}
