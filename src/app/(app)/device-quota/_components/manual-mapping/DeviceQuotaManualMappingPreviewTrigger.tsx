"use client"

import { Link } from "lucide-react"

import { Button } from "@/components/ui/button"

interface DeviceQuotaManualMappingPreviewTriggerProps {
  canOpenPreview: boolean
  isLinking: boolean
  onOpenPreview: () => void
}

/** Opens the existing manual-mapping preview from any route composition. */
export function DeviceQuotaManualMappingPreviewTrigger({
  canOpenPreview,
  isLinking,
  onOpenPreview,
}: DeviceQuotaManualMappingPreviewTriggerProps) {
  return (
    <Button
      onClick={onOpenPreview}
      disabled={!canOpenPreview || isLinking}
      size="sm"
      className="touch-target-sm"
    >
      <Link className="size-4" />
      {isLinking ? "Đang xử lý..." : "Phân loại"}
    </Button>
  )
}
