"use client"

import * as React from "react"
import { type QueryClient, type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query"

import {
  deleteTechnicalConfigurationDossier,
  getTechnicalConfigurationDossier,
  updateTechnicalConfigurationDossier,
} from "../technical-configuration-rpc"
import {
  TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
  technicalConfigurationDossierDetailQueryKey,
} from "../technical-configuration-query-keys"
import type {
  TechnicalConfigurationDossierListItemWire,
  TechnicalConfigurationDossierListWireResponse,
  TechnicalConfigurationDossierUpdateRpcArgs,
  TechnicalConfigurationDossierWire,
  TechnicalConfigurationDossierWireResponse,
} from "../types"

type UseTechnicalConfigurationDossierActionsOptions = {
  listQueryKey: QueryKey
  page: number
  onPageChange: (page: number) => void
  onSelectedDossierChange: React.Dispatch<
    React.SetStateAction<TechnicalConfigurationDossierWire | null>
  >
}

const STALE_REVISION_ERROR_CODE = "stale_revision"
const STALE_REVISION_REFRESH_ERROR_CODE = "stale_revision_refresh_failed"

function mergeDossier<T extends TechnicalConfigurationDossierWire>(
  current: T,
  updated: TechnicalConfigurationDossierWire
): T {
  return { ...current, ...updated }
}

function mergeDossierIntoQueryCaches(
  queryClient: QueryClient,
  listQueryKey: QueryKey,
  updatedDossier: TechnicalConfigurationDossierWire
) {
  queryClient.setQueryData<TechnicalConfigurationDossierListWireResponse>(
    listQueryKey,
    (current) =>
      current
        ? {
            ...current,
            data: current.data.map((dossier) =>
              dossier.id === updatedDossier.id ? mergeDossier(dossier, updatedDossier) : dossier
            ),
          }
        : current
  )
  queryClient.setQueryData<TechnicalConfigurationDossierWireResponse>(
    technicalConfigurationDossierDetailQueryKey(updatedDossier.id),
    (current) => ({
      ...(current ?? {}),
      data: current ? mergeDossier(current.data, updatedDossier) : updatedDossier,
    })
  )
}

/** Identifies the optimistic-concurrency error returned by the dossier update RPC. */
export function isStaleRevisionError(error: unknown) {
  return error instanceof Error && error.message === STALE_REVISION_ERROR_CODE
}

/** Identifies a failed refresh while recovering from a stale dossier revision. */
export function isStaleRevisionRefreshError(error: unknown) {
  return error instanceof Error && error.message === STALE_REVISION_REFRESH_ERROR_CODE
}

/** Owns dossier metadata edit/delete state, mutations, and cache reconciliation. */
export function useTechnicalConfigurationDossierActions({
  listQueryKey,
  page,
  onPageChange,
  onSelectedDossierChange,
}: UseTechnicalConfigurationDossierActionsOptions) {
  const queryClient = useQueryClient()
  const deleteInFlightRef = React.useRef(false)
  const [editTarget, setEditTarget] = React.useState<TechnicalConfigurationDossierWire | null>(null)
  const [deleteTarget, setDeleteTarget] =
    React.useState<TechnicalConfigurationDossierListItemWire | null>(null)
  const [updateErrorOverride, setUpdateErrorOverride] = React.useState<Error | null>(null)

  const updateMutation = useMutation({
    mutationFn: updateTechnicalConfigurationDossier,
    onMutate: () => {
      setUpdateErrorOverride(null)
    },
    onSuccess: async (response) => {
      const updatedDossier = response.data

      setUpdateErrorOverride(null)
      mergeDossierIntoQueryCaches(queryClient, listQueryKey, updatedDossier)
      onSelectedDossierChange((current) =>
        current?.id === updatedDossier.id ? mergeDossier(current, updatedDossier) : current
      )
      setEditTarget(null)

      await queryClient.invalidateQueries({
        queryKey: TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
      })
    },
    onError: async (error, args) => {
      if (!isStaleRevisionError(error)) {
        return
      }

      try {
        const response = await getTechnicalConfigurationDossier(args.p_id)
        const retryTarget = {
          ...response.data,
          device_type_name: args.p_device_type_name,
          name: args.p_name,
          description: args.p_description,
        }
        mergeDossierIntoQueryCaches(queryClient, listQueryKey, response.data)
        onSelectedDossierChange((current) =>
          current?.id === response.data.id ? mergeDossier(current, response.data) : current
        )
        setEditTarget((current) =>
          current?.id === response.data.id ? mergeDossier(current, retryTarget) : current
        )
      } catch {
        setUpdateErrorOverride(new Error(STALE_REVISION_REFRESH_ERROR_CODE))
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTechnicalConfigurationDossier,
    onSuccess: async (response) => {
      const deletedId = response.data.id
      let shouldMoveToPreviousPage = false

      queryClient.setQueryData<TechnicalConfigurationDossierListWireResponse>(
        listQueryKey,
        (current) => {
          if (!current) return current

          const data = current.data.filter((dossier) => dossier.id !== deletedId)
          if (data.length === current.data.length) return current

          shouldMoveToPreviousPage = page > 1 && data.length === 0

          return {
            ...current,
            data,
            total: Math.max(0, current.total - 1),
          }
        }
      )
      queryClient.removeQueries({
        queryKey: technicalConfigurationDossierDetailQueryKey(deletedId),
        exact: true,
      })
      onSelectedDossierChange((current) => (current?.id === deletedId ? null : current))
      setDeleteTarget((current) => (current?.id === deletedId ? null : current))

      if (shouldMoveToPreviousPage) {
        onPageChange(page - 1)
      }

      await queryClient.invalidateQueries({
        queryKey: TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
        // The page change activates and refetches the previous key; do not refetch the obsolete page.
        refetchType: shouldMoveToPreviousPage ? "none" : "active",
      })
    },
  })

  const openEdit = React.useCallback(
    (dossier: TechnicalConfigurationDossierWire) => {
      updateMutation.reset()
      setUpdateErrorOverride(null)
      setEditTarget(dossier)
    },
    [updateMutation]
  )

  const openDelete = React.useCallback(
    (dossier: TechnicalConfigurationDossierListItemWire) => {
      if (!dossier.can_delete || deleteInFlightRef.current || deleteMutation.isPending) return

      deleteMutation.reset()
      setDeleteTarget(dossier)
    },
    [deleteMutation]
  )

  const handleEditOpenChange = React.useCallback(
    (open: boolean) => {
      if (open || updateMutation.isPending) {
        return
      }

      setUpdateErrorOverride(null)
      setEditTarget(null)
    },
    [updateMutation.isPending]
  )

  const submitEdit = React.useCallback(
    async (args: TechnicalConfigurationDossierUpdateRpcArgs) => {
      await updateMutation.mutateAsync(args)
    },
    [updateMutation]
  )

  const handleDeleteOpenChange = React.useCallback(
    (open: boolean) => {
      if (open || deleteInFlightRef.current || deleteMutation.isPending) return

      deleteMutation.reset()
      setDeleteTarget(null)
    },
    [deleteMutation]
  )

  const submitDelete = React.useCallback(async () => {
    if (!deleteTarget || deleteInFlightRef.current || deleteMutation.isPending) return

    deleteInFlightRef.current = true
    try {
      await deleteMutation.mutateAsync({
        p_id: deleteTarget.id,
        p_expected_revision: deleteTarget.revision,
      })
    } finally {
      deleteInFlightRef.current = false
    }
  }, [deleteMutation, deleteTarget])

  return {
    deleteError: deleteMutation.isError ? deleteMutation.error : null,
    deleteTarget,
    editTarget,
    isDeleting: deleteMutation.isPending,
    isUpdating: updateMutation.isPending,
    openDelete,
    updateError: updateErrorOverride ?? (updateMutation.isError ? updateMutation.error : null),
    openEdit,
    handleDeleteOpenChange,
    handleEditOpenChange,
    submitDelete,
    submitEdit,
  }
}
