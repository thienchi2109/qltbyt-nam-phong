"use client"

import * as React from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { RotateCcw, X, AlertTriangle, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { parseErrorMessage } from "@/lib/ai/errors"
import { cn } from "@/lib/utils"

import { AssistantComposer } from "./AssistantComposer"
import { AssistantEmptyState } from "./AssistantEmptyState"
import { AssistantMessageList } from "./AssistantMessageList"
import type { RepairRequestDraft } from "@/lib/ai/draft/repair-request-draft-schema"
import type { TroubleshootingDraft } from "@/lib/ai/draft/troubleshooting-schema"

import "@/components/assistant/assistant-styles.css"

interface AssistantPanelProps {
    isOpen: boolean
    onClose: () => void
}

/** All tool names available for the assistant. */
const REQUESTED_TOOLS = [
    "equipmentLookup",
    "maintenanceSummary",
    "maintenancePlanLookup",
    "repairSummary",
    "usageHistory",
    "attachmentLookup",
    "deviceQuotaLookup",
    "quotaComplianceSummary",
    "generateTroubleshootingDraft",
    "generateRepairRequestDraft",
    "categorySuggestion",
]

/**
 * Main assistant chat panel container.
 *
 * Orchestrates useChat from AI SDK v6, renders header/message-area/composer.
 * Desktop: floating 420×680px popover above the FAB.
 * Mobile: uses MobileBottomSheet wrapper.
 * Design spec §4.2.
 */
export function AssistantPanel({ isOpen, onClose }: AssistantPanelProps) {
    const { selectedFacilityId } = useTenantSelection()
    const [input, setInput] = React.useState("")

    const facilityRef = React.useRef(selectedFacilityId)
    facilityRef.current = selectedFacilityId

    const transport = React.useMemo(
        () =>
            new DefaultChatTransport({
                api: "/api/chat",
                body: () => ({
                    selectedFacilityId: facilityRef.current,
                    requestedTools: REQUESTED_TOOLS,
                }),
            }),
        [],
    )

    const { messages, status, error, sendMessage, stop, setMessages, regenerate, clearError } = useChat({
        transport,
    })

    const queryClient = useQueryClient()
    const router = useRouter()

    const isStreaming = status === "streaming"
    const isReady = status === "ready"

    const handleSend = React.useCallback(() => {
        const trimmed = input.trim()
        if (!trimmed || !isReady) return

        sendMessage({ text: trimmed })
        setInput("")
    }, [input, isReady, sendMessage])

    const handleSuggestionClick = React.useCallback(
        (text: string) => {
            if (!isReady) return
            sendMessage({ text })
        },
        [isReady, sendMessage],
    )

    const handleReset = React.useCallback(() => {
        clearError()
        setMessages([])
        setInput("")
    }, [clearError, setMessages])

    /** TanStack Query bridge for draft handoff to /repair-requests */
    const handleApplyDraft = React.useCallback(
        (draft: RepairRequestDraft | TroubleshootingDraft) => {
            if (draft.kind === "repairRequestDraft") {
                queryClient.setQueryData(["assistant-draft"], draft)
                router.push("/repair-requests?action=create")
            }
        },
        [queryClient, router],
    )

    if (!isOpen) return null

    return (
        <div
            data-testid="assistant-panel"
            className={cn(
                "fixed z-[998]",
                "right-6 bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)]",
                "w-[420px] h-[min(680px,calc(100vh-8rem))]",
                "flex flex-col",
                "bg-[hsl(var(--assistant-bg))] backdrop-blur-xl",
                "border border-[hsl(var(--assistant-border))]",
                "rounded-2xl shadow-2xl",
                "assistant-panel-enter",
                "max-md:inset-2 max-md:w-auto max-md:h-auto max-md:rounded-2xl",
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--assistant-border))] shrink-0">
                <div className="flex items-center gap-2">
                    <div
                        data-testid="assistant-status-dot"
                        className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--assistant-status-online))] animate-pulse"
                    />
                    <h2 className="text-sm font-semibold text-foreground leading-snug">
                        Trợ lý ảo CVMEMS
                    </h2>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleReset}
                        className="h-8 w-8"
                        aria-label="Đặt lại cuộc trò chuyện"
                    >
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8"
                        aria-label="Đóng"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Message area */}
            {messages.length === 0 ? (
                <div className="flex-1 overflow-y-auto px-4 py-3">
                    <AssistantEmptyState
                        onSuggestionClick={handleSuggestionClick}
                        isReady={isReady}
                    />
                </div>
            ) : (
                <AssistantMessageList
                    messages={messages}
                    status={status}
                    onApplyDraft={handleApplyDraft}
                />
            )}

            {/* Error banner */}
            {error && (
                <div
                    data-testid="assistant-error-banner"
                    className="mx-3 mb-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2 shrink-0"
                >
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-destructive leading-snug">
                            {parseErrorMessage(error.message)}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => regenerate()}
                        className="shrink-0 h-7 px-2 text-xs text-destructive hover:text-destructive"
                        aria-label="Thử lại"
                    >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Thử lại
                    </Button>
                </div>
            )}

            {/* Composer */}
            <AssistantComposer
                input={input}
                onInputChange={setInput}
                onSend={handleSend}
                onStop={() => stop()}
                isStreaming={isStreaming}
                isReady={isReady}
            />

            {/* Disclaimer */}
            <div className="px-4 pb-3 shrink-0">
                <p className="text-[11px] text-muted-foreground text-center leading-relaxed tracking-wide">
                    Kết quả mang tính tham khảo, cần được xác nhận bởi người dùng.
                </p>
            </div>
        </div>
    )
}
