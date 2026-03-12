"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AssistantComposerProps {
    input: string
    onInputChange: (value: string) => void
    onSend: () => void
    onStop: () => void
    isStreaming: boolean
    isReady: boolean
}

/**
 * Chat input area with auto-resizing textarea, send/stop buttons.
 *
 * Enter sends, Shift+Enter adds newline.
 * Shows stop button during streaming, send button otherwise.
 * Design spec §4.7.
 */
export function AssistantComposer({
    input,
    onInputChange,
    onSend,
    onStop,
    isStreaming,
    isReady,
}: AssistantComposerProps) {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea based on content
    React.useEffect(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = "auto"
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    }, [input])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            onSend()
        }
    }

    return (
        <div className="px-4 py-3 border-t border-[hsl(var(--assistant-border))] shrink-0">
            <div className="flex items-end gap-2">
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
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
                        "max-md:text-base", // Prevents iOS zoom on focus
                    )}
                />
                {isStreaming ? (
                    <Button
                        variant="destructive"
                        size="icon"
                        onClick={onStop}
                        className="h-9 w-9 rounded-xl shrink-0"
                        aria-label="Dừng"
                    >
                        <div className="h-3 w-3 rounded-sm bg-white" />
                    </Button>
                ) : (
                    <Button
                        size="icon"
                        onClick={onSend}
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
    )
}
