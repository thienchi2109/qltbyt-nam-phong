import * as React from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import { TechnicalConfigurationReferenceComparison } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceComparison"
import { TechnicalConfigurationReferenceProductEditor } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceProductEditor"
import { TechnicalConfigurationReferenceProductNavigator } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceProductNavigator"
import type { useTechnicalConfigurationReferenceProducts } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationReferenceProducts"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import type { TechnicalConfigurationReferenceProductDraft } from "@/app/(app)/technical-configurations/technical-configuration-reference-product-state"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type TechnicalConfigurationReferenceProductsBodyProps = {
  baselineVersion: TechnicalConfigurationBaselineDraftWire
  referenceState: ReturnType<typeof useTechnicalConfigurationReferenceProducts>
  navigationBlocked: boolean
  searchScopeKey: string
  selectedProductId: string | null
  onSelectProduct: (productId: string) => void
  onRevisionChange?: (revision: number) => void
  onEvidenceDirtyChange?: (dirty: boolean) => void
  onEvidenceNavigationBlockedChange?: (blocked: boolean) => void
}

type ReferenceProductSearchState = {
  scopeKey: string
  query: string
}

function filterReferenceProducts(
  products: TechnicalConfigurationReferenceProductDraft[],
  query: string
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("vi-VN")
  if (!normalizedQuery) return products
  return products.filter((product) =>
    `${product.model}\n${product.manufacturer}`.toLocaleLowerCase("vi-VN").includes(normalizedQuery)
  )
}

