import {
  getTechnicalConfigurationReferenceProductName,
  type TechnicalConfigurationReferenceProductDraft,
} from "@/app/(app)/technical-configurations/technical-configuration-reference-product-state"

export type ReferenceColumnState = {
  baselineVersionId: string
  productIds: string[]
  hiddenProductIds: string[]
  pageIndex: number
}

/** Maximum number of visible reference-product columns rendered per page. */
export const REFERENCE_PRODUCT_PAGE_SIZE = 5

const NEW_REFERENCE_PRODUCT_PREFIX = "new-reference-product-"

function haveSameProductIds(left: string[], right: string[]) {
  return (
    left.length === right.length && left.every((productId, index) => productId === right[index])
  )
}

/** Clamps a page index after products are hidden, added, or removed. */
export function clampReferenceProductPageIndex(
  pageIndex: number,
  productIds: string[],
  hiddenProductIds: string[]
) {
  const hiddenProductIdSet = new Set(hiddenProductIds)
  const visibleProductCount = productIds.filter(
    (productId) => !hiddenProductIdSet.has(productId)
  ).length
  const lastPageIndex = Math.max(
    0,
    Math.ceil(visibleProductCount / REFERENCE_PRODUCT_PAGE_SIZE) - 1
  )

  return Math.min(pageIndex, lastPageIndex)
}

/** Reconciles column identity and pagination when the baseline or products change. */
export function reconcileReferenceColumnState(
  current: ReferenceColumnState,
  baselineVersionId: string,
  productIds: string[]
): ReferenceColumnState | null {
  if (current.baselineVersionId !== baselineVersionId) {
    return {
      baselineVersionId,
      productIds,
      hiddenProductIds: [],
      pageIndex: 0,
    }
  }
  if (haveSameProductIds(current.productIds, productIds)) return null

  const priorProductIdSet = new Set(current.productIds)
  const hiddenProductIdSet = new Set(current.hiddenProductIds)
  productIds.forEach((productId, index) => {
    if (priorProductIdSet.has(productId)) return
    const priorProductId = current.productIds[index]
    if (
      priorProductId?.startsWith(NEW_REFERENCE_PRODUCT_PREFIX) &&
      hiddenProductIdSet.has(priorProductId)
    ) {
      hiddenProductIdSet.add(productId)
    }
  })

  const hiddenProductIds = [...hiddenProductIdSet]
  return {
    baselineVersionId,
    productIds,
    hiddenProductIds,
    pageIndex: clampReferenceProductPageIndex(current.pageIndex, productIds, hiddenProductIds),
  }
}

/** Returns unique labels for product columns and their accessible controls. */
export function getReferenceProductDisplayLabels(
  products: TechnicalConfigurationReferenceProductDraft[]
) {
  const entries = products.map((product, index) => ({
    product,
    name: getTechnicalConfigurationReferenceProductName(product, index),
  }))
  const nameCounts = new Map<string, number>()
  entries.forEach(({ name }) => nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1))

  return new Map(
    entries.map(({ product, name }, index) => [
      product.id,
      nameCounts.get(name) === 1 ? name : `${name} (Sản phẩm ${index + 1})`,
    ])
  )
}
