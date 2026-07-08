"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

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
 * Escape key, and ARIA dialog semantics through the shared Radix Sheet primitive.
 */
export function MobileBottomSheet({
  open,
  onOpenChange,
  ariaLabel,
  children,
  className,
}: MobileBottomSheetProps) {
  const previouslyFocusedElement = React.useRef<HTMLElement | null>(null)
  const restoreFocusTimer = React.useRef<number | null>(null)
  const wasOpen = React.useRef(false)

  React.useEffect(() => {
    return () => {
      if (restoreFocusTimer.current !== null) {
        window.clearTimeout(restoreFocusTimer.current)
      }
    }
  }, [])

  React.useLayoutEffect(() => {
    if (open && !wasOpen.current) {
      if (restoreFocusTimer.current !== null) {
        window.clearTimeout(restoreFocusTimer.current)
        restoreFocusTimer.current = null
      }
      previouslyFocusedElement.current = document.activeElement as HTMLElement | null
    }

    if (!open && wasOpen.current) {
      const elementToRestore = previouslyFocusedElement.current
      previouslyFocusedElement.current = null

      restoreFocusTimer.current = window.setTimeout(() => {
        if (elementToRestore && document.contains(elementToRestore)) {
          elementToRestore.focus()
        }
        restoreFocusTimer.current = null
      }, 0)
    }

    wasOpen.current = open
  }, [open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideCloseButton
        overlayProps={{
          "data-testid": "mobile-bottom-sheet-backdrop",
          className: "bg-gray-950/40 backdrop-blur-sm",
        }}
        aria-label={ariaLabel}
        aria-modal="true"
        className={cn(
          "w-full max-w-none gap-0 border-0 bg-background p-0",
          "rounded-t-2xl shadow-2xl",
          "animate-in slide-in-from-bottom duration-300",
          "flex flex-col",
          className
        )}
        style={{ maxHeight: "calc(100vh - 4rem)" }}
      >
        <SheetTitle className="sr-only">{ariaLabel}</SheetTitle>

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div
            data-testid="mobile-bottom-sheet-handle"
            className="w-10 h-1 rounded-full bg-muted-foreground/30"
          />
        </div>

        {children}
      </SheetContent>
    </Sheet>
  )
}
