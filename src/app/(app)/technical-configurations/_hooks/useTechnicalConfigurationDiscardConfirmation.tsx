"use client"

import * as React from "react"

import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog"

interface PendingDiscardConfirmation {
  description: React.ReactNode
  onConfirm: () => void
}

interface TechnicalConfigurationDiscardConfirmationState {
  discardConfirmationDialog: React.JSX.Element
  isDiscardConfirmationOpen: boolean
  requestDiscardConfirmation: (
    description: React.ReactNode,
    onConfirm: PendingDiscardConfirmation["onConfirm"]
  ) => void
}

/** Queues one destructive draft-discard action behind the shared alert dialog. */
export function useTechnicalConfigurationDiscardConfirmation(): TechnicalConfigurationDiscardConfirmationState {
  const [pendingConfirmation, setPendingConfirmation] =
    React.useState<PendingDiscardConfirmation | null>(null)

  const requestDiscardConfirmation = React.useCallback(
    (description: React.ReactNode, onConfirm: PendingDiscardConfirmation["onConfirm"]) => {
      setPendingConfirmation({ description, onConfirm })
    },
    []
  )

  const handleOpenChange = React.useCallback((open: boolean) => {
    if (!open) setPendingConfirmation(null)
  }, [])

  const handleConfirm = React.useCallback(() => {
    const onConfirm = pendingConfirmation?.onConfirm
    setPendingConfirmation(null)
    onConfirm?.()
  }, [pendingConfirmation])

  return {
    isDiscardConfirmationOpen: pendingConfirmation !== null,
    requestDiscardConfirmation,
    discardConfirmationDialog: (
      <DestructiveConfirmDialog
        open={pendingConfirmation !== null}
        onOpenChange={handleOpenChange}
        title="Bỏ thay đổi chưa lưu?"
        description={pendingConfirmation?.description ?? ""}
        confirmLabel="Bỏ thay đổi"
        isPending={false}
        onConfirm={handleConfirm}
      />
    ),
  }
}
