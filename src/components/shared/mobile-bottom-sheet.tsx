"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface MobileBottomSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    ariaLabel: string
    children: React.ReactNode
    className?: string
}

/**
 * Shared full-screen bottom sheet primitive for mobile layouts.
 *
 * Extracted from FilterBottomSheet to provide a reusable presentation
 * pattern: backdrop overlay, rounded-top panel, drag handle, focus trap,
 * Escape key, and ARIA dialog semantics.
 */
export function MobileBottomSheet({
    open,
    onOpenChange,
    ariaLabel,
    children,
    className,
}: MobileBottomSheetProps) {
    const dialogRef = React.useRef<HTMLDivElement>(null)
    const previousActiveElement = React.useRef<HTMLElement | null>(null)

    // Focus management: move focus into dialog when opened, restore on close
    React.useEffect(() => {
        if (open) {
            previousActiveElement.current = document.activeElement as HTMLElement

            const timer = setTimeout(() => {
                if (!dialogRef.current) return

                const firstFocusable = dialogRef.current.querySelector<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                )

                if (firstFocusable) {
                    firstFocusable.focus()
                } else {
                    dialogRef.current.focus()
                }
            }, 100)

            return () => clearTimeout(timer)
        }

        if (previousActiveElement.current) {
            previousActiveElement.current.focus()
            previousActiveElement.current = null
        }
    }, [open])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            onOpenChange(false)
            return
        }

        // Focus trap: keep Tab navigation inside the dialog
        if (e.key === "Tab" && dialogRef.current) {
            const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            )
            const focusableArray = Array.from(focusableElements)
            const firstFocusable = focusableArray[0]
            const lastFocusable = focusableArray[focusableArray.length - 1]

            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault()
                    lastFocusable?.focus()
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault()
                    firstFocusable?.focus()
                }
            }
        }
    }

    if (!open) return null

    return (
        <div
            ref={dialogRef}
            className="fixed inset-0 z-[1002] flex items-end"
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            tabIndex={-1}
        >
            {/* Backdrop */}
            <div
                data-testid="mobile-bottom-sheet-backdrop"
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={() => onOpenChange(false)}
                aria-hidden="true"
            />

            {/* Sheet panel */}
            <div
                className={cn(
                    "relative w-full bg-background rounded-t-2xl shadow-2xl",
                    "animate-in slide-in-from-bottom duration-300",
                    "flex flex-col",
                    className,
                )}
                style={{ maxHeight: "calc(100vh - 4rem)" }}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                    <div
                        data-testid="mobile-bottom-sheet-handle"
                        className="w-10 h-1 rounded-full bg-muted-foreground/30"
                    />
                </div>

                {children}
            </div>
        </div>
    )
}
