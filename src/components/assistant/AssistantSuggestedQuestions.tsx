import * as React from "react"
import { Zap, Star } from "lucide-react"
import { STARTER_PROMPT_GROUPS, PINNED_PROMPTS } from "@/lib/ai/prompts/starter-suggestions"
import { cn } from "@/lib/utils"

interface AssistantSuggestedQuestionsProps {
    onSelect: (text: string) => void
    isReady: boolean
}

function hashString(value: string): number {
    let hash = 2166136261
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i)
        hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
}

function createSeededRandom(seed: number): () => number {
    let state = seed >>> 0
    if (state === 0) {
        state = 0x6d2b79f5
    }
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0
        return state / 0x100000000
    }
}

/** Pool all suggestion strings and pick `count` unique items using deterministic shuffle. */
function pickDeterministic(count: number, seedSource: string): string[] {
    const pool = STARTER_PROMPT_GROUPS.flatMap((g) => [...g.suggestions])
    const nextRandom = createSeededRandom(hashString(seedSource))

    // Fisher-Yates shuffle with deterministic pseudo-random generator.
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(nextRandom() * (i + 1))
        const temp = pool[i]
        pool[i] = pool[j]
        pool[j] = temp
    }

    return pool.slice(0, count)
}

/**
 * Renders 2 pinned prompt chips followed by 3 randomly selected chips.
 *
 * Pinned chips always appear first with a Star icon.
 * Random chips use a Zap icon. All disabled when not ready.
 * Uses staggered fade-in animation from assistant-styles.css.
 * Design spec §4.6.
 */
export function AssistantSuggestedQuestions({
    onSelect,
    isReady,
}: AssistantSuggestedQuestionsProps) {
    const seedSource = React.useId()
    const randomChips = React.useMemo(() => pickDeterministic(3, seedSource), [seedSource])

    return (
        <div className="flex flex-col gap-2">
            {PINNED_PROMPTS.map((text, i) => (
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
                    <Star className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--assistant-accent))]" />
                    <span>{text}</span>
                </button>
            ))}
            {randomChips.map((text, i) => (
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
                    style={{ animationDelay: `${(PINNED_PROMPTS.length + i) * 80}ms` }}
                >
                    <Zap className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--assistant-accent))]" />
                    <span>{text}</span>
                </button>
            ))}
        </div>
    )
}
