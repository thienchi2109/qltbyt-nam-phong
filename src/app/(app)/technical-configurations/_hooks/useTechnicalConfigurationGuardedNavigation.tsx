"use client"

import * as React from "react"

import { useTechnicalConfigurationDiscardConfirmation } from "./useTechnicalConfigurationDiscardConfirmation"

type UseTechnicalConfigurationGuardedNavigationInput = {
  isDirty: boolean
  isBlocked: boolean
  description?: React.ReactNode
  cancelLabel?: React.ReactNode
  onDiscard?: () => void
}

const DEFAULT_DISCARD_DESCRIPTION =
  "Các thay đổi chưa lưu sẽ bị mất nếu bạn tiếp tục chuyển khỏi nội dung hiện tại."

/** Applies the shared pending-block and dirty-confirm contract to one navigation boundary. */
export function useTechnicalConfigurationGuardedNavigation({
  isDirty,
  isBlocked,
  description = DEFAULT_DISCARD_DESCRIPTION,
  cancelLabel,
  onDiscard,
}: UseTechnicalConfigurationGuardedNavigationInput) {
  const { requestDiscardConfirmation, discardConfirmationDialog } =
    useTechnicalConfigurationDiscardConfirmation({ cancelLabel })

  const requestNavigation = React.useCallback(
    (navigate: () => void) => {
      if (isBlocked) return
      if (!isDirty) {
        navigate()
        return
      }
      requestDiscardConfirmation(description, () => {
        onDiscard?.()
        navigate()
      })
    },
    [description, isBlocked, isDirty, onDiscard, requestDiscardConfirmation]
  )

  return {
    requestNavigation,
    discardConfirmationDialog,
  }
}
