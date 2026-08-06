"use client"

import * as React from "react"
import { type QueryClient, type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query"

import {
  getTechnicalConfigurationDossier,
  updateTechnicalConfigurationDossier,
} from "../technical-configuration-rpc"
import {
  TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
  technicalConfigurationDossierDetailQueryKey,
} from "../technical-configuration-query-keys"
import type {
  TechnicalConfigurationDossierListWireResponse,
  TechnicalConfigurationDossierUpdateRpcArgs,
  TechnicalConfigurationDossierWire,
  TechnicalConfigurationDossierWireResponse,
} from "../types"

type UseTechnicalConfigurationDossierActionsOptions = {
  listQueryKey: QueryKey
  onSelectedDossierChange: React.Dispatch<
    React.SetStateAction<TechnicalConfigurationDossierWire | null>
  >
}

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

function isStaleRevisionError(error: unknown) {
  return error instanceof Error && error.message === "stale_revision"
}

/** Owns active dossier metadata edit state, mutation, and cache reconciliation. */
export function useTechnicalConfigurationDossierActions({
  listQueryKey,
  onSelectedDossierChange,
}: UseTechnicalConfigurationDossierActionsOptions) {
  const queryClient = useQueryClient()
  const [editTarget, setEditTarget] = React.useState<TechnicalConfigurationDossierWire | null>(null)

  const updateMutation = useMutation({
    mutationFn: updateTechnicalConfigurationDossier,
    onSuccess: async (response) => {
      const updatedDossier = response.data

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
        mergeDossierIntoQueryCaches(queryClient, listQueryKey, response.data)
        onSelectedDossierChange((current) =>
          current?.id === response.data.id ? mergeDossier(current, response.data) : current
        )
        setEditTarget((current) =>
          current?.id === response.data.id ? mergeDossier(current, response.data) : current
        )
      } catch {
        // Keep the original stale-revision error and locally edited form values.
      }
    },
  })

  const openEdit = React.useCallback(
    (dossier: TechnicalConfigurationDossierWire) => {
      updateMutation.reset()
      setEditTarget(dossier)
    },
    [updateMutation]
  )

  const handleEditOpenChange = React.useCallback(
    (open: boolean) => {
      if (open || updateMutation.isPending) {
        return
      }

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

  return {
    editTarget,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.isError ? updateMutation.error : null,
    openEdit,
    handleEditOpenChange,
    submitEdit,
  }
}
