"use client"

import * as React from "react"
import { StatCard, type StatCardProps } from "@/components/ui/stat-card"
import { cn } from "@/lib/utils"

export type SummaryItem = Omit<StatCardProps, "className"> & { key: string }

export function SummaryBar({ items, loading, className }: { items: SummaryItem[]; loading?: boolean; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3", className)}>
      {items.map((item) => {
        const { key, ...rest } = item
        return <StatCard key={key} {...rest} loading={loading && item.label !== "Tổng"} />
      })}
    </div>
  )
}