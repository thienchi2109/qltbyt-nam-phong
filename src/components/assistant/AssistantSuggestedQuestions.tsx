import * as React from "react"
import { Zap } from "lucide-react"
import { STARTER_PROMPT_GROUPS } from "@/lib/ai/prompts/starter-suggestions"
import { cn } from "@/lib/utils"

interface AssistantSuggestedQuestionsProps {
    onSelect: (text: string) => void
    isReady: boolean
}

/** Pool all suggestion strings and randomly pick `count` unique items. */
function pickRandom(count: number): string[] {
    const pool = STARTER_PROMPT_GROUPS.flatMap((g) => [...g.suggestions])

    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }

    return pool.slice(0, count)
}

/**
 * Renders 3 randomly selected prompt chips from the starter suggestions pool.
 *
 * Click sends the prompt immediately. Chips are disabled when not ready.
 * Uses staggered fade-in animation from assistant-styles.css.
 * Design spec §4.6.
 */
export function AssistantSuggestedQuestions({
    onSelect,
    isReady,
}: AssistantSuggestedQuestionsProps) {
    const [chips, setChips] = React.useState<string[]>([])

    // Defer randomization to post-mount to avoid SSR hydration mismatch
    React.useEffect(() => {
        setChips(pickRandom(3))
    }, [])

    return (
        <div className="flex flex-col gap-2">
            {chips.map((text, i) => (
                <button
                    key={text}
                    type="button"
                    onClick={() => onSelect(text)}
                    disabled={!isReady}
                    className={cn(
                        "assistant-chip-enter",
                        "flex items-center gap-2 px-3 py-2.5 rounded-xl text-left",
                        "border border-[hsl(var(--assistant-chip-border))]",
                        "bg-[hsl(var(--assistant-chip-bg))]",
                        "text-xs font-medium text-[hsl(var(--assistant-chip-text))]",
                        "transition-colors duration-150",
                        "hover:bg-[hsl(var(--assistant-chip-hover-bg))] hover:border-[hsl(var(--assistant-chip-hover-border))]",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                    style={{ animationDelay: `${i * 80}ms` }}
                >
                    <Zap className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--assistant-accent))]" />
                    <span>{text}</span>
                </button>
            ))}
        </div>
    )
}
