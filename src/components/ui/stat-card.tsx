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
  active?: boolean
}

const toneStyles: Record<NonNullable<StatCardProps["tone"]>, { bg: string, text: string, iconBg: string, iconText: string, border: string }> = {
  default: {
    bg: "hover:bg-accent/50",
    text: "text-foreground",
    iconBg: "bg-primary/10",
    iconText: "text-primary",
    border: "border-l-primary"
  },
  success: {
    bg: "hover:bg-green-50/50 dark:hover:bg-green-900/10",
    text: "text-green-700 dark:text-green-400",
    iconBg: "bg-green-100 dark:bg-green-900/30",
    iconText: "text-green-600 dark:text-green-400",
    border: "border-l-green-500"
  },
  warning: {
    bg: "hover:bg-orange-50/50 dark:hover:bg-orange-900/10",
    text: "text-orange-700 dark:text-orange-400",
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    iconText: "text-orange-600 dark:text-orange-400",
    border: "border-l-orange-500"
  },
  danger: {
    bg: "hover:bg-red-50/50 dark:hover:bg-red-900/10",
    text: "text-red-700 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-900/30",
    iconText: "text-red-600 dark:text-red-400",
    border: "border-l-red-500"
  },
  muted: {
    bg: "hover:bg-blue-50/50 dark:hover:bg-blue-900/10", // Changed to Blueish for "Approved" / Neutral
    text: "text-blue-700 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconText: "text-blue-600 dark:text-blue-400",
    border: "border-l-blue-500"
  },
}

export function StatCard({ label, value, icon, tone = "default", loading, onClick, className, active = false }: StatCardProps) {
  const clickable = Boolean(onClick)
  const styles = toneStyles[tone]

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
        "relative overflow-hidden transition-all duration-200",
        "border shadow-sm hover:shadow-md",
        clickable && "cursor-pointer hover:-translate-y-0.5",
        active && "ring-2 ring-ring ring-offset-2",
        styles.bg,
        className,
      )}
    >
      {/* Colored Left Border Indicator */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", styles.border.replace("border-l-", "bg-"))} />

      <div className="p-4 flex items-center gap-4">
        {/* Icon with Circle Background */}
        <div className={cn("h-12 w-12 rounded-full flex items-center justify-center shrink-0 transition-colors", styles.iconBg, styles.iconText)}>
          {icon}
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-muted-foreground truncate uppercase tracking-tight opacity-80">
            {label}
          </span>
          <span className={cn("text-2xl font-bold leading-none mt-1", styles.text)}>
            {loading ? <span className="animate-pulse">...</span> : value}
          </span>
        </div>
      </div>
    </Card>
  )
}
