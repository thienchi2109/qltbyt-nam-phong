"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { useTechnicalConfigurationBeforeUnloadGuard } from "./useTechnicalConfigurationBeforeUnloadGuard"
import { useTechnicalConfigurationOptionOperations } from "./useTechnicalConfigurationOptionOperations"
import {
  listAllTechnicalConfigurationOptions,
  listAllTechnicalConfigurationSuppliers,
} from "../technical-configuration-supplier-option-operations"
import {
  createEmptyTechnicalConfigurationOptionDraft,
  createEmptyTechnicalConfigurationSupplierDraft,
  isTechnicalConfigurationOptionDraftDirty,
  isTechnicalConfigurationSupplierDraftDirty,
  selectTechnicalConfigurationSupplierOption,
  toTechnicalConfigurationOptionDraft,
  toTechnicalConfigurationSupplierDraft,
  type TechnicalConfigurationOptionDraftPatch,
} from "../technical-configuration-supplier-option-state"
import {
  technicalConfigurationOptionsQueryKey,
  technicalConfigurationSuppliersQueryKey,
} from "../technical-configuration-query-keys"
import type {
  TechnicalConfigurationOptionWire,
  TechnicalConfigurationSupplierWire,
} from "../supplier-option-types"
import type { TechnicalConfigurationDossierWire } from "../types"

const EMPTY_SUPPLIERS: TechnicalConfigurationSupplierWire[] = []
const EMPTY_OPTIONS: TechnicalConfigurationOptionWire[] = []

type TechnicalConfigurationOptionsHookArgs = {
  dossier: TechnicalConfigurationDossierWire
  isMutationBlocked?: boolean
  onRevisionChange?: (revision: number) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
}

