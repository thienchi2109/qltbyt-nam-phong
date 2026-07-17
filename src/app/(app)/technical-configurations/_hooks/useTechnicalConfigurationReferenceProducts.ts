import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import type { TechnicalConfigurationReferenceProductsSnapshot } from "@/app/(app)/technical-configurations/reference-product-types"
import {
  applyTechnicalConfigurationReferenceProductSaveErrorState,
  applyTechnicalConfigurationReferenceProductSaveFailureState,
  canonicalizeTechnicalConfigurationReferenceProductDrafts,
  cloneTechnicalConfigurationReferenceProductDrafts,
  createTechnicalConfigurationReferenceProductsState,
  reconcileTechnicalConfigurationReferenceProductsState,
  toNullableReferenceProductText,
  toTechnicalConfigurationReferenceProductDraft,
  type TechnicalConfigurationReferenceProductDraft,
  type TechnicalConfigurationReferenceProductPatch,
  type TechnicalConfigurationReferenceProductsHookArgs,
  type TechnicalConfigurationReferenceProductsState,
} from "@/app/(app)/technical-configurations/technical-configuration-reference-product-state"
import {
  listAllTechnicalConfigurationReferenceProducts,
  ReferenceProductSaveFailure,
  saveTechnicalConfigurationReferenceProducts,
} from "@/app/(app)/technical-configurations/technical-configuration-reference-product-operations"
import {
  technicalConfigurationBaselineVersionsQueryKey,
  technicalConfigurationReferenceProductsQueryKey,
} from "@/app/(app)/technical-configurations/technical-configuration-query-keys"

export type {
  TechnicalConfigurationReferenceProductDraft,
  TechnicalConfigurationReferenceProductPatch,
} from "@/app/(app)/technical-configurations/technical-configuration-reference-product-state"

