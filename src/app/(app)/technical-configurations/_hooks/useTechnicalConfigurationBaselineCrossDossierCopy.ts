"use client"

import * as React from "react"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import type { TechnicalConfigurationBaselineDraftWire } from "../baseline-types"
import {
  applyTechnicalConfigurationBaselineCrossDossierCopy,
  listTechnicalConfigurationBaselineCrossDossierSources,
  previewTechnicalConfigurationBaselineCrossDossierCopy,
} from "../technical-configuration-baseline-cross-dossier-rpc"
import type {
  TechnicalConfigurationBaselineCrossDossierCopyApplyWire,
  TechnicalConfigurationBaselineCrossDossierCopyPreviewRpcArgs,
  TechnicalConfigurationBaselineCrossDossierCopyPreviewWire,
} from "../technical-configuration-baseline-cross-dossier-types"
import { technicalConfigurationDossierDetailQueryKey } from "../technical-configuration-query-keys"
import type {
  TechnicalConfigurationDossierWire,
  TechnicalConfigurationDossierWireResponse,
} from "../types"

const SOURCE_PAGE_SIZE = 20

type TechnicalConfigurationBaselineCrossDossierTargetState = {
  dossierRevision: number
  targetDraft: TechnicalConfigurationBaselineDraftWire | null
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Không thể hoàn tất thao tác sao chép."
}

function requiresFreshPreview(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "stale_preview" || error.message === "concurrent_write_retry")
  )
}

function requiresTargetStateRefresh(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "stale_revision" || error.message === "target_draft_changed")
  )
}

