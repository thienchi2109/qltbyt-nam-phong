"use client"

import * as React from "react"
import { X, Printer } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { DeviceQuotaComplianceReport } from "./DeviceQuotaComplianceReport"

// ============================================
// Types
// ============================================

interface DeviceQuotaReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  decisionId: number
  facilityName: string
  decisionNumber: string
}

// ============================================
// Component
// ============================================

/**
 * DeviceQuotaReportDialog
 *
 * Full-screen dialog for previewing and printing device quota compliance reports.
 *
 * Features:
 * - Large dialog (max-w-6xl) for A4 report preview
 * - Contains DeviceQuotaComplianceReport component
 * - Header with title and close button
 * - Footer with Print and Close buttons
 * - Print button triggers window.print()
 *
 * Vietnamese labels throughout.
 *
 * @example
 * <DeviceQuotaReportDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   decisionId={123}
 *   facilityName="Bệnh viện Đa khoa Trung ương"
 *   decisionNumber="123/QĐ-BYT"
 * />
 */
export function DeviceQuotaReportDialog({
  open,
  onOpenChange,
  decisionId,
  facilityName,
  decisionNumber,
}: DeviceQuotaReportDialogProps) {
  const [isPrinting, setIsPrinting] = React.useState(false)

  // Print handler
  const handlePrint = React.useCallback(() => {
    setIsPrinting(true)
    // Small delay to allow state update to render
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 100)
  }, [])

  // Close handler
  const handleClose = React.useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="text-xl">Báo cáo định mức thiết bị</DialogTitle>
        </DialogHeader>

        {/* Report Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <DeviceQuotaComplianceReport
            decisionId={decisionId}
            facilityName={facilityName}
            decisionNumber={decisionNumber}
          />
        </div>

        {/* Footer - Hidden during print */}
        <div className="print:hidden px-6 py-4 border-t flex-shrink-0 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            <X className="mr-2 h-4 w-4" />
            Đóng
          </Button>
          <Button onClick={handlePrint} disabled={isPrinting}>
            <Printer className="mr-2 h-4 w-4" />
            {isPrinting ? "Đang in..." : "In báo cáo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
