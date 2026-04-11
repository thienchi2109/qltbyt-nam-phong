"use client"

import * as React from "react"
import { Calendar as CalendarIcon, Check } from "lucide-react"

import type { CalendarStats } from "@/hooks/use-calendar-data"

interface CalendarWidgetStatsProps {
  stats: CalendarStats
}

function SummaryStatCard({
  compact,
  icon: Icon,
  label,
  tone,
  value,
}: {
  compact: boolean
  icon: typeof CalendarIcon
  label: string
  tone: "blue" | "green" | "orange"
  value: number
}) {
  const wrapperClassName = compact
    ? {
        blue: "bg-gradient-to-br from-blue-50 to-blue-100/50 backdrop-blur-sm rounded-xl p-3 border border-blue-200/50",
        green: "bg-gradient-to-br from-green-50 to-green-100/50 backdrop-blur-sm rounded-xl p-3 border border-green-200/50",
        orange: "bg-gradient-to-br from-orange-50 to-orange-100/50 backdrop-blur-sm rounded-xl p-3 border border-orange-200/50",
      }[tone]
    : {
        blue: "bg-gradient-to-br from-blue-50 to-blue-100/50 backdrop-blur-sm rounded-xl p-3 border border-blue-200/50 hover:shadow-md transition-shadow",
        green: "bg-gradient-to-br from-green-50 to-green-100/50 backdrop-blur-sm rounded-xl p-3 border border-green-200/50 hover:shadow-md transition-shadow",
        orange: "bg-gradient-to-br from-orange-50 to-orange-100/50 backdrop-blur-sm rounded-xl p-3 border border-orange-200/50 hover:shadow-md transition-shadow",
      }[tone]

  const valueClassName = compact
    ? {
        blue: "text-2xl font-bold text-blue-600",
        green: "text-2xl font-bold text-green-600",
        orange: "text-2xl font-bold text-orange-600",
      }[tone]
    : {
        blue: "text-2xl font-bold text-blue-600",
        green: "text-2xl font-bold text-green-600",
        orange: "text-2xl font-bold text-orange-600",
      }[tone]

  const labelClassName = compact
    ? {
        blue: "text-xs text-blue-600/80",
        green: "text-xs text-green-600/80",
        orange: "text-xs text-orange-600/80",
      }[tone]
    : {
        blue: "text-sm text-blue-600/80 mt-1",
        green: "text-sm text-green-600/80 mt-1",
        orange: "text-sm text-orange-600/80 mt-1",
      }[tone]

  const iconWrapperClassName = compact
    ? {
        blue: "p-2 bg-blue-500/20 rounded-lg",
        green: "p-2 bg-green-500/20 rounded-lg",
        orange: "p-2 bg-orange-500/20 rounded-lg",
      }[tone]
    : {
        blue: "p-3 bg-blue-500/20 rounded-xl",
        green: "p-3 bg-green-500/20 rounded-xl",
        orange: "p-3 bg-orange-500/20 rounded-xl",
      }[tone]

  const iconClassName = compact
    ? {
        blue: "h-4 w-4 text-blue-600",
        green: "h-4 w-4 text-green-600",
        orange: "h-4 w-4 text-orange-600",
      }[tone]
    : {
        blue: "h-6 w-6 text-blue-600",
        green: "h-6 w-6 text-green-600",
        orange: "h-6 w-6 text-orange-600",
      }[tone]

  return (
    <div className={wrapperClassName}>
      <div className="flex items-center justify-between">
        <div>
          <p className={valueClassName}>{value}</p>
          <p className={labelClassName}>{label}</p>
        </div>
        <div className={iconWrapperClassName}>
          <Icon className={iconClassName} />
        </div>
      </div>
    </div>
  )
}

function TypeSummaryCard({
  byType,
  compact,
}: {
  byType: CalendarStats["byType"]
  compact: boolean
}) {
  const wrapperClassName = compact
    ? "bg-gradient-to-br from-purple-50 to-purple-100/50 backdrop-blur-sm rounded-xl p-3 border border-purple-200/50"
    : "bg-gradient-to-br from-purple-50 to-purple-100/50 backdrop-blur-sm rounded-xl p-3 border border-purple-200/50 hover:shadow-md transition-shadow"

  return (
    <div className={wrapperClassName}>
      <div className="flex flex-col">
        <p className={compact ? "text-xs text-purple-600/80 mb-1" : "text-sm text-purple-600/80 mb-2"}>Loại công việc</p>
        {Object.keys(byType).length > 0 ? (
          <div className={compact ? "space-y-0.5" : "space-y-1"}>
            {Object.entries(byType).map(([type, count]) => (
              <div key={type} className={compact ? "text-xs" : "flex items-center justify-between"}>
                <span className={compact ? "font-semibold text-purple-600" : "text-sm font-medium text-purple-600"}>
                  {type}
                  {compact ? ":" : ""}
                </span>
                <span className={compact ? "text-purple-600 ml-1" : "text-sm font-bold text-purple-600"}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className={compact ? "text-2xl font-bold text-purple-600" : "text-3xl font-bold text-purple-600"}>0</p>
        )}
      </div>
    </div>
  )
}

export function CalendarWidgetStats({ stats }: CalendarWidgetStatsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:hidden">
        <SummaryStatCard compact icon={CalendarIcon} label="Tổng công việc" tone="blue" value={stats.total} />
        <SummaryStatCard compact icon={Check} label="Đã hoàn thành" tone="green" value={stats.completed} />
        <SummaryStatCard compact icon={CalendarIcon} label="Chưa hoàn thành" tone="orange" value={stats.pending} />
        <TypeSummaryCard compact byType={stats.byType} />
      </div>

      <div className="hidden xl:grid grid-cols-2 gap-3">
        <SummaryStatCard icon={CalendarIcon} label="Tổng công việc" tone="blue" value={stats.total} compact={false} />
        <SummaryStatCard icon={Check} label="Đã hoàn thành" tone="green" value={stats.completed} compact={false} />
        <SummaryStatCard icon={CalendarIcon} label="Chưa hoàn thành" tone="orange" value={stats.pending} compact={false} />
        <TypeSummaryCard byType={stats.byType} compact={false} />
      </div>
    </>
  )
}
