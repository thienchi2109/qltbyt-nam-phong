import * as React from "react"
import { Sparkles } from "lucide-react"
import { AssistantSuggestedQuestions } from "./AssistantSuggestedQuestions"

interface AssistantEmptyStateProps {
    onSuggestionClick: (text: string) => void
    isReady: boolean
}

/**
 * Welcome screen shown when the assistant message list is empty.
 *
 * Displays a Sparkles icon, greeting text, and suggested question chips.
 * Design spec §10.
 */
export function AssistantEmptyState({
    onSuggestionClick,
    isReady,
}: AssistantEmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
            <div
                data-testid="assistant-empty-icon"
                className="w-12 h-12 rounded-2xl bg-[hsl(var(--assistant-accent-muted))] flex items-center justify-center"
            >
                <Sparkles className="h-6 w-6 text-[hsl(var(--assistant-accent))]" />
            </div>

            <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                    Xin chào! Tôi có thể giúp gì cho bạn hôm nay?
                </h3>
            </div>

            <div className="w-full max-w-[280px]">
                <AssistantSuggestedQuestions
                    onSelect={onSuggestionClick}
                    isReady={isReady}
                />
            </div>
        </div>
    )
}
