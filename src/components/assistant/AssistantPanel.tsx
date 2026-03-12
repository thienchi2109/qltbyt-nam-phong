"use client"

import * as React from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { RotateCcw, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { cn } from "@/lib/utils"

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

    const transport = React.useMemo(
        () =>
            new DefaultChatTransport({
                api: "/api/chat",
                body: {
                    selectedFacilityId,
                    requestedTools: REQUESTED_TOOLS,
                },
            }),
        [selectedFacilityId],
    )

    const { messages, status, sendMessage, stop, setMessages, error } = useChat({
        transport,
    })

    const handleSend = React.useCallback(() => {
        const trimmed = input.trim()
        if (!trimmed || status !== "ready") return

        sendMessage({ text: trimmed })
        setInput("")
    }, [input, status, sendMessage])

    const handleKeyDown = React.useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
            }
        },
        [handleSend],
    )

    const handleReset = React.useCallback(() => {
        setMessages([])
        setInput("")
    }, [setMessages])

    if (!isOpen) return null

    const isStreaming = status === "streaming"

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

            {/* Message area — placeholder for Batch 5 MessageList */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground text-sm">
                        <p>Hãy bắt đầu cuộc trò chuyện!</p>
                    </div>
                )}
            </div>

            {/* Composer */}
            <div className="px-4 py-3 border-t border-[hsl(var(--assistant-border))] shrink-0">
                <div className="flex items-end gap-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Hỏi trợ lý..."
                        rows={1}
                        disabled={isStreaming}
                        className={cn(
                            "flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2",
                            "text-sm leading-relaxed",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "max-h-[120px]",
                        )}
                    />
                    {isStreaming ? (
                        <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => stop()}
                            className="h-9 w-9 rounded-xl shrink-0"
                            aria-label="Dừng"
                        >
                            <div className="h-3 w-3 rounded-sm bg-white" />
                        </Button>
                    ) : (
                        <Button
                            size="icon"
                            onClick={handleSend}
                            disabled={!input.trim()}
                            className="h-9 w-9 rounded-xl shrink-0 bg-[hsl(var(--assistant-accent))] hover:bg-[hsl(var(--assistant-accent))]/90 text-white"
                            aria-label="Gửi"
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 19V5M5 12l7-7 7 7" />
                            </svg>
                        </Button>
                    )}
                </div>
            </div>

            {/* Disclaimer */}
            <div className="px-4 pb-3 shrink-0">
                <p className="text-[11px] text-muted-foreground text-center leading-relaxed tracking-wide">
                    Kết quả mang tính tham khảo, cần được xác nhận bởi người dùng.
                </p>
            </div>
        </div>
    )
}
