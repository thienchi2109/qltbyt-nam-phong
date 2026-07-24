"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import {
  type technicalConfigurationOptionsQueryKey,
  type technicalConfigurationSuppliersQueryKey,
} from "../technical-configuration-query-keys"
import { updateTechnicalConfigurationDossierRevisionCache } from "../technical-configuration-dossier-revision-cache"
import type {
  TechnicalConfigurationOptionsSnapshot,
  TechnicalConfigurationSuppliersSnapshot,
} from "../technical-configuration-supplier-option-operations"
import type { TechnicalConfigurationDossierWire } from "../types"
import {
  getTechnicalConfigurationBaselineErrorMessage,
  isTechnicalConfigurationBaselineConflict,
} from "../technical-configuration-baseline-version-state"

type SupplierQueryKey = ReturnType<typeof technicalConfigurationSuppliersQueryKey>
type OptionQueryKey = ReturnType<typeof technicalConfigurationOptionsQueryKey>

type TechnicalConfigurationIdentityMutationStateArgs = {
  dossier: TechnicalConfigurationDossierWire
  supplierQueryKey: SupplierQueryKey
  optionQueryKey: OptionQueryKey
  isMutationBlocked?: boolean
  onRevisionChange?: (revision: number) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
}

type TechnicalConfigurationIdentityOperationOptions = {
  detectConflict?: boolean
  allowReadOnly?: boolean
  allowMutationBlocked?: boolean
}

/** Centralizes revision, pending, conflict, and refresh state for identity mutations. */
export function useTechnicalConfigurationIdentityMutationState({
  dossier,
  supplierQueryKey,
  optionQueryKey,
  isMutationBlocked = false,
  onRevisionChange,
  onNavigationBlockedChange,
}: TechnicalConfigurationIdentityMutationStateArgs) {
  const queryClient = useQueryClient()
  const revisionRef = React.useRef(dossier.revision)
  const activeOperationRef = React.useRef(false)
  const [operation, setOperation] = React.useState<string | null>(null)
  const [isConflict, setIsConflict] = React.useState(false)
  const [validationError, setValidationError] = React.useState<string | null>(null)
  const [operationError, setOperationError] = React.useState<string | null>(null)
  const [refreshWarning, setRefreshWarning] = React.useState<string | null>(null)
  const isReadOnly = Boolean(dossier.archived_at)

  React.useEffect(() => {
    revisionRef.current = Math.max(revisionRef.current, dossier.revision)
  }, [dossier.revision])

  const commitRevision = React.useCallback(
    (revision: number) => {
      revisionRef.current = revision
      onRevisionChange?.(revision)
      updateTechnicalConfigurationDossierRevisionCache(queryClient, dossier, revision)
      queryClient.setQueryData<TechnicalConfigurationSuppliersSnapshot>(
        supplierQueryKey,
        (current) => (current ? { ...current, revision } : current)
      )
      queryClient.setQueryData<TechnicalConfigurationOptionsSnapshot>(optionQueryKey, (current) =>
        current ? { ...current, revision } : current
      )
    },
    [dossier, onRevisionChange, optionQueryKey, queryClient, supplierQueryKey]
  )

  const refreshQueries = React.useCallback(async () => {
    try {
      await Promise.all([
        queryClient.invalidateQueries(
          { queryKey: supplierQueryKey, exact: true },
          { throwOnError: true }
        ),
        queryClient.invalidateQueries(
          { queryKey: optionQueryKey, exact: true },
          { throwOnError: true }
        ),
      ])
    } catch {
      setRefreshWarning("Đã lưu thay đổi nhưng không thể làm mới dữ liệu từ máy chủ.")
    }
  }, [optionQueryKey, queryClient, supplierQueryKey])

  const runOperation = React.useCallback(
    async (
      name: string,
      fallback: string,
      action: () => Promise<void>,
      options: TechnicalConfigurationIdentityOperationOptions = {}
    ) => {
      const { detectConflict = true, allowReadOnly = false, allowMutationBlocked = false } = options
      if (
        activeOperationRef.current ||
        (isReadOnly && !allowReadOnly) ||
        (isMutationBlocked && !allowMutationBlocked)
      ) {
        return
      }
      activeOperationRef.current = true
      setOperation(name)
      setValidationError(null)
      setOperationError(null)
      setRefreshWarning(null)
      onNavigationBlockedChange?.(true)
      try {
        await action()
      } catch (error) {
        if (detectConflict && isTechnicalConfigurationBaselineConflict(error)) {
          setIsConflict(true)
          setOperationError("Dữ liệu đã thay đổi trên máy chủ. Hãy tải lại trước khi tiếp tục.")
        } else {
          setOperationError(getTechnicalConfigurationBaselineErrorMessage(error, fallback))
        }
      } finally {
        activeOperationRef.current = false
        setOperation(null)
        onNavigationBlockedChange?.(false)
      }
    },
    [isMutationBlocked, isReadOnly, onNavigationBlockedChange]
  )

  React.useEffect(() => () => onNavigationBlockedChange?.(false), [onNavigationBlockedChange])

  return {
    revisionRef,
    isConflict,
    setIsConflict,
    isPending: operation !== null,
    isReadOnly,
    validationError,
    setValidationError,
    operationError,
    refreshWarning,
    commitRevision,
    refreshQueries,
    runOperation,
    clearMessages: () => {
      setValidationError(null)
      setOperationError(null)
    },
  }
}