/** Owns reference-product retrieval, local drafts, explicit save, and conflict preservation. */
export function useTechnicalConfigurationReferenceProducts({
  baselineVersion,
  isArchived = false,
  onRevisionChange,
  onNavigationBlockedChange,
}: TechnicalConfigurationReferenceProductsHookArgs) {
  const queryClient = useQueryClient()
  const baselineVersionId = baselineVersion?.id ?? ""
  const queryKey = React.useMemo(
    () => technicalConfigurationReferenceProductsQueryKey(baselineVersionId),
    [baselineVersionId]
  )
  const [state, setState] = React.useState<TechnicalConfigurationReferenceProductsState>(() =>
    createTechnicalConfigurationReferenceProductsState(baselineVersion)
  )
  const nextLocalId = React.useRef(0)
  const activeOperationRef = React.useRef<"save" | "reload" | null>(null)
  const productsQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      listAllTechnicalConfigurationReferenceProducts(baselineVersionId, signal),
    enabled: Boolean(baselineVersionId),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const isDirty = React.useMemo(
    () =>
      JSON.stringify(
        canonicalizeTechnicalConfigurationReferenceProductDrafts(state.baseProducts)
      ) !==
      JSON.stringify(canonicalizeTechnicalConfigurationReferenceProductDrafts(state.products)),
    [state.baseProducts, state.products]
  )
  const invalidProductIds = React.useMemo(
    () =>
      state.products.flatMap((product) =>
        !toNullableReferenceProductText(product.model) &&
        !toNullableReferenceProductText(product.manufacturer) &&
        !toNullableReferenceProductText(product.description)
          ? [product.id]
          : []
      ),
    [state.products]
  )
  const isLocked = baselineVersion?.status === "locked"
  const isReadOnly = isLocked || isArchived

  const reconciledState = reconcileTechnicalConfigurationReferenceProductsState({
    state,
    baselineVersion,
    productsQueryData: productsQuery.data,
    isDirty,
  })
  if (reconciledState) {
    setState(reconciledState)
  }

  const addProduct = React.useCallback(() => {
    if (isReadOnly || activeOperationRef.current) return ""
    nextLocalId.current += 1
    const id = `new-reference-product-${nextLocalId.current}`
    setState((current) => ({
      ...current,
      products: [
        ...current.products,
        {
          id,
          persistedId: null,
          model: "",
          manufacturer: "",
          description: "",
          notes: "",
          responses: {},
        },
      ],
      saveStatus: "idle",
      refreshWarning: null,
    }))
    return id
  }, [isReadOnly])

  const updateProduct = React.useCallback(
    (productId: string, patch: TechnicalConfigurationReferenceProductPatch) => {
      if (isReadOnly || activeOperationRef.current) return
      setState((current) => ({
        ...current,
        products: current.products.map((product) =>
          product.id === productId ? { ...product, ...patch } : product
        ),
        saveStatus: "idle",
        refreshWarning: null,
      }))
    },
    [isReadOnly]
  )

  const removeProduct = React.useCallback(
    (productId: string) => {
      if (isReadOnly || activeOperationRef.current) return
      setState((current) => ({
        ...current,
        products: current.products.filter((product) => product.id !== productId),
        saveStatus: "idle",
        refreshWarning: null,
      }))
    },
    [isReadOnly]
  )

  const updateResponse = React.useCallback(
    (productId: string, criterionId: string, responseText: string) => {
      if (isReadOnly || activeOperationRef.current) return
      setState((current) => ({
        ...current,
        products: current.products.map((product) =>
          product.id === productId
            ? {
                ...product,
                responses: {
                  ...product.responses,
                  [criterionId]: responseText,
                },
              }
            : product
        ),
        saveStatus: "idle",
        refreshWarning: null,
      }))
    },
    [isReadOnly]
  )

  const save = React.useCallback(async () => {
    if (
      !baselineVersion ||
      isReadOnly ||
      !isDirty ||
      invalidProductIds.length > 0 ||
      activeOperationRef.current
    ) {
      return
    }

    activeOperationRef.current = "save"
    onNavigationBlockedChange?.(true)
    setState((current) => ({
      ...current,
      isSaving: true,
      isConflict: false,
      saveError: null,
      refreshWarning: null,
      saveStatus: "idle",
    }))

    try {
      const saved = await saveTechnicalConfigurationReferenceProducts({
        baselineVersion,
        baseProducts: state.baseProducts,
        products: state.products,
        revision: state.revision,
      })
      onRevisionChange?.(saved.revision)
      setState((current) => ({
        ...current,
        revision: saved.revision,
        baseProducts: saved.products,
        products: cloneTechnicalConfigurationReferenceProductDrafts(saved.products),
        saveStatus: "saved",
        ignoreProductsQueryData: true,
      }))

      const [productsRefresh, versionsRefresh] = await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey, exact: true }, { throwOnError: true }),
        queryClient.invalidateQueries(
          {
            queryKey: technicalConfigurationBaselineVersionsQueryKey(baselineVersion.dossier_id),
            exact: true,
          },
          { throwOnError: true }
        ),
      ])
      if (productsRefresh.status === "fulfilled") {
        const refreshedProducts =
          queryClient.getQueryData<TechnicalConfigurationReferenceProductsSnapshot>(queryKey)
        if (refreshedProducts) {
          const nextProducts = refreshedProducts.products.map(
            toTechnicalConfigurationReferenceProductDraft
          )
          onRevisionChange?.(refreshedProducts.revision)
          setState((current) => ({
            ...current,
            revision: refreshedProducts.revision,
            baseProducts: nextProducts,
            products: cloneTechnicalConfigurationReferenceProductDrafts(nextProducts),
            ignoreProductsQueryData: false,
            syncedProductsQueryData: refreshedProducts,
          }))
        }
      }
      if (productsRefresh.status === "rejected" || versionsRefresh.status === "rejected") {
        setState((current) => ({
          ...current,
          refreshWarning: "Đã lưu thay đổi nhưng không thể làm mới dữ liệu từ máy chủ.",
        }))
      }
    } catch (error) {
      if (error instanceof ReferenceProductSaveFailure) {
        if (error.progress.revision !== state.revision) {
          onRevisionChange?.(error.progress.revision)
        }
        setState((current) =>
          applyTechnicalConfigurationReferenceProductSaveFailureState({
            state: current,
            progress: error.progress,
            isConflict: error.isConflict,
            originalError: error.originalError,
          })
        )
        return
      }
      setState((current) =>
        applyTechnicalConfigurationReferenceProductSaveErrorState(current, error)
      )
    } finally {
      activeOperationRef.current = null
      setState((current) => ({ ...current, isSaving: false }))
      onNavigationBlockedChange?.(false)
    }
  }, [
    baselineVersion,
    invalidProductIds.length,
    isDirty,
    isReadOnly,
    onNavigationBlockedChange,
    onRevisionChange,
    queryClient,
    queryKey,
    state.baseProducts,
    state.products,
    state.revision,
  ])

  const reload = React.useCallback(
    async (beforeProductsReload?: () => Promise<void>) => {
      if (!baselineVersionId || activeOperationRef.current) return
      activeOperationRef.current = "reload"
      onNavigationBlockedChange?.(true)
      setState((current) => ({
        ...current,
        isReloading: true,
        saveError: null,
        refreshWarning: null,
      }))
      try {
        if (beforeProductsReload) {
          await beforeProductsReload()
        }
        const refreshed = await productsQuery.refetch({ throwOnError: true })
        if (refreshed.data) {
          const nextProducts = refreshed.data.products.map(
            toTechnicalConfigurationReferenceProductDraft
          )
          onRevisionChange?.(refreshed.data.revision)
          setState((current) => ({
            ...current,
            revision: refreshed.data.revision,
            baseProducts: nextProducts,
            products: cloneTechnicalConfigurationReferenceProductDrafts(nextProducts),
            isConflict: false,
            saveStatus: "idle",
            ignoreProductsQueryData: false,
            syncedProductsQueryData: refreshed.data ?? null,
          }))
        } else {
          setState((current) => ({
            ...current,
            isConflict: false,
            saveStatus: "idle",
          }))
        }
      } catch {
        setState((current) => ({
          ...current,
          saveError: "Không thể tải lại sản phẩm tham chiếu.",
        }))
      } finally {
        activeOperationRef.current = null
        setState((current) => ({ ...current, isReloading: false }))
        onNavigationBlockedChange?.(false)
      }
    },
    [baselineVersionId, onNavigationBlockedChange, onRevisionChange, productsQuery]
  )

  return {
    productsQuery,
    products: state.products,
    isDirty,
    isConflict: state.isConflict,
    isLocked,
    isReadOnly,
    isSaving: state.isSaving,
    isReloading: state.isReloading,
    saveStatus: state.saveStatus,
    saveError: state.saveError,
    refreshWarning: state.refreshWarning,
    invalidProductIds,
    addProduct,
    updateProduct,
    removeProduct,
    updateResponse,
    save,
    reload,
  }
}
