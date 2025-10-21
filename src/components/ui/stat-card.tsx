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

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "",
  success: "text-green-600",
  warning: "text-orange-600",
  danger: "text-red-600",
  muted: "text-muted-foreground",
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
        "p-4 transition-colors",
        clickable && "cursor-pointer hover:bg-muted/50",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground truncate">{label}</div>
          <div className={cn("text-2xl font-semibold", toneClasses[tone])}>
            {loading ? "…" : value}
          </div>
        </div>
        {icon && <div className="shrink-0 opacity-70">{icon}</div>}
      </div>
    </Card>
  )
}