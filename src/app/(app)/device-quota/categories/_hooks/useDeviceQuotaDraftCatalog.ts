"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useCallback, useEffect, useMemo, useState } from "react"

import type { DeviceQuotaDraftItem } from "@/lib/device-quota-draft-contract"
import {
  DeviceQuotaDraftError,
  excludeDeviceQuotaDraftItem,
  restoreDeviceQuotaDraftItem,
  saveDeviceQuotaDraft,
} from "../_components/DeviceQuotaDraftCatalogMutations"
import {
  createOrOpenDeviceQuotaDraft,
  deviceQuotaDraftCatalogQueryKey,
  getDeviceQuotaDraft,
} from "../_queries/deviceQuotaDraftCatalogQuery"
import {
  deviceQuotaRegulatoryCatalogQueryKey,
  getDeviceQuotaRegulatoryCatalog,
} from "../_queries/deviceQuotaRegulatoryCatalogQuery"
import {
  getDeviceQuotaDraftCompleteness,
  mergeDeviceQuotaDraftCatalog,
} from "../draft-catalog/device-quota-draft-catalog-mappers"
import type {
  DeviceQuotaDraftEditorMode,
  DeviceQuotaDraftItemPatch,
  DeviceQuotaMergedItemRow,
  DeviceQuotaMergedRow,
} from "../draft-catalog/device-quota-draft-catalog-types"
import {
  type DeviceQuotaDraftCatalogStatus,
  isDeviceQuotaDraftCatalogRoleSupported,
  toDeviceQuotaDraftCatalogUnitId,
} from "./deviceQuotaDraftCatalogAccess"
import {
  getQuantityError,
  mapMutationError,
  mergeStagedItemValues,
  toDraftSaveItem,
  useDeviceQuotaDraftCatalogMutationState,
} from "./deviceQuotaDraftCatalogMutationState"

