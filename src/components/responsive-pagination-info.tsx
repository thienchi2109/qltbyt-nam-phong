"use client"

import * as React from "react"

interface ResponsivePaginationInfoProps {
  currentCount: number
  totalCount: number
  currentPage: number
  totalPages: number
}

export function ResponsivePaginationInfo({
  currentCount,
  totalCount,
  currentPage,
  totalPages
}: ResponsivePaginationInfoProps) {
  return (
    <div className="text-sm text-muted-foreground text-center sm:text-left">
      <div className="block sm:hidden">
        {/* Mobile: Compact display */}
        <div className="space-y-1">
          <div>
            <strong>{currentCount}</strong> / <strong>{totalCount}</strong> thiết bị
          </div>
          <div>
            Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
          </div>
        </div>
      </div>
      <div className="hidden sm:block">
        {/* Desktop: Full display */}
        Hiển thị <strong>{currentCount}</strong> trên <strong>{totalCount}</strong> thiết bị.
      </div>
    </div>
  )
} 