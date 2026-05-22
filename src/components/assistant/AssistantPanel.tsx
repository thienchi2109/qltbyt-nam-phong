"use client"

import * as React from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { RotateCcw, X, AlertTriangle, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { parseAiUsageLimitError, parseErrorMessage } from "@/lib/ai/errors"
import { compactUIMessages } from "@/lib/ai/compact-ui-messages"
import { buildRepairRequestCreateIntentHref } from "@/lib/repair-request-deep-link"
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

type CooldownState = {
    until: number | null
    now: number
}

type CooldownAction =
    | { type: "clear"; now: number }
    | { type: "start"; until: number; now: number }
    | { type: "tick"; until: number; now: number }

function cooldownReducer(_state: CooldownState, action: CooldownAction): CooldownState {
    switch (action.type) {
        case "clear":
            return { until: null, now: action.now }
        case "start":
        case "tick":
            return { until: action.until, now: action.now }
    }
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
    "query_database",
    "generateTroubleshootingDraft",
    "generateRepairRequestDraft",
    "categorySuggestion",
    "departmentList",
]

/**
 * Main assistant chat panel container.
 *
 * Orchestrates useChat from AI SDK v6, renders header/message-area/composer.
 * Uses a large dialog shell so chart content has enough room on both desktop and mobile.
 * Design spec §4.2.
 */
export function AssistantPanel({ isOpen, onClose }: AssistantPanelProps) {
    const { selectedFacilityId, facilities = [] } = useTenantSelection()
    const [input, setInput] = React.useState("")
    const [cooldown, dispatchCooldown] = React.useReducer(
        cooldownReducer,
        undefined,
        () => ({ until: null, now: Date.now() }),
    )

    const facilityRef = React.useRef(selectedFacilityId)
    facilityRef.current = selectedFacilityId

    const facilityNameRef = React.useRef<string | null>(null)
    facilityNameRef.current = facilities.find(f => f.id === selectedFacilityId)?.name ?? null

    const transport = React.useMemo(
        () =>
            new DefaultChatTransport({
                api: "/api/chat",
                body: () => ({
                    selectedFacilityId: facilityRef.current,
                    selectedFacilityName: facilityNameRef.current,
                    requestedTools: REQUESTED_TOOLS,
                }),
                prepareSendMessagesRequest: ({ id, messages, body }) => ({
                    body: {
                        ...body,
                        id,
                        messages: compactUIMessages(messages),
                    },
                }),
            }),
        [],
    )

    const { messages, status, error, sendMessage, stop, setMessages, regenerate, clearError } = useChat({
        transport,
    })

    const queryClient = useQueryClient()
    const { push } = useRouter()

    const isStreaming = status === "streaming"
    const isReady = status === "ready"
    const usageLimitError = React.useMemo(
        () => parseAiUsageLimitError(error?.message),
        [error?.message],
    )
    const cooldownRemainingMs = cooldown.until
        ? Math.max(0, cooldown.until - cooldown.now)
        : 0
    const isCooldownActive = cooldownRemainingMs > 0
    const cooldownSeconds = Math.max(1, Math.ceil(cooldownRemainingMs / 1000))
    const canSend = isReady && !isCooldownActive

    React.useEffect(() => {
        if (!usageLimitError?.retryAfterMs) {
            dispatchCooldown({ type: "clear", now: Date.now() })
            return
        }

        const current = Date.now()
        const expiresAt = current + usageLimitError.retryAfterMs
        dispatchCooldown({ type: "start", until: expiresAt, now: current })

        const interval = window.setInterval(() => {
            const tickNow = Date.now()
            dispatchCooldown({ type: "tick", until: expiresAt, now: tickNow })
            if (tickNow >= expiresAt) {
                window.clearInterval(interval)
            }
        }, 1000)

        return () => window.clearInterval(interval)
    }, [error?.message, usageLimitError?.retryAfterMs])

    const handleSend = React.useCallback(() => {
        const trimmed = input.trim()
        if (!trimmed || !canSend) return

        sendMessage({ text: trimmed })
        setInput("")
    }, [canSend, input, sendMessage])

    const handleSuggestionClick = React.useCallback(
        (text: string) => {
            if (!canSend) return
            sendMessage({ text })
        },
        [canSend, sendMessage],
    )

    const handleReset = React.useCallback(() => {
        dispatchCooldown({ type: "clear", now: Date.now() })
        clearError()
        setMessages([])
        setInput("")
    }, [clearError, setMessages])

    const handleRetry = React.useCallback(() => {
        if (isCooldownActive) return
        regenerate()
    }, [isCooldownActive, regenerate])

    /** TanStack Query bridge for draft handoff to /repair-requests */
    const handleApplyDraft = React.useCallback(
        (draft: RepairRequestDraft | TroubleshootingDraft) => {
            if (draft.kind === "repairRequestDraft") {
                queryClient.setQueryData(["assistant-draft"], draft)
                push(buildRepairRequestCreateIntentHref())
            }
        },
        [push, queryClient],
    )

    if (!isOpen) return null

    return (
        <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
            <DialogContent
                data-testid="assistant-panel"
                showCloseButton={false}
                className={cn(
                    "max-w-4xl h-[90vh] flex flex-col overflow-hidden p-0",
                    "bg-[hsl(var(--assistant-bg))] backdrop-blur-xl",
                    "border border-[hsl(var(--assistant-border))]",
                )}
            >
                <DialogHeader className="border-b border-[hsl(var(--assistant-border))] px-4 py-3 text-left">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div
                                data-testid="assistant-status-dot"
                                className="size-1.5 rounded-full bg-[hsl(var(--assistant-status-online))] animate-pulse"
                            />
                            <div>
                                <DialogTitle className="text-sm font-semibold text-foreground leading-snug">
                                    Trợ lý ảo CVMEMS
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground">
                                    Không gian mở rộng để xem biểu đồ và bảng dữ liệu trong hội thoại.
                                </DialogDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 pr-8">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleReset}
                                className="size-8"
                                aria-label="Đặt lại cuộc trò chuyện"
                            >
                                <RotateCcw className="size-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="size-8"
                                aria-label="Đóng"
                            >
                                <X className="size-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {messages.length === 0 ? (
                    <div className="flex-1 overflow-y-auto px-4 py-3">
                        <AssistantEmptyState
                            onSuggestionClick={handleSuggestionClick}
                            isReady={canSend}
                        />
                    </div>
                ) : (
                    <AssistantMessageList
                        messages={messages}
                        status={status}
                        onApplyDraft={handleApplyDraft}
                    />
                )}

                {error && (
                    <div
                        data-testid="assistant-error-banner"
                        className="mx-3 mb-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2 shrink-0"
                    >
                        <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-destructive leading-snug">
                                {parseErrorMessage(error.message)}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRetry}
                            disabled={isCooldownActive}
                            className="shrink-0 h-7 px-2 text-xs text-destructive hover:text-destructive"
                            aria-label={isCooldownActive ? `Thử lại sau ${cooldownSeconds} giây` : "Thử lại"}
                        >
                            <RefreshCw className="size-3 mr-1" />
                            {isCooldownActive ? `Thử lại sau ${cooldownSeconds} giây` : "Thử lại"}
                        </Button>
                    </div>
                )}

                <AssistantComposer
                    input={input}
                    onInputChange={setInput}
                    onSend={handleSend}
                    onStop={() => stop()}
                    isStreaming={isStreaming}
                    isReady={canSend}
                />

                <div className="px-4 pb-3 shrink-0">
                    <p className="text-[11px] text-muted-foreground text-center leading-relaxed tracking-wide">
                        Kết quả mang tính tham khảo, cần được xác nhận bởi người dùng.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
}
