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
  readonly confirmLabel: React.ReactNode
  readonly isPending: boolean
  readonly onConfirm: () => void
}

/**
 * Shared destructive confirmation shell for feature-owned delete flows.
 */
export function DestructiveConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  isPending,
  onConfirm,
}: DestructiveConfirmDialogProps): React.JSX.Element {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Hủy</AlertDialogCancel>
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
