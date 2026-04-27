'use client'

import * as React from 'react'
import { Wrench } from 'lucide-react'
import { useLinkedRequest } from './LinkedRequestContext'

interface LinkedRequestRowIndicatorProps {
  equipmentId: number
  tinh_trang_hien_tai?: string | null
  active_repair_request_id?: number | null
}

export function LinkedRequestRowIndicator({
  equipmentId,
  tinh_trang_hien_tai,
  active_repair_request_id,
}: LinkedRequestRowIndicatorProps) {
  const { openRepair } = useLinkedRequest()

  const shouldShow =
    tinh_trang_hien_tai === 'Chờ sửa chữa' && active_repair_request_id != null

  if (!shouldShow) return null

  return (
    <button
      type="button"
      role="button"
      title="Xem phiếu yêu cầu sửa chữa"
      onClick={() => openRepair(equipmentId)}
      className="inline-flex items-center justify-center rounded-sm p-0.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
    >
      <Wrench className="h-3.5 w-3.5" />
      <span className="sr-only">Xem phiếu yêu cầu sửa chữa</span>
    </button>
  )
}
