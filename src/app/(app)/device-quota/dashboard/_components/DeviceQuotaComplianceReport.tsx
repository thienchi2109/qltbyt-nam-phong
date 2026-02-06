"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { Printer, Loader2, AlertCircle } from "lucide-react"

import { callRpc } from "@/lib/rpc-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// ============================================
// Types
// ============================================

interface ComplianceDetailRow {
  quyet_dinh_id: number
  nhom_thiet_bi_id: number
  ma_nhom: string
  ten_nhom: string
  phan_loai: string
  so_luong_toi_thieu: number
  so_luong_toi_da: number
  so_luong_hien_co: number
  trang_thai_tuan_thu: "dat" | "thieu" | "vuot"
  chenh_lech: number
}

interface DeviceQuotaComplianceReportProps {
  decisionId: number
  facilityName: string
  decisionNumber: string
}

// ============================================
// Component
// ============================================

/**
 * DeviceQuotaComplianceReport
 *
 * Vietnamese government-compliant compliance report for medical equipment quotas.
 * Follows Vietnamese document formatting standards with proper headers, tables, and signature blocks.
 *
 * Features:
 * - Print-optimized layout (A4 paper size)
 * - Vietnamese locale date formatting
 * - Proper government document header (CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM)
 * - Status color-coding (screen) with print-friendly black/white
 * - Summary statistics and detailed compliance table
 * - Signature blocks for approval
 *
 * Reference: Thông tư 08/2019/TT-BYT
 *
 * @example
 * <DeviceQuotaComplianceReport
 *   decisionId={123}
 *   facilityName="Bệnh viện Đa khoa Trung ương"
 *   decisionNumber="123/QĐ-BYT"
 * />
 */
