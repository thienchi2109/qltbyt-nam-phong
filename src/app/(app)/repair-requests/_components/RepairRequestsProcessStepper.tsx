"use client"

import { Check, X, Clock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface RepairRequestsProcessStepperProps {
    status: string
    className?: string
}

export function RepairRequestsProcessStepper({ status, className }: RepairRequestsProcessStepperProps) {
    // Determine current step index based on status
    // 0: Chờ xử lý --> Active: Blue | Completed: Green
    // 1: Đã duyệt --> Active: Blue | Completed: Green
    // 2: Hoàn thành / Không HT --> Active/Finished: Green (Success) or Red (Fail)

    let currentStepIndex = 0
    let isFailure = false

    switch (status) {
        case 'Chờ xử lý':
            currentStepIndex = 0
            break
        case 'Đã duyệt':
            currentStepIndex = 1
            break
        case 'Hoàn thành':
            currentStepIndex = 2
            break
        case 'Không HT':
            currentStepIndex = 2
            isFailure = true
            break
        default:
            currentStepIndex = 0
    }

    const steps = [
        {
            title: "Chờ xử lý",
            icon: Clock
        },
        {
            title: "Đã duyệt & Sửa chữa",
            icon: Loader2
        },
        {
            title: isFailure ? "Không hoàn thành" : "Hoàn thành",
            icon: isFailure ? X : Check
        },
    ]

    return (
        <div className={cn("w-full py-2", className)}>
            <div className="flex w-full filter drop-shadow-sm">
                {steps.map((step, idx) => {
                    const isCompleted = idx < currentStepIndex
                    const isActive = idx === currentStepIndex
                    const isLast = idx === steps.length - 1
                    const isFirst = idx === 0

                    // Colors
                    let bgClass = "bg-muted text-muted-foreground" // Default / Pending

                    if (isCompleted) {
                        bgClass = "bg-emerald-500 text-white" // Completed steps are green
                    } else if (isActive) {
                        // Active step color matches status
                        if (idx === 0) { // Chờ xử lý
                            bgClass = "bg-amber-500 text-white"
                        } else if (idx === 1) { // Đã duyệt
                            bgClass = "bg-blue-500 text-white"
                        } else if (idx === 2) { // Final step
                            if (isFailure) {
                                bgClass = "bg-rose-500 text-white"
                            } else {
                                bgClass = "bg-emerald-500 text-white"
                            }
                        }
                    }

                    // Arrow shape logic
                    // We use standard arrow sizes. 
                    // Arrow head size: 1.5rem (24px)

                    const shapeStyle = {
                        clipPath: isLast
                            ? (isFirst
                                ? 'none' // Single item?
                                : 'polygon(1.5rem 0, 100% 0, 100% 100%, 1.5rem 100%, 0 50%)') // Last item, flat right, cutout left
                            : (isFirst
                                ? 'polygon(0 0, calc(100% - 1.5rem) 0, 100% 50%, calc(100% - 1.5rem) 100%, 0 100%)' // First item, arrow right, flat left
                                : 'polygon(1.5rem 0, calc(100% - 1.5rem) 0, 100% 50%, calc(100% - 1.5rem) 100%, 1.5rem 100%, 0 50%)') // Middle, cutout left, arrow right
                    }

                    const Icon = step.icon

                    return (
                        <div
                            key={idx}
                            className={cn(
                                "relative flex-1 flex items-center justify-center h-12 transition-colors duration-300",
                                bgClass,
                                // Negative margin to connect the arrows visually
                                !isFirst && "-ml-4"
                            )}
                            style={{
                                ...shapeStyle,
                                zIndex: steps.length - idx // Stack order
                            }}
                        >
                            <div className={cn(
                                "flex items-center gap-2 pl-4",
                                isFirst ? "pl-2" : "pl-8", // Adjust padding to account for the left cutout
                                isLast ? "" : "pr-6" // Adjust padding to avoid text hitting arrow head
                            )}>
                                <div className={cn("h-6 w-6 rounded-full flex items-center justify-center border-2 border-white/20 shadow-sm",
                                    (isActive || isCompleted) ? "bg-white/20" : "bg-transparent"
                                )}>
                                    {isCompleted ? <Check className="h-3.5 w-3.5" /> :
                                        (isActive && isFailure) ? <X className="h-3.5 w-3.5" /> :
                                            (isActive && idx !== 2) ? <Icon className="h-3.5 w-3.5 animate-pulse" /> :
                                                <span className="text-xs font-bold">{idx + 1}</span>}
                                </div>
                                <span className="text-sm font-bold whitespace-nowrap hidden sm:inline-block">{step.title}</span>
                                {/* Show Icon only on very small screens? or just number? */}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
