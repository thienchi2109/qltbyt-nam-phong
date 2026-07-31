import * as React from "react"

import type { TechnicalConfigurationReferenceProductDraft } from "@/app/(app)/technical-configurations/technical-configuration-reference-product-state"

type ReferenceProductSelectionState = {
  scopeKey: string
  productId: string | null
  fallbackIndex: number
}

type UseTechnicalConfigurationReferenceProductSelectionArgs = {
  scopeKey: string
  products: TechnicalConfigurationReferenceProductDraft[]
}

/** Keeps one reference product selected across local edits, deletes, reloads, and saved ID swaps. */
export function useTechnicalConfigurationReferenceProductSelection({
  scopeKey,
  products,
}: UseTechnicalConfigurationReferenceProductSelectionArgs) {
  const [selection, setSelection] = React.useState<ReferenceProductSelectionState>({
    scopeKey,
    productId: null,
    fallbackIndex: 0,
  })
  React.useEffect(() => {
    setSelection((currentSelection) =>
      currentSelection.scopeKey === scopeKey
        ? currentSelection
        : {
            scopeKey,
            productId: null,
            fallbackIndex: 0,
          }
    )
  }, [scopeKey])

  const isCurrentScope = selection.scopeKey === scopeKey
  const preferredProductId = isCurrentScope ? selection.productId : null
  const fallbackIndex = isCurrentScope ? selection.fallbackIndex : 0
  const preferredProduct = products.find((product) => product.id === preferredProductId)
  const selectedProduct =
    preferredProduct ?? products[Math.min(fallbackIndex, Math.max(products.length - 1, 0))] ?? null

  const selectProduct = React.useCallback(
    (productId: string) => {
      const productIndex = products.findIndex((product) => product.id === productId)
      if (productIndex < 0) return
      setSelection({ scopeKey, productId, fallbackIndex: productIndex })
    },
    [products, scopeKey]
  )

  const selectAddedProduct = React.useCallback(
    (productId: string) => {
      if (!productId) return
      setSelection({ scopeKey, productId, fallbackIndex: products.length })
    },
    [products.length, scopeKey]
  )

  return {
    selectedProductId: selectedProduct?.id ?? null,
    selectAddedProduct,
    selectProduct,
  }
}
