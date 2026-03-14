import * as React from "react"

/**
 * Thinking indicator: 3 bouncing dots in a pill-shaped AI bubble.
 * Uses assistant-dot animation class from assistant-styles.css.
 * Design spec §5.1.
 */
export function AssistantThinkingIndicator() {
    return (
        <div
            data-testid="assistant-thinking-container"
            className="inline-flex items-center gap-1 px-4 py-3 rounded-2xl bg-[hsl(var(--assistant-ai-bubble))] assistant-message-enter"
        >
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    data-testid="assistant-thinking-dot"
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 assistant-dot"
                />
            ))}
        </div>
    )
}
