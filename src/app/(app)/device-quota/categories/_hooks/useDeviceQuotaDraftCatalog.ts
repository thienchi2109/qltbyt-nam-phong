"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { isGlobalRole } from "@/lib/rbac"
import type {
  DeviceQuotaDraftItem,
  DeviceQuotaDraftSaveItem,
} from "@/lib/device-quota-draft-contract"
import {
  DeviceQuotaDraftError,
  excludeDeviceQuotaDraftItem,
  normalizeDeviceQuotaDraftError,
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

type DraftStatus = "blocked" | "loading" | "ready" | "conflict" | "error" | "unavailable"

function toSessionUnitId(
  user: { current_don_vi?: number | string | null; don_vi?: number | string | null } | undefined
) {
  const value = user?.current_don_vi ?? user?.don_vi
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function isSupportedRole(role: string | undefined): boolean {
  return isGlobalRole(role) || role?.trim().toLowerCase() === "to_qltb"
}

function toDraftSaveItem(item: DeviceQuotaDraftItem): DeviceQuotaDraftSaveItem {
  return {
    regulatory_item_id: item.regulatory_item_id,
    display_name_override: item.display_name_override,
    applied_unit: item.applied_unit,
    applied_quantity: item.applied_quantity,
    notes: item.notes,
    is_excluded: item.is_excluded,
    display_order: item.display_order,
  }
}

function getQuantityError(item: DeviceQuotaDraftItem): string | null {
  if (item.applied_quantity == null) return null
  if (!Number.isInteger(item.applied_quantity)) return "Số lượng phải là số nguyên."
  if (item.applied_quantity < 0) return "Số lượng không được âm."
  return null
}

function mapMutationError(error: unknown): DeviceQuotaDraftError {
  return error instanceof DeviceQuotaDraftError ? error : normalizeDeviceQuotaDraftError(error)
}

/** Orchestrates session-scoped draft/catalog queries and CAS-protected mutations. */
export function useDeviceQuotaDraftCatalog(options: { mode?: DeviceQuotaDraftEditorMode } = {}) {
  const mode = options.mode ?? "editable"
  const { data: session, status: sessionStatus } = useSession()
  const user = session?.user
  const userId = user?.id != null ? String(user.id) : null
  const role = typeof user?.role === "string" ? user.role : undefined
  const donViId = toSessionUnitId(user)
  const canAccess =
    sessionStatus === "authenticated" && !!userId && isSupportedRole(role) && donViId != null
  const queryClient = useQueryClient()
  const [localItems, setLocalItems] = useState<DeviceQuotaDraftItem[] | null>(null)
  const [localRevision, setLocalRevision] = useState<number | null>(null)
  const [localDraftId, setLocalDraftId] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [lastError, setLastError] = useState<DeviceQuotaDraftError | null>(null)

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
      setLastError(null)
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
    onError: (error) => setLastError(mapMutationError(error)),
  })

  const itemMutation = useMutation({
    mutationFn: async (input: { sourceIdentifier: string; excluded: boolean }) => {
      if (!draftQuery.data) throw new Error("Draft is not ready")
      const item = items.find((candidate) => candidate.source_identifier === input.sourceIdentifier)
      if (!item) throw new Error("Draft item not found")
      const mutationInput = {
        draftId: draftQuery.data.id,
        regulatoryItemId: item.regulatory_item_id,
        expectedRevision: revision,
      }
      return input.excluded
        ? excludeDeviceQuotaDraftItem(mutationInput)
        : restoreDeviceQuotaDraftItem(mutationInput)
    },
    onSuccess: async (result) => {
      setLocalItems(result.items)
      setLocalRevision(result.revision)
      setIsDirty(false)
      setLastError(null)
      queryClient.setQueryData(
        [...deviceQuotaDraftCatalogQueryKey(donViId, userId), result.id],
        result
      )
      await queryClient.invalidateQueries({
        queryKey: deviceQuotaDraftCatalogQueryKey(donViId, userId),
        refetchType: "none",
      })
    },
    onError: (error) => setLastError(mapMutationError(error)),
  })

  const updateItem = useCallback(
    (sourceIdentifier: string, patch: DeviceQuotaDraftItemPatch) => {
      if (mode !== "editable") return
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
      setLastError(null)
    },
    [items, mode]
  )

  const rows = useMemo(
    () =>
      catalogQuery.data && draftQuery.data
        ? mergeDeviceQuotaDraftCatalog(catalogQuery.data, { items }, mode)
        : [],
    [catalogQuery.data, draftQuery.data, items, mode]
  )

  const save = useCallback(() => saveMutation.mutateAsync(), [saveMutation])
  const exclude = useCallback(
    (sourceIdentifier: string) => itemMutation.mutateAsync({ sourceIdentifier, excluded: true }),
    [itemMutation]
  )
  const restore = useCallback(
    (sourceIdentifier: string) => itemMutation.mutateAsync({ sourceIdentifier, excluded: false }),
    [itemMutation]
  )

  const status: DraftStatus = !canAccess
    ? "blocked"
    : openDraftQuery.isPending || draftQuery.isPending || catalogQuery.isPending
      ? "loading"
      : lastError?.kind === "conflict"
        ? "conflict"
        : lastError?.kind === "unavailable"
          ? "unavailable"
          : draftQuery.error || catalogQuery.error || lastError
            ? "error"
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
      lastError?.message ??
      (openDraftQuery.error ? mapMutationError(openDraftQuery.error).message : null) ??
      (draftQuery.error ? mapMutationError(draftQuery.error).message : null) ??
      (catalogQuery.error ? mapMutationError(catalogQuery.error).message : null),
    canRetry: !!lastError,
    canAccess,
    isReadOnly: mode === "readonly",
    donViId,
    revision,
    draftId: draftQuery.data?.id ?? null,
    catalogVersionId: draftQuery.data?.catalog_version_id ?? null,
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
