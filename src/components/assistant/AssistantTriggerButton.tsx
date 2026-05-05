"use client"

import * as React from "react"
import { Sparkles, X } from "lucide-react"
import { FloatingActionButton } from "@/components/shared/FloatingActionButton"
import { cn } from "@/lib/utils"

interface AssistantTriggerButtonProps {
    isOpen: boolean
    onToggle: () => void
}

/**
 * Floating Action Button (FAB) to toggle the assistant chat panel.
 *
 * Position: fixed bottom-right, z-997 (below AssistantPanel, above page content).
 * Mobile: bottom offset clears MobileFooterNav and page-level FABs.
 * Icon transitions between Sparkles (closed) and X (open) with rotation.
 * Design spec §4.1.
 */
export function AssistantTriggerButton({
    isOpen,
    onToggle,
}: AssistantTriggerButtonProps) {
    return (
        <FloatingActionButton
            type="button"
            onClick={onToggle}
            aria-label={isOpen ? "Đóng trợ lý" : "Trợ lý AI"}
            data-testid="assistant-trigger-button"
            tone="assistant"
            placement="assistant"
        >
            <span
                className={cn(
                    "transition-transform duration-200",
                    isOpen && "rotate-90",
                )}
            >
                {isOpen ? (
                    <X data-testid="icon-x" />
                ) : (
                    <Sparkles data-testid="icon-sparkles" />
                )}
            </span>
        </FloatingActionButton>
    )
}
