import * as React from "react"
import { cn } from "@/lib/utils"

interface QuotaProgressBarProps {
    current: number
    max: number | null
}

function getQuotaColor(current: number, max: number | null): string {
    if (max == null) return "bg-muted-foreground/30"
    if (current > max) return "bg-red-500"
    if (current >= max * 0.8) return "bg-amber-500"
    return "bg-emerald-500"
}

function getQuotaPercent(current: number, max: number | null): number {
    if (max == null || max === 0) return 0
    return Math.min(100, Math.round((current / max) * 100))
}

const QuotaProgressBar = React.memo(function QuotaProgressBar({
    current,
    max,
}: QuotaProgressBarProps) {
    const percent = getQuotaPercent(current, max)
    const colorClass = getQuotaColor(current, max)
    const fractionText = `${current}/${max ?? '–'}`

    return (
        <div className="flex items-center gap-2 min-w-[7.5rem]">
            {/* Progress track */}
            <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden shrink-0">
                <div
                    data-testid="quota-bar-fill"
                    className={cn("h-full rounded-full transition-all", colorClass)}
                    style={{ width: `${percent}%` }}
                />
            </div>

            {/* Fraction label */}
            <span className="text-xs font-medium tabular-nums text-muted-foreground whitespace-nowrap">
                {fractionText}
            </span>
        </div>
    )
})

export { QuotaProgressBar }
export type { QuotaProgressBarProps }
