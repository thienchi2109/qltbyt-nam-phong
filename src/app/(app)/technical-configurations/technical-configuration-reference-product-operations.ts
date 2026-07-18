import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import type {
  TechnicalConfigurationReferenceProductWire,
  TechnicalConfigurationReferenceProductsSnapshot,
} from "@/app/(app)/technical-configurations/reference-product-types"
import { collectStableTechnicalConfigurationPages } from "@/app/(app)/technical-configurations/technical-configuration-pagination"
import { isTechnicalConfigurationBaselineConflict } from "@/app/(app)/technical-configurations/technical-configuration-baseline-version-state"
import {
  cloneTechnicalConfigurationReferenceProductDrafts,
  getChangedTechnicalConfigurationReferenceResponses,
  haveSameTechnicalConfigurationReferenceProductFields,
  toNullableReferenceProductText,
  toTechnicalConfigurationReferenceProductDraft,
  type TechnicalConfigurationReferenceProductDraft,
  type TechnicalConfigurationReferenceProductSaveProgress,
} from "@/app/(app)/technical-configurations/technical-configuration-reference-product-state"
import {
  createTechnicalConfigurationReferenceProduct,
  deleteTechnicalConfigurationReferenceProduct,
  listTechnicalConfigurationReferenceProducts,
  updateTechnicalConfigurationReferenceProduct,
  upsertTechnicalConfigurationReferenceResponse,
} from "@/app/(app)/technical-configurations/technical-configuration-reference-rpc"

const REFERENCE_PRODUCT_PAGE_SIZE = 100

type TechnicalConfigurationReferenceProductSaveResult = {
  revision: number
  products: TechnicalConfigurationReferenceProductDraft[]
}

/** Carries resumable progress when a multi-RPC reference-product save fails. */
export class ReferenceProductSaveFailure extends Error {
  readonly isConflict: boolean
  readonly progress: TechnicalConfigurationReferenceProductSaveProgress
  readonly originalError: unknown

  constructor(error: unknown, progress: TechnicalConfigurationReferenceProductSaveProgress) {
    super(error instanceof Error && error.message ? error.message : "reference_product_save_failed")
    this.name = "ReferenceProductSaveFailure"
    this.isConflict = isTechnicalConfigurationBaselineConflict(error)
    this.progress = cloneReferenceProductSaveProgress(progress)
    this.originalError = error
  }
}

/** Loads every paginated reference product for a baseline version. */
export async function listAllTechnicalConfigurationReferenceProducts(
  baselineVersionId: string,
  signal?: AbortSignal
): Promise<TechnicalConfigurationReferenceProductsSnapshot> {
  const { items: products, firstPage } = await collectStableTechnicalConfigurationPages<
    TechnicalConfigurationReferenceProductWire,
    Awaited<ReturnType<typeof listTechnicalConfigurationReferenceProducts>>
  >({
    loadPage: (page) =>
      listTechnicalConfigurationReferenceProducts(
        {
          p_baseline_version_id: baselineVersionId,
          p_page: page,
          p_page_size: REFERENCE_PRODUCT_PAGE_SIZE,
        },
        signal
      ),
    snapshotError: "Reference-product pagination snapshot changed during load.",
    getItemKey: (product) => product.id,
    isSameSnapshot: (first, next) => first.revision === next.revision,
  })

  return { products, revision: firstPage.revision }
}

