"use client"

import * as React from "react"
import { isToolUIPart, getToolName } from "ai"
import type { UIMessage } from "ai"
import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import {
    isReportChartArtifact,
    isToolResponseEnvelope,
} from "@/lib/ai/tools/tool-response-envelope"

import { AssistantDraftCard } from "./AssistantDraftCard"
import { AssistantMarkdownRenderer } from "./AssistantMarkdownRenderer"
import { AssistantReportChartCard } from "./AssistantReportChartCard"
import { AssistantThinkingIndicator } from "./AssistantThinkingIndicator"
import { AssistantToolExecutionCard } from "./AssistantToolExecutionCard"
import type { RepairRequestDraft } from "@/lib/ai/draft/repair-request-draft-schema"
import type { TroubleshootingDraft } from "@/lib/ai/draft/troubleshooting-schema"

type DraftPayload = RepairRequestDraft | TroubleshootingDraft

interface AssistantMessageListProps {
    messages: UIMessage[]
    status: string
    onApplyDraft: (draft: DraftPayload) => void
}

/**
 * Scrollable message list for the assistant chat panel.
 *
 * Auto-scrolls to bottom on new messages, pauses when user scrolls up.
 * Renders typed message parts: text → markdown, tool → execution card,
 * draft output → draft card. Design spec §4.3.
 */
export function AssistantMessageList({
    messages,
    status,
    onApplyDraft,
}: AssistantMessageListProps) {
    const bottomRef = React.useRef<HTMLDivElement>(null)
    const containerRef = React.useRef<HTMLDivElement>(null)
    const userScrolledUp = React.useRef(false)

    // Auto-scroll on new messages
    React.useEffect(() => {
        if (!userScrolledUp.current) {
            bottomRef.current?.scrollIntoView?.({ behavior: "smooth" })
        }
    }, [messages])

    const handleScroll = React.useCallback(() => {
        const container = containerRef.current
        if (!container) return
        const threshold = 60
        const isNearBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight < threshold
        userScrolledUp.current = !isNearBottom
    }, [])

    const isSubmitted = status === "submitted"
    const isStreaming = status === "streaming"
    const lastMessage = messages[messages.length - 1]
    const showThinking =
        isSubmitted ||
        (isStreaming &&
            lastMessage?.role === "assistant" &&
            !lastMessage.parts.some((p) => p.type === "text"))

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            role="log"
            aria-live="polite"
        >
            {messages.map((message) => (
                <MessageBubble
                    key={message.id}
                    message={message}
                    onApplyDraft={onApplyDraft}
                />
            ))}

            {showThinking && <AssistantThinkingIndicator />}

            <div ref={bottomRef} aria-hidden="true" />
        </div>
    )
}

// ---------------------
// Message bubble
// ---------------------

function MessageBubble({
    message,
    onApplyDraft,
}: {
    message: UIMessage
    onApplyDraft: (draft: DraftPayload) => void
}) {
    const isUser = message.role === "user"

    return (
        <div
            data-role={message.role}
            className={cn(
                "flex gap-2 animate-[assistant-message-in_200ms_ease-out]",
                isUser ? "justify-end" : "justify-start",
            )}
        >
            {/* AI avatar */}
            {!isUser && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
            )}

            <div
                className={cn(
                    "space-y-0.5",
                    isUser ? "max-w-[85%] ml-12" : "max-w-[88%] mr-12",
                )}
            >
                {(() => {
                    let textPartOrdinal = 0

                    return message.parts.map((part, partIndex) => {
                        const partKey =
                            part.type === "text"
                                ? `${message.id}-text-${textPartOrdinal++}`
                                : isToolUIPart(part)
                                  ? part.toolCallId
                                  : `${message.id}-${part.type}-${partIndex}`

                        // Text part
                        if (part.type === "text") {
                            return (
                                <div
                                    key={partKey}
                                    className={cn(
                                        "px-3.5 py-2.5 text-sm leading-relaxed",
                                        isUser
                                            ? "bg-[hsl(var(--assistant-user-bubble))] text-[hsl(var(--assistant-user-text))] rounded-2xl rounded-br-md shadow-sm"
                                            : "bg-[hsl(var(--assistant-ai-bubble))] text-[hsl(var(--assistant-ai-text))] rounded-2xl rounded-bl-md",
                                    )}
                                >
                                    {isUser ? (
                                        part.text
                                    ) : (
                                        <AssistantMarkdownRenderer content={part.text} />
                                    )}
                                </div>
                            )
                        }

                        // Tool part (catch-all via isToolUIPart)
                        // TODO(phase-5b): Handle tool-level output errors (state === 'error')
                        //   — render inline error UI per tool part, not just the global error banner.
                        if (isToolUIPart(part)) {
                            const toolName = getToolName(part)

                            // Check if output is a draft artifact
                            if (
                                part.state === "output-available" &&
                                part.output &&
                                typeof part.output === "object" &&
                                "kind" in part.output
                            ) {
                                const output = part.output as Record<string, unknown>
                                if (
                                    output.kind === "repairRequestDraft" ||
                                    output.kind === "troubleshootingDraft"
                                ) {
                                    return (
                                        <AssistantDraftCard
                                            key={partKey}
                                            draft={output as DraftPayload}
                                            onApplyDraft={onApplyDraft}
                                        />
                                    )
                                }
                            }

                            const envelope = isToolResponseEnvelope(part.output)
                                ? part.output
                                : null
                            const reportChart =
                                envelope?.uiArtifact &&
                                isReportChartArtifact(envelope.uiArtifact.rawPayload)
                                    ? envelope.uiArtifact.rawPayload
                                    : null

                            return (
                                <React.Fragment key={partKey}>
                                    <AssistantToolExecutionCard
                                        toolName={toolName}
                                        state={part.state}
                                    />
                                    {reportChart ? (
                                        <AssistantReportChartCard artifact={reportChart} />
                                    ) : null}
                                </React.Fragment>
                            )
                        }

                        return null
                    })
                })()}
            </div>
        </div>
    )
}
