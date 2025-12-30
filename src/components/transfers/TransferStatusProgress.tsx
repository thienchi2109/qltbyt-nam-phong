"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { TRANSFER_STATUSES } from "@/types/database"
import type { TransferType, TransferStatus } from "@/types/transfers-data-grid"

interface StatusStep {
  key: TransferStatus
  label: string
}

// Status flows by transfer type
const STATUS_FLOWS: Record<TransferType, StatusStep[]> = {
  noi_bo: [
    { key: "cho_duyet", label: TRANSFER_STATUSES.cho_duyet },
    { key: "da_duyet", label: TRANSFER_STATUSES.da_duyet },
    { key: "dang_luan_chuyen", label: TRANSFER_STATUSES.dang_luan_chuyen },
    { key: "hoan_thanh", label: TRANSFER_STATUSES.hoan_thanh },
  ],
  ben_ngoai: [
    { key: "cho_duyet", label: TRANSFER_STATUSES.cho_duyet },
    { key: "da_duyet", label: TRANSFER_STATUSES.da_duyet },
    { key: "dang_luan_chuyen", label: TRANSFER_STATUSES.dang_luan_chuyen },
    { key: "da_ban_giao", label: TRANSFER_STATUSES.da_ban_giao },
    { key: "hoan_thanh", label: TRANSFER_STATUSES.hoan_thanh },
  ],
  thanh_ly: [
    { key: "cho_duyet", label: TRANSFER_STATUSES.cho_duyet },
    { key: "da_duyet", label: TRANSFER_STATUSES.da_duyet },
    { key: "hoan_thanh", label: TRANSFER_STATUSES.hoan_thanh },
  ],
}

interface TransferStatusProgressProps {
  type: TransferType
  currentStatus: TransferStatus
  className?: string
}

export function TransferStatusProgress({
  type,
  currentStatus,
  className,
}: TransferStatusProgressProps) {
  const steps = STATUS_FLOWS[type] || STATUS_FLOWS.noi_bo
  const currentIndex = steps.findIndex((s) => s.key === currentStatus)

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex
          const isLast = index === steps.length - 1

          return (
            <React.Fragment key={step.key}>
              {/* Step */}
              <div className="flex flex-col items-center">
                {/* Circle/Check indicator */}
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors",
                    isCompleted && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary bg-primary/10 text-primary",
                    !isCompleted && !isCurrent && "border-muted-foreground/30 bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                {/* Label */}
                <span
                  className={cn(
                    "mt-2 text-center text-xs font-medium leading-tight",
                    isCompleted && "text-primary",
                    isCurrent && "text-primary font-semibold",
                    !isCompleted && !isCurrent && "text-muted-foreground"
                  )}
                  style={{ maxWidth: "80px" }}
                >
                  {step.label}
                </span>
              </div>

              {/* Arrow connector */}
              {!isLast && (
                <div className="relative mx-1 flex-1">
                  {/* Line */}
                  <div
                    className={cn(
                      "h-0.5 w-full transition-colors",
                      index < currentIndex ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  />
                  {/* Arrow head */}
                  <div
                    className={cn(
                      "absolute -right-1 top-1/2 -translate-y-1/2 border-y-4 border-l-4 border-y-transparent transition-colors",
                      index < currentIndex ? "border-l-primary" : "border-l-muted-foreground/30"
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
