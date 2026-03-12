"use client"

import * as React from "react"
import { CheckCircle2, Loader2, AlertCircle, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Vietnamese display-name map for AI tool names.
 * Maps internal tool names to human-readable labels.
 */
const TOOL_DISPLAY_NAMES: Record<string, string> = {
    equipmentLookup: "Tra cứu thiết bị",
    maintenanceSummary: "Tổng hợp bảo trì",
    maintenancePlanLookup: "Tra cứu kế hoạch bảo trì",
    repairSummary: "Tổng hợp sửa chữa",
    usageHistory: "Lịch sử sử dụng",
    attachmentLookup: "Tra cứu tài liệu",
    deviceQuotaLookup: "Tra cứu định mức",
    quotaComplianceSummary: "Tổng hợp tuân thủ định mức",
    generateTroubleshootingDraft: "Phân tích chẩn đoán",
    generateRepairRequestDraft: "Tạo bản nháp yêu cầu sửa chữa",
}

function getToolDisplayName(toolName: string): string {
    return TOOL_DISPLAY_NAMES[toolName] ?? toolName
}

interface AssistantToolExecutionCardProps {
    toolName: string
    state: string
    isCollapsible?: boolean
}

/**
 * Inline card showing AI tool execution status.
 *
 * States: input-streaming/input-available → executing, output-available → completed.
 * Design spec §4.4.
 */
export function AssistantToolExecutionCard({
    toolName,
    state,
    isCollapsible = true,
}: AssistantToolExecutionCardProps) {
    const [isExpanded, setIsExpanded] = React.useState(false)

    const isExecuting = state === "input-streaming" || state === "input-available"
    const isCompleted = state === "output-available"
    const isError = state === "error"

    const displayName = getToolDisplayName(toolName)

    return (
        <div
            data-testid="tool-execution-card"
            className={cn(
                "flex flex-col rounded-lg border px-3 py-2 my-1.5",
                "bg-[hsl(var(--assistant-tool-bg))]",
                "border-[hsl(var(--assistant-tool-border))]",
                isError && "border-destructive/50",
            )}
        >
            <div className="flex items-center gap-2">
                {isExecuting && (
                    <Loader2
                        data-testid="tool-executing-spinner"
                        className="h-4 w-4 animate-spin text-[hsl(var(--assistant-tool-icon))]"
                    />
                )}
                {isCompleted && (
                    <CheckCircle2
                        data-testid="tool-completed-check"
                        className="h-4 w-4 text-[hsl(var(--assistant-status-online))]"
                    />
                )}
                {isError && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                )}

                <span className="text-xs font-medium flex-1">
                    {isExecuting && `Đang tra cứu: ${displayName}...`}
                    {isCompleted && `Đã tra cứu: ${displayName}`}
                    {isError && `Không thể tra cứu: ${displayName}`}
                </span>

                {isCollapsible && isCompleted && (
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-0.5 rounded hover:bg-muted/50 transition-colors"
                        aria-label={isExpanded ? "Thu gọn" : "Mở rộng"}
                    >
                        <ChevronDown
                            className={cn(
                                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                                isExpanded && "rotate-180",
                            )}
                        />
                    </button>
                )}
            </div>

            {/* Shimmer overlay during execution */}
            {isExecuting && (
                <div className="mt-1.5 h-1 rounded-full overflow-hidden bg-muted">
                    <div className="h-full w-1/3 rounded-full bg-[hsl(var(--assistant-tool-icon))] assistant-shimmer-bar" />
                </div>
            )}
        </div>
    )
}