export function DeviceQuotaComplianceReport({
  decisionId,
  facilityName,
  decisionNumber,
}: DeviceQuotaComplianceReportProps) {
  const [isPrinting, setIsPrinting] = React.useState(false)

  // Fetch compliance detail data
  const {
    data: complianceData = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["dinh_muc_compliance_detail", { decisionId }],
    queryFn: async () => {
      const result = await callRpc<ComplianceDetailRow[]>({
        fn: "dinh_muc_compliance_detail",
        args: {
          p_quyet_dinh_id: decisionId,
          p_don_vi: null, // RPC will enforce tenant isolation
        },
      })
      return result || []
    },
    enabled: !!decisionId,
    staleTime: 60000, // 1 minute
  })

  // Calculate summary statistics
  const summary = React.useMemo(() => {
    const dat = complianceData.filter((row) => row.trang_thai_tuan_thu === "dat").length
    const thieu = complianceData.filter((row) => row.trang_thai_tuan_thu === "thieu").length
    const vuot = complianceData.filter((row) => row.trang_thai_tuan_thu === "vuot").length
    return { dat, thieu, vuot }
  }, [complianceData])

  // Print handler
  const handlePrint = React.useCallback(() => {
    setIsPrinting(true)
    // Small delay to allow state update to render
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 100)
  }, [])

  // Error state
  if (isError) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">
              Không thể tải báo cáo: {error instanceof Error ? error.message : "Lỗi không xác định"}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  const currentDate = format(new Date(), "dd/MM/yyyy", { locale: vi })

  return (
    <>
      {/* Print Button - Hidden during print */}
      <div className="print:hidden mb-4 flex justify-end">
        <Button onClick={handlePrint} disabled={isPrinting}>
          {isPrinting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang in...
            </>
          ) : (
            <>
              <Printer className="mr-2 h-4 w-4" />
              In báo cáo
            </>
          )}
        </Button>
      </div>

      {/* Report Container - A4 Paper Size */}
      <div className="bg-white print:bg-white min-h-screen print:min-h-0">
        <div className="report-container mx-auto p-8 print:p-12 max-w-[210mm] print:max-w-none">
          {/* Government Header */}
          <div className="text-center mb-8 space-y-1">
            <p className="font-bold text-sm uppercase tracking-wide">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </p>
            <p className="font-semibold text-sm">Độc lập - Tự do - Hạnh phúc</p>
            <div className="flex justify-center mt-2">
              <div className="border-b-2 border-black w-32" />
            </div>
          </div>

          {/* Report Title */}
          <div className="text-center mb-8 space-y-2">
            <h1 className="text-xl font-bold uppercase">
              BÁO CÁO TÌNH TRẠNG ĐỊNH MỨC THIẾT BỊ Y TẾ
            </h1>
            <p className="text-sm text-gray-600">(Theo Thông tư 08/2019/TT-BYT)</p>
          </div>

          {/* Report Metadata */}
          <div className="mb-8 space-y-1 text-sm">
            <p>
              <span className="font-semibold">Đơn vị:</span> {facilityName}
            </p>
            <p>
              <span className="font-semibold">Quyết định số:</span> {decisionNumber}
            </p>
            <p>
              <span className="font-semibold">Ngày lập báo cáo:</span> {currentDate}
            </p>
          </div>

          {/* Compliance Table */}
          <div className="mb-8 overflow-hidden border border-black">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 print:bg-gray-100">
                  <th className="border border-black px-3 py-2 text-sm font-semibold text-center w-12">
                    TT
                  </th>
                  <th className="border border-black px-3 py-2 text-sm font-semibold text-left">
                    Danh mục thiết bị
                  </th>
                  <th className="border border-black px-3 py-2 text-sm font-semibold text-center w-28">
                    Định mức
                  </th>
                  <th className="border border-black px-3 py-2 text-sm font-semibold text-center w-20">
                    Hiện có
                  </th>
                  <th className="border border-black px-3 py-2 text-sm font-semibold text-center w-20">
                    Chênh lệch
                  </th>
                  <th className="border border-black px-3 py-2 text-sm font-semibold text-center w-28">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody>
                {complianceData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border border-black px-3 py-4 text-center text-sm text-gray-500">
                      Không có dữ liệu
                    </td>
                  </tr>
                ) : (
                  complianceData.map((row, index) => {
                    // Status display
                    const statusText = {
                      dat: "Đạt",
                      thieu: "Thiếu",
                      vuot: "Vượt",
                    }[row.trang_thai_tuan_thu]

                    // Color classes (hidden in print)
                    const statusColorClass = {
                      dat: "text-green-700 print:text-black",
                      thieu: "text-red-700 print:text-black",
                      vuot: "text-amber-700 print:text-black",
                    }[row.trang_thai_tuan_thu]

                    // Format difference display
                    const chenhLechDisplay =
                      row.chenh_lech > 0
                        ? `+${row.chenh_lech}`
                        : row.chenh_lech < 0
                        ? row.chenh_lech.toString()
                        : "0"

                    return (
                      <tr key={row.nhom_thiet_bi_id} className="hover:bg-gray-50 print:hover:bg-transparent">
                        <td className="border border-black px-3 py-2 text-sm text-center">
                          {index + 1}
                        </td>
                        <td className="border border-black px-3 py-2 text-sm">
                          <div>
                            <p className="font-medium">{row.ten_nhom}</p>
                            <p className="text-xs text-gray-600 print:text-gray-800">
                              Mã: {row.ma_nhom} | Phân loại: {row.phan_loai || "N/A"}
                            </p>
                          </div>
                        </td>
                        <td className="border border-black px-3 py-2 text-sm text-center">
                          {row.so_luong_toi_thieu} - {row.so_luong_toi_da}
                        </td>
                        <td className="border border-black px-3 py-2 text-sm text-center font-medium">
                          {row.so_luong_hien_co}
                        </td>
                        <td className={`border border-black px-3 py-2 text-sm text-center font-medium ${statusColorClass}`}>
                          {chenhLechDisplay}
                        </td>
                        <td className={`border border-black px-3 py-2 text-sm text-center font-semibold ${statusColorClass}`}>
                          {statusText}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Summary Statistics */}
          <div className="mb-12 space-y-1 text-sm">
            <p className="font-semibold mb-2">Tổng kết:</p>
            <p className="ml-4">- Đạt định mức: {summary.dat} danh mục</p>
            <p className="ml-4">- Thiếu định mức: {summary.thieu} danh mục</p>
            <p className="ml-4">- Vượt định mức: {summary.vuot} danh mục</p>
          </div>

          {/* Signature Blocks */}
          <div className="grid grid-cols-2 gap-8 mt-16">
            <div className="text-center">
              <p className="font-semibold mb-1">NGƯỜI LẬP</p>
              <p className="text-sm text-gray-600 mb-16">(Ký, ghi rõ họ tên)</p>
              <div className="border-t border-gray-400 pt-1 mx-auto w-48">
                <p className="text-xs text-gray-500">Chữ ký</p>
              </div>
            </div>
            <div className="text-center">
              <p className="font-semibold mb-1">PHÊ DUYỆT</p>
              <p className="text-sm text-gray-600 mb-16">(Ký, ghi rõ họ tên)</p>
              <div className="border-t border-gray-400 pt-1 mx-auto w-48">
                <p className="text-xs text-gray-500">Chữ ký</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print-specific styles */}
      <style jsx>{`
        @media print {
          /* A4 Page Setup */
          @page {
            size: A4 portrait;
            margin: 15mm;
          }

          /* Hide everything except report */
          body * {
            visibility: hidden;
          }

          .report-container,
          .report-container * {
            visibility: visible;
          }

          .report-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }

          /* Remove shadows and rounded corners */
          * {
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          /* Ensure black borders */
          table,
          th,
          td {
            border-color: #000 !important;
          }

          /* Page breaks */
          .report-container {
            page-break-after: auto;
          }

          tr {
            page-break-inside: avoid;
          }

          /* Font sizing for print */
          body {
            font-size: 12pt;
          }
        }

        /* Screen-only hover effects */
        @media screen {
          tbody tr:hover {
            background-color: rgba(0, 0, 0, 0.02);
          }
        }
      `}</style>
    </>
  )
}
