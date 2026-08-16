"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export interface DestructiveConfirmDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: React.ReactNode
  readonly description: React.ReactNode
  readonly cancelLabel?: React.ReactNode
  readonly confirmLabel: React.ReactNode
  readonly isPending: boolean
  readonly onConfirm: () => void
  readonly onCloseAutoFocus?: React.ComponentPropsWithoutRef<
    typeof AlertDialogContent
  >["onCloseAutoFocus"]
}

/**
 * Shared destructive confirmation shell for irreversible user actions.
 */
export function DestructiveConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel = "Hủy",
  confirmLabel,
  isPending,
  onConfirm,
  onCloseAutoFocus,
}: DestructiveConfirmDialogProps): React.JSX.Element {
  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (isPending && !nextOpen) return
      onOpenChange(nextOpen)
    },
    [isPending, onOpenChange]
  )

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
