import * as React from "react"
import { AlertCircle, Search } from "lucide-react"

import {
  getTechnicalConfigurationReferenceProductName,
  type TechnicalConfigurationReferenceProductDraft,
} from "@/app/(app)/technical-configurations/technical-configuration-reference-product-state"
import { Input } from "@/components/ui/input"

type ReferenceProductNavigatorWorkspace = {
  products: TechnicalConfigurationReferenceProductDraft[]
  visibleProducts: TechnicalConfigurationReferenceProductDraft[]
  invalidProductIds: ReadonlySet<string>
  selectedProductId: string | null
  searchQuery: string
  productCountLabel: string
  navigationBlocked: boolean
}

type TechnicalConfigurationReferenceProductNavigatorProps = {
  workspace: ReferenceProductNavigatorWorkspace
  searchInputRef: React.RefObject<HTMLInputElement | null>
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onSelectProduct: (productId: string) => void
  onProductButtonRef: (productId: string, element: HTMLButtonElement | null) => void
}

type NavigatorProductMetadata = {
  index: number
  name: string
  manufacturer: string
  accessibleDescription: string
}

function getReferenceProductNavigatorName(
  product: TechnicalConfigurationReferenceProductDraft,
  index: number
) {
  const hasProductName = Boolean(
    product.model.trim() || product.manufacturer.trim() || product.description.trim()
  )
  if (!product.persistedId && !hasProductName) return `Sản phẩm mới ${index + 1}`
  return getTechnicalConfigurationReferenceProductName(product, index)
}

/** Renders the searchable reference-product list and its selection states. */
export function TechnicalConfigurationReferenceProductNavigator({
  workspace,
  searchInputRef,
  onSearchChange,
  onSelectProduct,
  onProductButtonRef,
}: Readonly<TechnicalConfigurationReferenceProductNavigatorProps>) {
  const {
    products,
    visibleProducts,
    invalidProductIds,
    selectedProductId,
    searchQuery,
    productCountLabel,
    navigationBlocked,
  } = workspace
  const metadataById = React.useMemo(() => {
    const nextMetadataById = new Map<string, NavigatorProductMetadata>()
    const descriptionCounts = new Map<string, number>()

    products.forEach((product, index) => {
      const name = getReferenceProductNavigatorName(product, index)
      const manufacturer = product.manufacturer.trim()
      const accessibleDescription = manufacturer ? `${name}, ${manufacturer}` : name
      nextMetadataById.set(product.id, {
        index,
        name,
        manufacturer,
        accessibleDescription,
      })
      descriptionCounts.set(
        accessibleDescription,
        (descriptionCounts.get(accessibleDescription) ?? 0) + 1
      )
    })

    const usedAccessibleDescriptions = new Set<string>()
    products.forEach((product) => {
      const metadata = nextMetadataById.get(product.id)
      if (!metadata) return

      const preferredDescription =
        (descriptionCounts.get(metadata.accessibleDescription) ?? 0) > 1
          ? `${metadata.accessibleDescription}, sản phẩm ${metadata.index + 1}`
          : metadata.accessibleDescription
      let uniqueDescription = preferredDescription
      let collisionOrdinal = metadata.index + 1
      while (usedAccessibleDescriptions.has(uniqueDescription)) {
        uniqueDescription = `${preferredDescription}, mục ${collisionOrdinal}`
        collisionOrdinal += 1
      }
      usedAccessibleDescriptions.add(uniqueDescription)
      nextMetadataById.set(product.id, {
        ...metadata,
        accessibleDescription: uniqueDescription,
      })
    })

    return nextMetadataById
  }, [products])

  return (
    <div className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r">
      <div className="shrink-0 space-y-3 border-b p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Sản phẩm tham chiếu</h3>
          <span className="text-xs text-muted-foreground">{productCountLabel}</span>
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            aria-label="Tìm sản phẩm tham chiếu"
            placeholder="Tìm model hoặc hãng"
            className="pl-9"
            disabled={navigationBlocked}
            onChange={onSearchChange}
          />
        </div>
      </div>

      <div className="max-h-56 min-h-0 flex-1 overflow-y-auto lg:max-h-none">
        {products.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Danh sách chưa có sản phẩm.</p>
        ) : visibleProducts.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Không tìm thấy sản phẩm phù hợp.</p>
        ) : (
          <div className="divide-y">
            {visibleProducts.map((product) => {
              const metadata = metadataById.get(product.id)
              if (!metadata) return null

              const selected = product.id === selectedProductId
              const invalid = invalidProductIds.has(product.id)
              const accessibleName = `Chọn ${metadata.accessibleDescription}${
                invalid ? ", thiếu thông tin" : ""
              }`

              return (
                <button
                  key={product.id}
                  ref={(element) => onProductButtonRef(product.id, element)}
                  type="button"
                  aria-label={accessibleName}
                  aria-current={selected ? "true" : undefined}
                  disabled={navigationBlocked}
                  className="flex min-h-16 w-full items-center gap-3 border-l-2 border-transparent px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 aria-current:border-primary aria-current:bg-primary/10"
                  onClick={() => onSelectProduct(product.id)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{metadata.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {metadata.manufacturer || "Chưa có hãng sản xuất"}
                    </span>
                    {invalid ? (
                      <span className="mt-1 flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="size-3" aria-hidden="true" />
                        Thiếu thông tin
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
