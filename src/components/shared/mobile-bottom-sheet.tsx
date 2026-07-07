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
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const previousActiveElement = React.useRef<HTMLElement | null>(null)

  // Focus management: open modally, move focus into dialog, and restore on close.
  React.useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return

    previousActiveElement.current = document.activeElement as HTMLElement

    if (typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal()
    } else if (!dialog.hasAttribute("open")) {
      dialog.setAttribute("open", "")
    }

    const timer = setTimeout(() => {
      const firstFocusable = dialog.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

      if (firstFocusable) {
        firstFocusable.focus()
      } else {
        dialog.focus()
      }
    }, 100)

    return () => {
      clearTimeout(timer)

      if (dialog.open && typeof dialog.close === "function") {
        dialog.close()
      } else {
        dialog.removeAttribute("open")
      }

      if (previousActiveElement.current) {
        previousActiveElement.current.focus()
        previousActiveElement.current = null
      }
    }
  }, [open])

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-[1002] m-0 flex h-screen w-screen max-h-none max-w-none items-end border-0 bg-transparent p-0"
      onCancel={handleCancel}
      aria-modal="true"
      aria-label={ariaLabel}
      tabIndex={-1}
    >
      {/* Backdrop */}
      <div
        data-testid="mobile-bottom-sheet-backdrop"
        className="absolute inset-0 bg-gray-950/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Sheet panel */}
      <div
        className={cn(
          "relative w-full bg-background rounded-t-2xl shadow-2xl",
          "animate-in slide-in-from-bottom duration-300",
          "flex flex-col",
          className
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
    </dialog>
  )
}
