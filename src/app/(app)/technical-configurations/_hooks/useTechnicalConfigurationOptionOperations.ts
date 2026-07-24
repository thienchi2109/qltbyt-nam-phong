"use client"

import * as React from "react"
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query"

import { useTechnicalConfigurationIdentityMutationState } from "./useTechnicalConfigurationIdentityMutationState"
import {
  getTechnicalConfigurationSupplierOptionCount,
  removeTechnicalConfigurationOption,
  removeTechnicalConfigurationSupplier,
  saveTechnicalConfigurationOption,
  saveTechnicalConfigurationSupplier,
  type TechnicalConfigurationOptionsSnapshot,
  type TechnicalConfigurationSuppliersSnapshot,
} from "../technical-configuration-supplier-option-operations"
import {
  createEmptyTechnicalConfigurationOptionDraft,
  createEmptyTechnicalConfigurationSupplierDraft,
  getNextTechnicalConfigurationSelectionId,
  toTechnicalConfigurationOptionDraft,
  toTechnicalConfigurationSupplierDraft,
  type TechnicalConfigurationOptionDraft,
  type TechnicalConfigurationSupplierDraft,
} from "../technical-configuration-supplier-option-state"
import {
  type technicalConfigurationOptionsQueryKey,
  type technicalConfigurationSuppliersQueryKey,
} from "../technical-configuration-query-keys"
import type {
  TechnicalConfigurationOptionWire,
  TechnicalConfigurationSupplierWire,
} from "../supplier-option-types"
import type { TechnicalConfigurationDossierWire } from "../types"

type SetState<T> = React.Dispatch<React.SetStateAction<T>>
type SupplierQueryKey = ReturnType<typeof technicalConfigurationSuppliersQueryKey>
type OptionQueryKey = ReturnType<typeof technicalConfigurationOptionsQueryKey>
type AdoptSelection = (
  suppliers: TechnicalConfigurationSupplierWire[],
  options: TechnicalConfigurationOptionWire[],
  preferredSupplierId?: string | null,
  preferredOptionId?: string | null
) => void

type TechnicalConfigurationOptionOperationsArgs = {
  dossier: TechnicalConfigurationDossierWire
  suppliers: TechnicalConfigurationSupplierWire[]
  options: TechnicalConfigurationOptionWire[]
  selectedSupplierId: string | null
  selectedOptionId: string | null
  supplierDraft: TechnicalConfigurationSupplierDraft
  optionDraft: TechnicalConfigurationOptionDraft
  supplierDraftBaseline: TechnicalConfigurationSupplierDraft
  supplierQueryKey: SupplierQueryKey
  optionQueryKey: OptionQueryKey
  suppliersQuery: UseQueryResult<TechnicalConfigurationSuppliersSnapshot>
  optionsQuery: UseQueryResult<TechnicalConfigurationOptionsSnapshot>
  isSnapshotConflict: boolean
  hasLocalDraftChanges: boolean
  adoptSelection: AdoptSelection
  setSelectedSupplierId: SetState<string | null>
  setSelectedOptionId: SetState<string | null>
  setSupplierDraft: SetState<TechnicalConfigurationSupplierDraft>
  setOptionDraft: SetState<TechnicalConfigurationOptionDraft>
  setSupplierDraftBaseline: SetState<TechnicalConfigurationSupplierDraft>
  setOptionDraftBaseline: SetState<TechnicalConfigurationOptionDraft>
  setSelectedSupplierSnapshot: SetState<TechnicalConfigurationSupplierWire | null>
  setSelectedOptionSnapshot: SetState<TechnicalConfigurationOptionWire | null>
  setIsCreatingSupplier: SetState<boolean>
  setIsCreatingOption: SetState<boolean>
  onRevisionChange?: (revision: number) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
}

function replaceById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((candidate) => candidate.id === item.id)
  return index < 0 ? [...items, item] : items.with(index, item)
}