/** Owns dossier-scoped supplier/option snapshots and their local editable drafts. */
export function useTechnicalConfigurationOptions({
  dossier,
  isMutationBlocked = false,
  onRevisionChange,
  onNavigationBlockedChange,
}: TechnicalConfigurationOptionsHookArgs) {
  const supplierQueryKey = React.useMemo(
    () => technicalConfigurationSuppliersQueryKey(dossier.id),
    [dossier.id]
  )
  const optionQueryKey = React.useMemo(
    () => technicalConfigurationOptionsQueryKey(dossier.id),
    [dossier.id]
  )
  const suppliersQuery = useQuery({
    queryKey: supplierQueryKey,
    queryFn: ({ signal }) => listAllTechnicalConfigurationSuppliers(dossier.id, signal),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const optionsQuery = useQuery({
    queryKey: optionQueryKey,
    queryFn: ({ signal }) => listAllTechnicalConfigurationOptions(dossier.id, signal),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const suppliers = suppliersQuery.data?.suppliers ?? EMPTY_SUPPLIERS
  const options = optionsQuery.data?.options ?? EMPTY_OPTIONS
  const hasSnapshotMismatch = Boolean(
    suppliersQuery.data &&
    optionsQuery.data &&
    suppliersQuery.data.revision !== optionsQuery.data.revision
  )
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string | null>(null)
  const [selectedOptionId, setSelectedOptionId] = React.useState<string | null>(null)
  const [supplierDraft, setSupplierDraft] = React.useState(
    createEmptyTechnicalConfigurationSupplierDraft
  )
  const [optionDraft, setOptionDraft] = React.useState(() =>
    createEmptyTechnicalConfigurationOptionDraft()
  )
  const [supplierDraftBaseline, setSupplierDraftBaseline] = React.useState(
    createEmptyTechnicalConfigurationSupplierDraft
  )
  const [optionDraftBaseline, setOptionDraftBaseline] = React.useState(() =>
    createEmptyTechnicalConfigurationOptionDraft()
  )
  const [selectedSupplierSnapshot, setSelectedSupplierSnapshot] =
    React.useState<TechnicalConfigurationSupplierWire | null>(null)
  const [selectedOptionSnapshot, setSelectedOptionSnapshot] =
    React.useState<TechnicalConfigurationOptionWire | null>(null)
  const [isCreatingSupplier, setIsCreatingSupplier] = React.useState(false)
  const [isCreatingOption, setIsCreatingOption] = React.useState(false)
  const isSupplierDirty = isTechnicalConfigurationSupplierDraftDirty({
    draft: supplierDraft,
    baseline: supplierDraftBaseline,
    isCreating: isCreatingSupplier,
  })
  const isOptionDirty = isTechnicalConfigurationOptionDraftDirty({
    draft: optionDraft,
    baseline: optionDraftBaseline,
    isCreating: isCreatingOption,
  })
  const isDirty = isSupplierDirty || isOptionDirty
  const hasMissingDirtySelection =
    (isSupplierDirty &&
      supplierDraft.persistedId !== null &&
      !suppliers.some((supplier) => supplier.id === supplierDraft.persistedId)) ||
    (isOptionDirty &&
      optionDraft.persistedId !== null &&
      !options.some((option) => option.id === optionDraft.persistedId))
  const hasSnapshotConflict = hasSnapshotMismatch || hasMissingDirtySelection

  const adoptSelection = React.useCallback(
    (
      nextSuppliers: TechnicalConfigurationSupplierWire[],
      nextOptions: TechnicalConfigurationOptionWire[],
      preferredSupplierId = selectedSupplierId,
      preferredOptionId = selectedOptionId
    ) => {
      const selection = selectTechnicalConfigurationSupplierOption({
        suppliers: nextSuppliers,
        options: nextOptions,
        preferredSupplierId,
        preferredOptionId,
      })
      setSelectedSupplierId(selection.supplierId)
      setSelectedOptionId(selection.optionId)
      setSupplierDraft(selection.supplierDraft)
      setOptionDraft(selection.optionDraft)
      setSupplierDraftBaseline(selection.supplierDraft)
      setOptionDraftBaseline(selection.optionDraft)
      setSelectedSupplierSnapshot(
        nextSuppliers.find((supplier) => supplier.id === selection.supplierId) ?? null
      )
      setSelectedOptionSnapshot(
        nextOptions.find((option) => option.id === selection.optionId) ?? null
      )
      // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change -- Canonical snapshots arrive asynchronously; explicit creation mode is guarded before adoption.
      setIsCreatingSupplier(false)
      // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change -- Canonical snapshots arrive asynchronously; explicit creation mode is guarded before adoption.
      setIsCreatingOption(false)
    },
    [selectedOptionId, selectedSupplierId]
  )

  const operations = useTechnicalConfigurationOptionOperations({
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
    isSnapshotConflict: hasSnapshotConflict,
    isMutationBlocked,
    hasLocalDraftChanges: isDirty,
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
  })
  const isConflict = hasSnapshotConflict || operations.isConflict

  React.useEffect(() => {
    if (
      !suppliersQuery.data ||
      !optionsQuery.data ||
      isDirty ||
      isCreatingSupplier ||
      isCreatingOption ||
      isConflict ||
      operations.isPending
    ) {
      return
    }
    adoptSelection(suppliersQuery.data.suppliers, optionsQuery.data.options)
  }, [
    adoptSelection,
    isCreatingOption,
    isCreatingSupplier,
    isDirty,
    operations.isPending,
    optionsQuery.data,
    suppliersQuery.data,
    isConflict,
  ])

  useTechnicalConfigurationBeforeUnloadGuard(isDirty)

  const resetMessages = React.useCallback(() => {
    operations.clearMessages()
  }, [operations])

  const selectSupplier = React.useCallback(
    (supplierId: string) => {
      if (operations.isPending || isConflict) return
      adoptSelection(suppliers, options, supplierId, null)
      resetMessages()
    },
    [adoptSelection, isConflict, operations.isPending, options, resetMessages, suppliers]
  )

  const selectOption = React.useCallback(
    (optionId: string) => {
      if (operations.isPending || isConflict) return
      const option = options.find((item) => item.id === optionId)
      if (!option) return
      const supplier = suppliers.find((item) => item.id === option.supplier_id)
      const nextSupplierDraft = supplier
        ? toTechnicalConfigurationSupplierDraft(supplier)
        : createEmptyTechnicalConfigurationSupplierDraft()
      const nextOptionDraft = toTechnicalConfigurationOptionDraft(option)
      setSelectedSupplierId(option.supplier_id)
      setSelectedOptionId(option.id)
      setSupplierDraft(nextSupplierDraft)
      setOptionDraft(nextOptionDraft)
      setSupplierDraftBaseline(nextSupplierDraft)
      setOptionDraftBaseline(nextOptionDraft)
      setSelectedSupplierSnapshot(supplier ?? null)
      setSelectedOptionSnapshot(option)
      setIsCreatingSupplier(false)
      setIsCreatingOption(false)
      resetMessages()
    },
    [isConflict, operations.isPending, options, resetMessages, suppliers]
  )

  const startSupplierCreate = React.useCallback(() => {
    if (operations.isReadOnly || operations.isPending || isConflict) return
    setSelectedSupplierId(null)
    setSelectedOptionId(null)
    const nextSupplierDraft = createEmptyTechnicalConfigurationSupplierDraft()
    const nextOptionDraft = createEmptyTechnicalConfigurationOptionDraft()
    setSupplierDraft(nextSupplierDraft)
    setOptionDraft(nextOptionDraft)
    setSupplierDraftBaseline(nextSupplierDraft)
    setOptionDraftBaseline(nextOptionDraft)
    setSelectedSupplierSnapshot(null)
    setSelectedOptionSnapshot(null)
    setIsCreatingSupplier(true)
    setIsCreatingOption(false)
    resetMessages()
  }, [isConflict, operations.isPending, operations.isReadOnly, resetMessages])

  const startOptionCreate = React.useCallback(
    (supplierId: string) => {
      if (operations.isReadOnly || operations.isPending || isConflict) return
      const supplier = suppliers.find((item) => item.id === supplierId)
      if (!supplier) return
      const nextSupplierDraft = toTechnicalConfigurationSupplierDraft(supplier)
      const nextOptionDraft = createEmptyTechnicalConfigurationOptionDraft(supplierId)
      setSelectedSupplierId(supplierId)
      setSelectedOptionId(null)
      setSupplierDraft(nextSupplierDraft)
      setOptionDraft(nextOptionDraft)
      setSupplierDraftBaseline(nextSupplierDraft)
      setOptionDraftBaseline(nextOptionDraft)
      setSelectedSupplierSnapshot(supplier)
      setSelectedOptionSnapshot(null)
      setIsCreatingSupplier(false)
      setIsCreatingOption(true)
      resetMessages()
    },
    [isConflict, operations.isPending, operations.isReadOnly, resetMessages, suppliers]
  )

  return {
    suppliersQuery,
    optionsQuery,
    suppliers,
    options,
    selectedSupplierId,
    selectedOptionId,
    supplierDraft,
    optionDraft,
    selectedSupplierSnapshot,
    selectedOptionSnapshot,
    isCreatingSupplier,
    isCreatingOption,
    isDirty,
    ...operations,
    isConflict,
    selectSupplier,
    selectOption,
    startSupplierCreate,
    startOptionCreate,
    updateSupplierDraft: (name: string) => {
      if (!operations.isReadOnly && !operations.isPending && !isConflict) {
        setSupplierDraft((current) => ({ ...current, name }))
      }
    },
    updateOptionDraft: (patch: TechnicalConfigurationOptionDraftPatch) => {
      if (!operations.isReadOnly && !operations.isPending && !isConflict) {
        setOptionDraft((current) => ({ ...current, ...patch }))
      }
    },
  }
}