/** Coordinates bounded source search, authoritative preview, and atomic cross-dossier apply. */
export function useTechnicalConfigurationBaselineCrossDossierCopy({
  dossier,
  dossierRevision,
  targetDraft,
  onApplied,
  onTargetStateStale = () => ({ dossierRevision, targetDraft }),
}: {
  dossier: TechnicalConfigurationDossierWire
  dossierRevision: number
  targetDraft: TechnicalConfigurationBaselineDraftWire | null
  onApplied: (
    result: TechnicalConfigurationBaselineCrossDossierCopyApplyWire
  ) => Promise<void> | void
  onTargetStateStale?: () =>
    | Promise<TechnicalConfigurationBaselineCrossDossierTargetState>
    | TechnicalConfigurationBaselineCrossDossierTargetState
}) {
  const queryClient = useQueryClient()
  const previewRequestIdRef = React.useRef(0)
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [selectedSourceId, setSelectedSourceId] = React.useState<string | null>(null)
  const [preview, setPreview] =
    React.useState<TechnicalConfigurationBaselineCrossDossierCopyPreviewWire | null>(null)
  const [replacementConfirmed, setReplacementConfirmed] = React.useState(false)
  const [operationError, setOperationError] = React.useState<string | null>(null)
  const normalizedSearch = search.trim()
  const sourceQueryKey = React.useMemo(
    () => [
      "technical-configurations",
      "baseline-cross-dossier-sources",
      dossier.id,
      normalizedSearch,
    ],
    [dossier.id, normalizedSearch]
  )
  const sourcesQuery = useInfiniteQuery({
    queryKey: sourceQueryKey,
    enabled: open,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      listTechnicalConfigurationBaselineCrossDossierSources(
        {
          p_target_dossier_id: dossier.id,
          p_search: normalizedSearch || null,
          p_page: pageParam,
          p_page_size: SOURCE_PAGE_SIZE,
        },
        signal
      ),
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.page_size < lastPage.total ? lastPage.page + 1 : undefined,
  })

  const previewArgs = React.useCallback(
    (
      sourceBaselineVersionId: string,
      targetState: TechnicalConfigurationBaselineCrossDossierTargetState = {
        dossierRevision,
        targetDraft,
      }
    ): TechnicalConfigurationBaselineCrossDossierCopyPreviewRpcArgs => ({
      p_source_baseline_version_id: sourceBaselineVersionId,
      p_target_dossier_id: dossier.id,
      p_expected_dossier_revision: targetState.dossierRevision,
      p_expected_target_baseline_version_id: targetState.targetDraft?.id ?? null,
      p_expected_target_baseline_revision: targetState.targetDraft?.revision ?? null,
    }),
    [dossier.id, dossierRevision, targetDraft?.id, targetDraft?.revision]
  )
  const previewMutation = useMutation({
    mutationFn: previewTechnicalConfigurationBaselineCrossDossierCopy,
  })
  const refreshPreview = React.useCallback(
    async (
      sourceBaselineVersionId: string,
      targetState?: TechnicalConfigurationBaselineCrossDossierTargetState
    ) => {
      const requestId = ++previewRequestIdRef.current
      let response
      try {
        response = await previewMutation.mutateAsync(
          previewArgs(sourceBaselineVersionId, targetState)
        )
      } catch (error) {
        if (requestId !== previewRequestIdRef.current) return null
        throw error
      }
      if (requestId !== previewRequestIdRef.current) return null
      setPreview(response.data)
      setReplacementConfirmed(false)
      setOperationError(null)
      return response.data
    },
    [previewArgs, previewMutation]
  )
  const applyMutation = useMutation({
    mutationFn: applyTechnicalConfigurationBaselineCrossDossierCopy,
  })

  const closeDialog = React.useCallback(() => {
    previewRequestIdRef.current += 1
    setOpen(false)
    setSearch("")
    setSelectedSourceId(null)
    setPreview(null)
    setReplacementConfirmed(false)
    setOperationError(null)
    previewMutation.reset()
    applyMutation.reset()
  }, [applyMutation, previewMutation])
  const openDialog = React.useCallback(() => setOpen(true), [])
  const updateSearch = React.useCallback((value: string) => {
    previewRequestIdRef.current += 1
    setSearch(value)
    setSelectedSourceId(null)
    setPreview(null)
    setReplacementConfirmed(false)
    setOperationError(null)
  }, [])

  const selectSource = React.useCallback(
    async (sourceBaselineVersionId: string) => {
      setSelectedSourceId(sourceBaselineVersionId)
      setPreview(null)
      setReplacementConfirmed(false)
      setOperationError(null)
      try {
        await refreshPreview(sourceBaselineVersionId)
      } catch (error) {
        setOperationError(getErrorMessage(error))
      }
    },
    [refreshPreview]
  )

  const apply = React.useCallback(async () => {
    if (!preview || !selectedSourceId) return
    try {
      const response = await applyMutation.mutateAsync({
        ...previewArgs(selectedSourceId),
        p_preview_fingerprint: preview.preview_fingerprint,
        p_confirm_replace: replacementConfirmed,
      })
      queryClient.setQueryData<TechnicalConfigurationDossierWireResponse>(
        technicalConfigurationDossierDetailQueryKey(dossier.id),
        (current) =>
          current
            ? {
                data: {
                  ...current.data,
                  revision: response.data.target_dossier_revision,
                },
              }
            : current
      )
      closeDialog()
      await Promise.allSettled([
        queryClient.invalidateQueries({
          queryKey: ["technical-configurations"],
        }),
        Promise.resolve(onApplied(response.data)),
      ])
    } catch (error) {
      if (requiresTargetStateRefresh(error)) {
        previewRequestIdRef.current += 1
        setReplacementConfirmed(false)
        setPreview(null)
        try {
          const refreshedTargetState = await onTargetStateStale()
          await refreshPreview(selectedSourceId, refreshedTargetState)
          setOperationError(
            "Trạng thái hồ sơ đích đã thay đổi. Hệ thống đã tải bản xem trước mới; vui lòng kiểm tra lại."
          )
        } catch (refreshError) {
          setOperationError(getErrorMessage(refreshError))
        }
        return
      }
      if (requiresFreshPreview(error)) {
        setReplacementConfirmed(false)
        setPreview(null)
        try {
          await refreshPreview(selectedSourceId)
          setOperationError(
            "Dữ liệu đã thay đổi. Hệ thống đã tải bản xem trước mới; vui lòng kiểm tra lại."
          )
        } catch (previewError) {
          setOperationError(getErrorMessage(previewError))
        }
        return
      }
      setOperationError(getErrorMessage(error))
    }
  }, [
    applyMutation,
    closeDialog,
    dossier.id,
    onApplied,
    onTargetStateStale,
    preview,
    previewArgs,
    queryClient,
    refreshPreview,
    replacementConfirmed,
    selectedSourceId,
  ])

  const sources = sourcesQuery.data?.pages.flatMap((page) => page.data) ?? []

  return {
    open,
    openDialog,
    closeDialog,
    search,
    setSearch: updateSearch,
    sources,
    total: sourcesQuery.data?.pages[0]?.total ?? 0,
    isSourcesLoading: sourcesQuery.isLoading,
    isLoadingMoreSources: sourcesQuery.isFetchingNextPage,
    hasMoreSources: Boolean(sourcesQuery.hasNextPage),
    loadMoreSources: () => sourcesQuery.fetchNextPage(),
    sourcesError: sourcesQuery.isError ? getErrorMessage(sourcesQuery.error) : null,
    selectedSourceId,
    selectSource,
    preview,
    isPreviewing: previewMutation.isPending,
    replacementConfirmed,
    setReplacementConfirmed,
    operationError,
    isApplying: applyMutation.isPending,
    canApply:
      Boolean(preview) &&
      (!preview?.requires_replacement_confirmation || replacementConfirmed) &&
      !applyMutation.isPending,
    apply,
  }
}

export type UseTechnicalConfigurationBaselineCrossDossierCopyResult = ReturnType<
  typeof useTechnicalConfigurationBaselineCrossDossierCopy
>