/** Persists reference-product drafts with resumable optimistic-concurrency progress. */
export async function saveTechnicalConfigurationReferenceProducts({
  baselineVersion,
  baseProducts,
  products,
  revision,
}: {
  baselineVersion: TechnicalConfigurationBaselineDraftWire
  baseProducts: TechnicalConfigurationReferenceProductDraft[]
  products: TechnicalConfigurationReferenceProductDraft[]
  revision: number
}): Promise<TechnicalConfigurationReferenceProductSaveResult> {
  const progress = cloneReferenceProductSaveProgress({
    revision,
    baseProducts,
    products,
  })
  const desiredPersistedIds = new Set(
    products.flatMap((product) => (product.persistedId ? [product.persistedId] : []))
  )
  const deletedProducts = baseProducts.filter(
    (product) => product.persistedId && !desiredPersistedIds.has(product.persistedId)
  )
  const run = async <T>(request: () => Promise<T>): Promise<T> => {
    try {
      return await request()
    } catch (error) {
      throw new ReferenceProductSaveFailure(error, progress)
    }
  }

  for (const draft of progress.products.filter((product) => product.persistedId)) {
    const base = progress.baseProducts.find((product) => product.id === draft.id)
    if (base && !haveSameTechnicalConfigurationReferenceProductFields(base, draft)) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- Expected revisions serialize these writes.
      const response = await run(() =>
        updateTechnicalConfigurationReferenceProduct({
          p_reference_product_id: draft.id,
          p_model: toNullableReferenceProductText(draft.model),
          p_manufacturer: toNullableReferenceProductText(draft.manufacturer),
          p_description: toNullableReferenceProductText(draft.description),
          p_notes: toNullableReferenceProductText(draft.notes),
          p_expected_revision: progress.revision,
        })
      )
      progress.revision = response.data.revision
      const confirmed = {
        ...toTechnicalConfigurationReferenceProductDraft(response.data),
        responses: { ...base.responses },
      }
      progress.baseProducts = replaceReferenceProductDraft(
        progress.baseProducts,
        draft.id,
        confirmed
      )
      progress.products = replaceReferenceProductDraft(progress.products, draft.id, {
        ...confirmed,
        responses: { ...draft.responses },
      })
    }
    for (const [criterionId, responseText] of getChangedTechnicalConfigurationReferenceResponses(
      base,
      draft
    )) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- Expected revisions serialize these writes.
      const response = await run(() =>
        upsertTechnicalConfigurationReferenceResponse({
          p_reference_product_id: draft.id,
          p_criterion_id: criterionId,
          p_response_text: responseText,
          p_expected_revision: progress.revision,
        })
      )
      progress.revision = response.data.revision
      progress.baseProducts = replaceReferenceProductResponse(
        progress.baseProducts,
        draft.id,
        criterionId,
        response.data.response_text
      )
      progress.products = replaceReferenceProductResponse(
        progress.products,
        draft.id,
        criterionId,
        response.data.response_text
      )
    }
  }

  for (const draft of progress.products.filter((product) => !product.persistedId)) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- Expected revisions serialize these writes.
    const created = await run(() =>
      createTechnicalConfigurationReferenceProduct({
        p_baseline_version_id: baselineVersion.id,
        p_model: toNullableReferenceProductText(draft.model),
        p_manufacturer: toNullableReferenceProductText(draft.manufacturer),
        p_description: toNullableReferenceProductText(draft.description),
        p_notes: toNullableReferenceProductText(draft.notes),
        p_expected_revision: progress.revision,
      })
    )
    progress.revision = created.data.revision
    const persistedDraft = toTechnicalConfigurationReferenceProductDraft(created.data)
    const createdProductId = created.data.id
    progress.baseProducts = [...progress.baseProducts, persistedDraft]
    progress.products = replaceReferenceProductDraft(progress.products, draft.id, {
      ...persistedDraft,
      responses: { ...draft.responses },
    })

    for (const [criterionId, responseText] of getChangedTechnicalConfigurationReferenceResponses(
      undefined,
      draft
    )) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- Expected revisions serialize these writes.
      const response = await run(() =>
        upsertTechnicalConfigurationReferenceResponse({
          p_reference_product_id: createdProductId,
          p_criterion_id: criterionId,
          p_response_text: responseText,
          p_expected_revision: progress.revision,
        })
      )
      progress.revision = response.data.revision
      progress.baseProducts = replaceReferenceProductResponse(
        progress.baseProducts,
        createdProductId,
        criterionId,
        response.data.response_text
      )
      progress.products = replaceReferenceProductResponse(
        progress.products,
        createdProductId,
        criterionId,
        response.data.response_text
      )
    }
  }

  for (const deletedProduct of deletedProducts) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- Expected revisions serialize these writes.
    const response = await run(() =>
      deleteTechnicalConfigurationReferenceProduct({
        p_reference_product_id: deletedProduct.id,
        p_expected_revision: progress.revision,
      })
    )
    progress.revision = response.data.revision
    progress.baseProducts = progress.baseProducts.filter(
      (product) => product.id !== deletedProduct.id
    )
  }

  return {
    revision: progress.revision,
    products: cloneTechnicalConfigurationReferenceProductDrafts(progress.baseProducts),
  }
}

function cloneReferenceProductSaveProgress(
  progress: TechnicalConfigurationReferenceProductSaveProgress
): TechnicalConfigurationReferenceProductSaveProgress {
  return {
    revision: progress.revision,
    baseProducts: cloneTechnicalConfigurationReferenceProductDrafts(progress.baseProducts),
    products: cloneTechnicalConfigurationReferenceProductDrafts(progress.products),
  }
}

function replaceReferenceProductDraft(
  products: TechnicalConfigurationReferenceProductDraft[],
  productId: string,
  replacement: TechnicalConfigurationReferenceProductDraft
) {
  return products.map((product) =>
    product.id === productId
      ? {
          ...replacement,
          responses: { ...replacement.responses },
        }
      : product
  )
}

function replaceReferenceProductResponse(
  products: TechnicalConfigurationReferenceProductDraft[],
  productId: string,
  criterionId: string,
  responseText: string
) {
  return products.map((product) =>
    product.id === productId
      ? {
          ...product,
          responses: {
            ...product.responses,
            [criterionId]: responseText,
          },
        }
      : product
  )
}
