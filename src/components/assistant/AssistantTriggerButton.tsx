"use client"

import * as React from "react"
import { Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface AssistantTriggerButtonProps {
    isOpen: boolean
    onToggle: () => void
}

/**
 * Floating Action Button (FAB) to toggle the assistant chat panel.
 *
 * Position: fixed bottom-right, z-70 (above mobile footer nav).
 * Icon transitions between Sparkles (closed) and X (open) with rotation.
 * Design spec §4.1.
 */
export function AssistantTriggerButton({
    isOpen,
    onToggle,
}: AssistantTriggerButtonProps) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-label={isOpen ? "Đóng trợ lý" : "Trợ lý AI"}
            data-testid="assistant-trigger-button"
            className={cn(
                "fixed bottom-6 right-6 z-[997] rounded-full",
                "w-12 h-12 md:w-12 md:h-12",
                "flex items-center justify-center",
                "bg-gradient-to-br from-[hsl(194,45%,42%)] to-[hsl(194,45%,36%)]",
                "text-white shadow-lg",
                "transition-all duration-200 ease-out",
                "hover:shadow-xl hover:scale-[1.08]",
                "active:scale-95 active:duration-100",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
        >
            <span
                className={cn(
                    "transition-transform duration-200",
                    isOpen && "rotate-90",
                )}
            >
                {isOpen ? (
                    <X className="h-5 w-5" data-testid="icon-x" />
                ) : (
                    <Sparkles className="h-5 w-5" data-testid="icon-sparkles" />
                )}
            </span>
        </button>
    )
}