/** Owns explicit supplier/option mutations and their cache/revision side effects. */
export function useTechnicalConfigurationOptionOperations({
  dossier,
  suppliers,
  options,
  selectedSupplierId,
  selectedOptionId,
  supplierDraft,
  optionDraft,
  supplierDraftBaseline,
  supplierQueryKey,
  optionQueryKey,
  suppliersQuery,
  optionsQuery,
  isSnapshotConflict,
  hasLocalDraftChanges,
  adoptSelection,
  setSelectedSupplierId,
  setSelectedOptionId,
  setSupplierDraft,
  setOptionDraft,
  setSupplierDraftBaseline,
  setOptionDraftBaseline,
  setSelectedSupplierSnapshot,
  setSelectedOptionSnapshot,
  setIsCreatingSupplier,
  setIsCreatingOption,
  onRevisionChange,
  onNavigationBlockedChange,
}: TechnicalConfigurationOptionOperationsArgs) {
  const queryClient = useQueryClient()
  const mutationState = useTechnicalConfigurationIdentityMutationState({
    dossier,
    supplierQueryKey,
    optionQueryKey,
    isMutationBlocked: isSnapshotConflict,
    onRevisionChange,
    onNavigationBlockedChange,
  })
  const {
    revisionRef,
    commitRevision,
    refreshQueries,
    runOperation,
    setIsConflict,
    setValidationError,
  } = mutationState

  React.useEffect(() => {
    const supplierRevision = suppliersQuery.data?.revision
    const optionRevision = optionsQuery.data?.revision
    if (
      hasLocalDraftChanges ||
      supplierRevision === undefined ||
      supplierRevision !== optionRevision
    ) {
      return
    }
    revisionRef.current = Math.max(dossier.revision, supplierRevision)
  }, [
    dossier.revision,
    hasLocalDraftChanges,
    optionsQuery.data?.revision,
    revisionRef,
    suppliersQuery.data?.revision,
  ])

  const saveSupplier = React.useCallback(async () => {
    if (!supplierDraft.name.trim()) {
      setValidationError("Tên nhà cung cấp là bắt buộc.")
      return
    }
    await runOperation("supplier-save", "Không thể lưu nhà cung cấp.", async () => {
      const response = await saveTechnicalConfigurationSupplier({
        dossierId: dossier.id,
        draft: supplierDraft,
        revision: revisionRef.current,
      })
      queryClient.setQueryData<TechnicalConfigurationSuppliersSnapshot>(
        supplierQueryKey,
        (current) => ({
          suppliers: replaceById(current?.suppliers ?? [], response.data),
          revision: response.data.revision,
        })
      )
      commitRevision(response.data.revision)
      const savedDraft = toTechnicalConfigurationSupplierDraft(response.data)
      setSelectedSupplierId(response.data.id)
      setSelectedSupplierSnapshot(response.data)
      setSupplierDraft(savedDraft)
      setSupplierDraftBaseline(savedDraft)
      setIsCreatingSupplier(false)
      setIsConflict(false)
      await refreshQueries()
    })
  }, [
    commitRevision,
    dossier.id,
    queryClient,
    refreshQueries,
    revisionRef,
    runOperation,
    setIsConflict,
    setIsCreatingSupplier,
    setSelectedSupplierId,
    setSelectedSupplierSnapshot,
    setSupplierDraft,
    setSupplierDraftBaseline,
    setValidationError,
    supplierDraft,
    supplierQueryKey,
  ])

  const saveOption = React.useCallback(async () => {
    if (!optionDraft.model.trim() && !optionDraft.optionName.trim()) {
      setValidationError("Model hoặc tên phương án là bắt buộc.")
      return
    }
    await runOperation("option-save", "Không thể lưu phương án.", async () => {
      const response = await saveTechnicalConfigurationOption({
        draft: optionDraft,
        revision: revisionRef.current,
      })
      queryClient.setQueryData<TechnicalConfigurationOptionsSnapshot>(
        optionQueryKey,
        (current) => ({
          options: replaceById(current?.options ?? [], response.data),
          revision: response.data.revision,
        })
      )
      commitRevision(response.data.revision)
      const savedDraft = toTechnicalConfigurationOptionDraft(response.data)
      setSelectedSupplierId(response.data.supplier_id)
      setSelectedOptionId(response.data.id)
      setSelectedOptionSnapshot(response.data)
      setOptionDraft(savedDraft)
      setOptionDraftBaseline(savedDraft)
      setIsCreatingOption(false)
      setIsConflict(false)
      await refreshQueries()
    })
  }, [
    commitRevision,
    optionDraft,
    optionQueryKey,
    queryClient,
    refreshQueries,
    revisionRef,
    runOperation,
    setIsConflict,
    setIsCreatingOption,
    setOptionDraft,
    setOptionDraftBaseline,
    setSelectedOptionId,
    setSelectedOptionSnapshot,
    setSelectedSupplierId,
    setValidationError,
  ])

  const deleteOption = React.useCallback(
    async (optionId: string) => {
      const targetOption = options.find((item) => item.id === optionId)
      if (!targetOption) return
      const targetSupplierId = targetOption.supplier_id
      const preserveSupplierDraft =
        selectedSupplierId === targetSupplierId && supplierDraft.persistedId === targetSupplierId
      const siblingIds: string[] = []
      for (const item of options) {
        if (item.supplier_id === targetSupplierId) siblingIds.push(item.id)
      }
      const nextOptionId = getNextTechnicalConfigurationSelectionId(siblingIds, optionId)
      await runOperation("option-delete", "Không thể xóa phương án.", async () => {
        const response = await removeTechnicalConfigurationOption(optionId, revisionRef.current)
        const remainingOptions = options.filter((item) => item.id !== optionId)
        queryClient.setQueryData<TechnicalConfigurationOptionsSnapshot>(optionQueryKey, () => ({
          options: remainingOptions,
          revision: response.data.revision,
        }))
        commitRevision(response.data.revision)
        adoptSelection(suppliers, remainingOptions, targetSupplierId, nextOptionId)
        if (preserveSupplierDraft) {
          setSupplierDraft(supplierDraft)
          setSupplierDraftBaseline(supplierDraftBaseline)
        }
        await refreshQueries()
      })
    },
    [
      adoptSelection,
      commitRevision,
      optionQueryKey,
      options,
      queryClient,
      refreshQueries,
      revisionRef,
      runOperation,
      selectedSupplierId,
      setSupplierDraft,
      setSupplierDraftBaseline,
      supplierDraft,
      supplierDraftBaseline,
      suppliers,
    ]
  )

  const deleteSupplier = React.useCallback(
    async (supplierId: string) => {
      if (!suppliers.some((item) => item.id === supplierId)) return
      const nextSupplierId = getNextTechnicalConfigurationSelectionId(
        suppliers.map((item) => item.id),
        supplierId
      )
      await runOperation("supplier-delete", "Không thể xóa nhà cung cấp.", async () => {
        const response = await removeTechnicalConfigurationSupplier(supplierId, revisionRef.current)
        const remainingSuppliers = suppliers.filter((item) => item.id !== supplierId)
        const remainingOptions = options.filter((item) => item.supplier_id !== supplierId)
        queryClient.setQueryData<TechnicalConfigurationSuppliersSnapshot>(supplierQueryKey, () => ({
          suppliers: remainingSuppliers,
          revision: response.data.revision,
        }))
        queryClient.setQueryData<TechnicalConfigurationOptionsSnapshot>(optionQueryKey, () => ({
          options: remainingOptions,
          revision: response.data.revision,
        }))
        commitRevision(response.data.revision)
        adoptSelection(remainingSuppliers, remainingOptions, nextSupplierId, null)
        await refreshQueries()
      })
    },
    [
      adoptSelection,
      commitRevision,
      optionQueryKey,
      options,
      queryClient,
      refreshQueries,
      revisionRef,
      runOperation,
      supplierQueryKey,
      suppliers,
    ]
  )

  const deleteSelectedOption = React.useCallback(async () => {
    if (selectedOptionId) await deleteOption(selectedOptionId)
  }, [deleteOption, selectedOptionId])

  const deleteSelectedSupplier = React.useCallback(async () => {
    if (selectedSupplierId) await deleteSupplier(selectedSupplierId)
  }, [deleteSupplier, selectedSupplierId])

  const reload = React.useCallback(async () => {
    await runOperation(
      "reload",
      "Không thể tải lại nhà cung cấp và phương án.",
      async () => {
        const [supplierResult, optionResult] = await Promise.all([
          suppliersQuery.refetch({ throwOnError: true }),
          optionsQuery.refetch({ throwOnError: true }),
        ])
        const nextSuppliers = supplierResult.data?.suppliers ?? []
        const nextOptions = optionResult.data?.options ?? []
        const supplierRevision = supplierResult.data?.revision
        const optionRevision = optionResult.data?.revision
        if (
          supplierRevision === undefined ||
          optionRevision === undefined ||
          supplierRevision !== optionRevision
        ) {
          setIsConflict(true)
          throw new Error("Supplier and option snapshots changed during reload.")
        }
        commitRevision(Math.max(revisionRef.current, supplierRevision))
        adoptSelection(nextSuppliers, nextOptions)
        setIsConflict(false)
      },
      {
        detectConflict: false,
        allowReadOnly: true,
        allowMutationBlocked: true,
      }
    )
  }, [
    adoptSelection,
    commitRevision,
    optionsQuery,
    revisionRef,
    runOperation,
    setIsConflict,
    suppliersQuery,
  ])

  return {
    ...mutationState,
    saveSupplier,
    saveOption,
    deleteSupplier,
    deleteOption,
    deleteSelectedSupplier,
    deleteSelectedOption,
    loadSupplierOptionCount: (supplierId: string) =>
      getTechnicalConfigurationSupplierOptionCount(dossier.id, supplierId),
    reload,
  }
}