/** Orchestrates session-scoped draft/catalog queries and CAS-protected mutations. */
export function useDeviceQuotaDraftCatalog(options: { mode?: DeviceQuotaDraftEditorMode } = {}) {
  const mode = options.mode ?? "editable"
  const { data: session, status: sessionStatus } = useSession()
  const user = session?.user
  const userId = user?.id != null ? String(user.id) : null
  const role = typeof user?.role === "string" ? user.role : undefined
  const donViId = toDeviceQuotaDraftCatalogUnitId(user)
  const canAccess =
    sessionStatus === "authenticated" &&
    !!userId &&
    isDeviceQuotaDraftCatalogRoleSupported(role) &&
    donViId != null
  const queryClient = useQueryClient()
  const [localItems, setLocalItems] = useState<DeviceQuotaDraftItem[] | null>(null)
  const [localRevision, setLocalRevision] = useState<number | null>(null)
  const [localDraftId, setLocalDraftId] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const mutationState = useDeviceQuotaDraftCatalogMutationState()

  const openDraftQuery = useQuery({
    queryKey: [...deviceQuotaDraftCatalogQueryKey(donViId, userId), "open"] as const,
    queryFn: createOrOpenDeviceQuotaDraft,
    enabled: canAccess,
    retry: false,
  })
  const draftQuery = useQuery({
    queryKey: [
      ...deviceQuotaDraftCatalogQueryKey(donViId, userId),
      openDraftQuery.data?.id ?? null,
    ] as const,
    queryFn: () => getDeviceQuotaDraft(openDraftQuery.data?.id ?? null),
    enabled: canAccess && !!openDraftQuery.data?.id,
    retry: false,
  })
  const catalogQuery = useQuery({
    queryKey: deviceQuotaRegulatoryCatalogQueryKey(
      donViId,
      userId,
      draftQuery.data?.catalog_version_id ?? null
    ),
    queryFn: getDeviceQuotaRegulatoryCatalog,
    enabled: canAccess && !!draftQuery.data,
    retry: false,
  })

  const serverItems = draftQuery.data?.items ?? []
  useEffect(() => {
    const serverDraft = draftQuery.data
    const shouldInitialize = serverDraft && localDraftId !== serverDraft.id
    const shouldAdvanceFromServer =
      serverDraft && localRevision != null && serverDraft.revision > localRevision

    if (!isDirty && (shouldInitialize || shouldAdvanceFromServer)) {
      setLocalDraftId(serverDraft.id)
      setLocalItems(serverDraft.items)
      setLocalRevision(serverDraft.revision)
    }
  }, [draftQuery.data, isDirty, localDraftId, localRevision])
  const items = localItems ?? serverItems
  const revision = localRevision ?? draftQuery.data?.revision ?? 0

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {}
    for (const item of items) {
      const message = getQuantityError(item)
      if (message) errors[item.source_identifier] = message
    }
    return errors
  }, [items])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draftQuery.data) throw new Error("Draft is not ready")
      if (Object.keys(validationErrors).length > 0) {
        throw new DeviceQuotaDraftError("Dữ liệu số lượng không hợp lệ.", "validation")
      }
      return saveDeviceQuotaDraft({
        draftId: draftQuery.data.id,
        expectedRevision: revision,
        items: items.map(toDraftSaveItem),
      })
    },
    onSuccess: async (result) => {
      setLocalItems(result.items)
      setLocalRevision(result.revision)
      setIsDirty(false)
      mutationState.clearError()
      queryClient.setQueryData(
        [...deviceQuotaDraftCatalogQueryKey(donViId, userId), result.id],
        result
      )
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: deviceQuotaDraftCatalogQueryKey(donViId, userId),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: deviceQuotaRegulatoryCatalogQueryKey(
            donViId,
            userId,
            draftQuery.data?.catalog_version_id ?? null
          ),
          refetchType: "none",
        }),
      ])
    },
    onError: (error) => {
      mutationState.recordError(error, { type: "save" })
    },
  })

  const itemMutation = useMutation({
    mutationFn: async (input: { sourceIdentifier: string; excluded: boolean }) => {
      if (!draftQuery.data) throw new Error("Draft is not ready")
      const item = items.find((candidate) => candidate.source_identifier === input.sourceIdentifier)
      if (!item) throw new Error("Draft item not found")
      const stagedItems = isDirty ? items : null
      const mutationInput = {
        draftId: draftQuery.data.id,
        regulatoryItemId: item.regulatory_item_id,
        expectedRevision: revision,
      }
      const snapshot = input.excluded
        ? await excludeDeviceQuotaDraftItem(mutationInput)
        : await restoreDeviceQuotaDraftItem(mutationInput)
      return { snapshot, stagedItems }
    },
    onSuccess: async ({ snapshot, stagedItems }) => {
      const nextItems = mergeStagedItemValues(snapshot.items, stagedItems)
      setLocalItems(nextItems)
      setLocalRevision(snapshot.revision)
      setIsDirty(stagedItems != null)
      mutationState.clearError()
      queryClient.setQueryData(
        [...deviceQuotaDraftCatalogQueryKey(donViId, userId), snapshot.id],
        snapshot
      )
      await queryClient.invalidateQueries({
        queryKey: deviceQuotaDraftCatalogQueryKey(donViId, userId),
        refetchType: "none",
      })
    },
    onError: (error, variables) => {
      mutationState.recordError(error, { type: "item", ...variables })
    },
  })

  const updateItem = useCallback(
    (sourceIdentifier: string, patch: DeviceQuotaDraftItemPatch) => {
      if (mode !== "editable" || mutationState.isLocked()) return
      setLocalItems((current) =>
        (current ?? items).map((item) =>
          item.source_identifier === sourceIdentifier
            ? {
                ...item,
                ...(patch.displayNameOverride !== undefined
                  ? { display_name_override: patch.displayNameOverride }
                  : {}),
                ...(patch.appliedUnit !== undefined ? { applied_unit: patch.appliedUnit } : {}),
                ...(patch.appliedQuantity !== undefined
                  ? { applied_quantity: patch.appliedQuantity }
                  : {}),
                ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
                ...(patch.isExcluded !== undefined ? { is_excluded: patch.isExcluded } : {}),
                ...(patch.displayOrder !== undefined ? { display_order: patch.displayOrder } : {}),
              }
            : item
        )
      )
      setIsDirty(true)
      mutationState.setLastError(null)
      mutationState.setFailedAction(null)
    },
    [items, mode, mutationState]
  )

  const rows = useMemo(
    () =>
      catalogQuery.data && draftQuery.data
        ? mergeDeviceQuotaDraftCatalog(catalogQuery.data, { items }, mode)
        : [],
    [catalogQuery.data, draftQuery.data, items, mode]
  )

  const save = useCallback(() => {
    if (!mutationState.tryLock()) return Promise.resolve(undefined)
    return saveMutation.mutateAsync().finally(mutationState.unlock)
  }, [mutationState, saveMutation])
  const exclude = useCallback(
    (sourceIdentifier: string) => {
      if (!mutationState.tryLock()) return Promise.resolve(undefined)
      return itemMutation
        .mutateAsync({ sourceIdentifier, excluded: true })
        .finally(mutationState.unlock)
    },
    [itemMutation, mutationState]
  )
  const restore = useCallback(
    (sourceIdentifier: string) => {
      if (!mutationState.tryLock()) return Promise.resolve(undefined)
      return itemMutation
        .mutateAsync({ sourceIdentifier, excluded: false })
        .finally(mutationState.unlock)
    },
    [itemMutation, mutationState]
  )
  const queryError = openDraftQuery.error ?? draftQuery.error ?? catalogQuery.error
  const normalizedQueryError = queryError ? mapMutationError(queryError) : null
  const retry = useCallback(async () => {
    if (mutationState.lastError?.kind === "conflict") {
      const result = await draftQuery.refetch()
      if (result.data) {
        setLocalDraftId(result.data.id)
        setLocalItems(result.data.items)
        setLocalRevision(result.data.revision)
        setIsDirty(false)
        mutationState.clearError()
      }
      return
    }
    if (mutationState.failedAction?.type === "save") {
      await save()
      return
    }
    if (mutationState.failedAction?.type === "item") {
      const { sourceIdentifier, excluded } = mutationState.failedAction
      await (excluded ? exclude(sourceIdentifier) : restore(sourceIdentifier))
      return
    }
    if (openDraftQuery.error) {
      await openDraftQuery.refetch()
      return
    }
    if (draftQuery.error) {
      await draftQuery.refetch()
      return
    }
    if (catalogQuery.error) await catalogQuery.refetch()
  }, [catalogQuery, draftQuery, exclude, mutationState, openDraftQuery, restore, save])

  const status: DeviceQuotaDraftCatalogStatus = !canAccess
    ? "blocked"
    : mutationState.lastError?.kind === "conflict"
      ? "conflict"
      : mutationState.lastError?.kind === "unavailable" ||
          normalizedQueryError?.kind === "unavailable"
        ? "unavailable"
        : queryError || mutationState.lastError
          ? "error"
          : openDraftQuery.isPending ||
              (openDraftQuery.data != null && draftQuery.isPending) ||
              (draftQuery.data != null && catalogQuery.isPending)
            ? "loading"
            : "ready"

  return {
    status,
    rows,
    lastSavedRows:
      catalogQuery.data && draftQuery.data
        ? mergeDeviceQuotaDraftCatalog(catalogQuery.data, { items: serverItems }, mode)
        : ([] as DeviceQuotaMergedRow[]),
    validationErrors,
    errorMessage:
      mutationState.lastError?.message ??
      (normalizedQueryError ? normalizedQueryError.message : null),
    canRetry: !!mutationState.failedAction || !!queryError || !!mutationState.lastError,
    retry,
    canAccess,
    isReadOnly: mode === "readonly",
    donViId,
    revision,
    draftId: draftQuery.data?.id ?? null,
    catalogVersionId: draftQuery.data?.catalog_version_id ?? null,
    metadata:
      catalogQuery.data && draftQuery.data
        ? {
            unitId: donViId,
            draftStatus: draftQuery.data.status,
            documentNumber: catalogQuery.data.document.documentNumber,
            documentVersion: catalogQuery.data.document.documentVersion,
            snapshotMarker: catalogQuery.data.document.sourcePdfSha256,
            lastSavedAt: draftQuery.data.updated_at,
            revision,
            mode,
          }
        : null,
    isSaving: saveMutation.isPending,
    isExcluding: itemMutation.isPending && itemMutation.variables?.excluded === true,
    isRestoring: itemMutation.isPending && itemMutation.variables?.excluded === false,
    updateItem,
    save,
    exclude,
    restore,
    getDeviceQuotaDraftCompleteness,
    isDirty,
    isIncomplete: rows.some(
      (row): row is DeviceQuotaMergedItemRow =>
        row.type === "item" && row.completeness === "incomplete"
    ),
  }
}
