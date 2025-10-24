"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type StatCardProps = {
  label: string
  value: number | string
  icon?: React.ReactNode
  tone?: "default" | "success" | "warning" | "danger" | "muted"
  loading?: boolean
  onClick?: () => void
  className?: string
}

const toneTextClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-slate-800",
  success: "text-green-700",
  warning: "text-orange-700",
  danger: "text-red-700",
  muted: "text-slate-600",
}

const toneBgClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-slate-50 border-slate-200",
  success: "bg-green-50 border-green-200",
  warning: "bg-orange-50 border-orange-200",
  danger: "bg-red-50 border-red-200",
  muted: "bg-slate-50 border-slate-200",
}

export function StatCard({ label, value, icon, tone = "default", loading, onClick, className }: StatCardProps) {
  const clickable = Boolean(onClick)
  return (
    <Card
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : -1}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!clickable) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={cn(
        "p-3 md:p-4 transition-colors border",
        toneBgClasses[tone],
        clickable && "cursor-pointer hover:brightness-[0.98]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-slate-600 truncate">{label}</div>
          <div className={cn("text-2xl font-semibold", toneTextClasses[tone])}>
            {loading ? "…" : value}
          </div>
        </div>
        {icon && <div className="shrink-0 opacity-70">{icon}</div>}
      </div>
    </Card>
  )
}