/** Renders reference-product query states, metadata editors, and comparison matrix. */
export function TechnicalConfigurationReferenceProductsBody({
  baselineVersion,
  referenceState,
  navigationBlocked,
  searchScopeKey,
  selectedProductId,
  onSelectProduct,
  onRevisionChange,
  onEvidenceDirtyChange,
  onEvidenceNavigationBlockedChange,
}: Readonly<TechnicalConfigurationReferenceProductsBodyProps>) {
  const [searchState, setSearchState] = React.useState<ReferenceProductSearchState>({
    scopeKey: searchScopeKey,
    query: "",
  })
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const searchAnchorProductIdRef = React.useRef<string | null>(null)
  const productButtonRefs = React.useRef(new Map<string, HTMLButtonElement>())
  const pendingFocusTargetRef = React.useRef<
    { kind: "product"; productId: string } | { kind: "search" } | null
  >(null)
  const searchQuery = searchState.scopeKey === searchScopeKey ? searchState.query : ""
  const invalidProductIdSet = React.useMemo(
    () => new Set(referenceState.invalidProductIds),
    [referenceState.invalidProductIds]
  )
  const visibleProducts = React.useMemo(
    () => filterReferenceProducts(referenceState.products, searchQuery),
    [referenceState.products, searchQuery]
  )
  const activeProduct =
    referenceState.products.find((product) => product.id === selectedProductId) ?? null
  const activeProductIndex = activeProduct
    ? referenceState.products.findIndex((product) => product.id === activeProduct.id)
    : -1
  const hasInitialQueryError =
    referenceState.productsQuery.isError && referenceState.productsQuery.data === undefined
  const canRenderProducts = !referenceState.productsQuery.isLoading && !hasInitialQueryError
  const hasSearchQuery = Boolean(searchQuery.trim())
  const productCountLabel = hasSearchQuery
    ? `${visibleProducts.length}/${referenceState.products.length} sản phẩm`
    : `${referenceState.products.length} sản phẩm`

  const handleSearchChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const query = event.target.value
      const nextVisibleProducts = filterReferenceProducts(referenceState.products, query)
      if (!searchQuery && query) {
        searchAnchorProductIdRef.current = selectedProductId
      }
      const searchAnchorProductId = searchAnchorProductIdRef.current
      if (!query) {
        searchAnchorProductIdRef.current = null
      }
      setSearchState({ scopeKey: searchScopeKey, query })
      if (nextVisibleProducts.length === 0) {
        if (searchAnchorProductId && searchAnchorProductId !== selectedProductId) {
          onSelectProduct(searchAnchorProductId)
        }
      } else if (!nextVisibleProducts.some((product) => product.id === selectedProductId)) {
        onSelectProduct(nextVisibleProducts[0]!.id)
      }
    },
    [onSelectProduct, referenceState.products, searchQuery, searchScopeKey, selectedProductId]
  )

  const handleSelectProduct = React.useCallback(
    (productId: string) => {
      if (searchQuery) {
        searchAnchorProductIdRef.current = productId
      }
      onSelectProduct(productId)
    },
    [onSelectProduct, searchQuery]
  )

  const handleRemoveProduct = React.useCallback(
    (productId: string) => {
      const visibleProductIndex = visibleProducts.findIndex((product) => product.id === productId)
      const remainingVisibleProducts = visibleProducts.filter((product) => product.id !== productId)
      let nextProduct =
        remainingVisibleProducts[
          Math.min(Math.max(visibleProductIndex, 0), remainingVisibleProducts.length - 1)
        ] ?? null
      let shouldClearSearch = false

      if (!nextProduct) {
        const productIndex = referenceState.products.findIndex(
          (product) => product.id === productId
        )
        const remainingProducts = referenceState.products.filter(
          (product) => product.id !== productId
        )
        nextProduct =
          remainingProducts[Math.min(Math.max(productIndex, 0), remainingProducts.length - 1)] ??
          null
        shouldClearSearch = Boolean(nextProduct && searchQuery)
      }

      pendingFocusTargetRef.current = nextProduct
        ? { kind: "product", productId: nextProduct.id }
        : { kind: "search" }
      if (shouldClearSearch) {
        searchAnchorProductIdRef.current = null
        setSearchState({ scopeKey: searchScopeKey, query: "" })
      }
      referenceState.removeProduct(productId)
      if (nextProduct) {
        handleSelectProduct(nextProduct.id)
      }
    },
    [handleSelectProduct, referenceState, searchQuery, searchScopeKey, visibleProducts]
  )

  React.useEffect(() => {
    const target = pendingFocusTargetRef.current
    if (!target) return

    const element =
      target.kind === "search"
        ? searchInputRef.current
        : productButtonRefs.current.get(target.productId)
    pendingFocusTargetRef.current = null
    element?.focus()
  }, [referenceState.products, searchQuery, selectedProductId])

  const handleProductButtonRef = React.useCallback(
    (productId: string, element: HTMLButtonElement | null) => {
      if (element) {
        productButtonRefs.current.set(productId, element)
      } else {
        productButtonRefs.current.delete(productId)
      }
    },
    []
  )

  return (
    <>
      {referenceState.productsQuery.isLoading ? (
        <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Đang tải sản phẩm tham chiếu...
        </div>
      ) : null}

      {hasInitialQueryError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>Không thể tải sản phẩm tham chiếu</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>Vui lòng thử lại.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void referenceState.productsQuery.refetch()
              }}
            >
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {canRenderProducts ? (
        <section
          className="grid min-h-0 overflow-hidden rounded-md border bg-background lg:h-[clamp(24rem,50vh,28rem)] lg:grid-cols-[20rem_minmax(0,1fr)]"
          aria-label="Không gian chỉnh sửa sản phẩm tham chiếu"
        >
          <TechnicalConfigurationReferenceProductNavigator
            workspace={{
              products: referenceState.products,
              visibleProducts,
              invalidProductIds: invalidProductIdSet,
              selectedProductId,
              searchQuery,
              productCountLabel,
              navigationBlocked,
            }}
            searchInputRef={searchInputRef}
            onSearchChange={handleSearchChange}
            onSelectProduct={handleSelectProduct}
            onProductButtonRef={handleProductButtonRef}
          />

          <div className="min-h-0 overflow-y-auto">
            {activeProduct ? (
              <TechnicalConfigurationReferenceProductEditor
                product={activeProduct}
                index={activeProductIndex}
                invalid={invalidProductIdSet.has(activeProduct.id)}
                readOnly={referenceState.isReadOnly}
                navigationBlocked={navigationBlocked}
                onUpdate={referenceState.updateProduct}
                onRemove={handleRemoveProduct}
              />
            ) : (
              <div className="flex min-h-64 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                {referenceState.products.length === 0
                  ? "Thêm sản phẩm tham chiếu để bắt đầu."
                  : "Chọn một sản phẩm để xem chi tiết."}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {canRenderProducts ? (
        <TechnicalConfigurationReferenceComparison
          baselineVersion={baselineVersion}
          products={referenceState.products}
          readOnly={referenceState.isReadOnly || navigationBlocked}
          onResponseChange={referenceState.updateResponse}
          onRevisionChange={onRevisionChange}
          onEvidenceDirtyChange={onEvidenceDirtyChange}
          onEvidenceNavigationBlockedChange={onEvidenceNavigationBlockedChange}
        />
      ) : null}
    </>
  )
}
