import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import type { TechnicalConfigurationReferenceProductWire } from "@/app/(app)/technical-configurations/reference-product-types"
import { isTechnicalConfigurationBaselineConflict } from "@/app/(app)/technical-configurations/technical-configuration-baseline-version-state"

export type TechnicalConfigurationReferenceProductDraft = {
  id: string
  persistedId: string | null
  model: string
  manufacturer: string
  description: string
  notes: string
  responses: Record<string, string>
}

export type TechnicalConfigurationReferenceProductPatch = Partial<
  Pick<
    TechnicalConfigurationReferenceProductDraft,
    "model" | "manufacturer" | "description" | "notes"
  >
>

export type TechnicalConfigurationReferenceProductSaveProgress = {
  revision: number
  baseProducts: TechnicalConfigurationReferenceProductDraft[]
  products: TechnicalConfigurationReferenceProductDraft[]
}

export type TechnicalConfigurationReferenceProductsState = {
  loadedVersionId: string
  baseProducts: TechnicalConfigurationReferenceProductDraft[]
  products: TechnicalConfigurationReferenceProductDraft[]
  revision: number
  isConflict: boolean
  isSaving: boolean
  isReloading: boolean
  saveStatus: "idle" | "saved"
  saveError: string | null
  refreshWarning: string | null
  ignoreProductsQueryData: boolean
  syncedProductsQueryData: TechnicalConfigurationReferenceProductWire[] | null
}

/** Creates reference-product editor state for the selected baseline version. */
export function createTechnicalConfigurationReferenceProductsState(
  baselineVersion: TechnicalConfigurationBaselineDraftWire | null
): TechnicalConfigurationReferenceProductsState {
  return {
    loadedVersionId: baselineVersion?.id ?? "",
    baseProducts: [],
    products: [],
    revision: baselineVersion?.revision ?? 0,
    isConflict: false,
    isSaving: false,
    isReloading: false,
    saveStatus: "idle",
    saveError: null,
    refreshWarning: null,
    ignoreProductsQueryData: false,
    syncedProductsQueryData: null,
  }
}

/** Applies resumable progress captured from a partially completed save. */
export function applyTechnicalConfigurationReferenceProductSaveFailureState({
  state,
  progress,
  isConflict,
  originalError,
}: {
  state: TechnicalConfigurationReferenceProductsState
  progress: TechnicalConfigurationReferenceProductSaveProgress
  isConflict: boolean
  originalError: unknown
}): TechnicalConfigurationReferenceProductsState {
  return {
    ...state,
    revision: progress.revision,
    baseProducts: progress.baseProducts,
    products: progress.products,
    isConflict,
    saveError: getTechnicalConfigurationReferenceProductSaveError(originalError),
  }
}

/** Records a non-resumable save error while preserving the current drafts. */
export function applyTechnicalConfigurationReferenceProductSaveErrorState(
  state: TechnicalConfigurationReferenceProductsState,
  error: unknown
): TechnicalConfigurationReferenceProductsState {
  return {
    ...state,
    isConflict: isTechnicalConfigurationBaselineConflict(error),
    saveError: getTechnicalConfigurationReferenceProductSaveError(error),
  }
}

/** Returns the best available display name for a reference-product draft. */
export function getTechnicalConfigurationReferenceProductName(
  product: TechnicalConfigurationReferenceProductDraft,
  index: number
) {
  return (
    product.model.trim() ||
    product.manufacturer.trim() ||
    product.description.trim() ||
    `Sản phẩm ${index + 1}`
  )
}

/** Normalizes optional reference-product text for RPC parameters. */
export function toNullableReferenceProductText(value: string): string | null {
  const normalized = value.trim()
  return normalized ? normalized : null
}

/** Converts a persisted reference product into an editable draft. */
export function toTechnicalConfigurationReferenceProductDraft(
  product: TechnicalConfigurationReferenceProductWire
): TechnicalConfigurationReferenceProductDraft {
  return {
    id: product.id,
    persistedId: product.id,
    model: product.model ?? "",
    manufacturer: product.manufacturer ?? "",
    description: product.description ?? "",
    notes: product.notes ?? "",
    responses: Object.fromEntries(
      product.responses.map((response) => [response.criterion_id, response.response_text])
    ),
  }
}

/** Deep-clones drafts and their criterion-response maps. */
export function cloneTechnicalConfigurationReferenceProductDrafts(
  products: TechnicalConfigurationReferenceProductDraft[]
): TechnicalConfigurationReferenceProductDraft[] {
  return products.map((product) => ({
    ...product,
    responses: { ...product.responses },
  }))
}

/** Reconciles server data without overwriting dirty or conflicting drafts. */
export function reconcileTechnicalConfigurationReferenceProductsState({
  state,
  baselineVersion,
  productsQueryData,
  isDirty,
}: {
  state: TechnicalConfigurationReferenceProductsState
  baselineVersion: TechnicalConfigurationBaselineDraftWire | null
  productsQueryData: TechnicalConfigurationReferenceProductWire[] | undefined
  isDirty: boolean
}): TechnicalConfigurationReferenceProductsState | null {
  if ((baselineVersion?.id ?? "") !== state.loadedVersionId) {
    return createTechnicalConfigurationReferenceProductsState(baselineVersion)
  }

  const canSyncProducts =
    Boolean(productsQueryData) &&
    productsQueryData !== state.syncedProductsQueryData &&
    !state.ignoreProductsQueryData &&
    !isDirty &&
    !state.isConflict &&
    !state.isSaving
  const nextRevision =
    !isDirty && baselineVersion?.revision !== undefined
      ? Math.max(state.revision, baselineVersion.revision)
      : state.revision
  if (!canSyncProducts && nextRevision === state.revision) return null

  const nextProducts = canSyncProducts
    ? productsQueryData?.map(toTechnicalConfigurationReferenceProductDraft)
    : null
  return {
    ...state,
    ...(nextProducts
      ? {
          baseProducts: nextProducts,
          products: cloneTechnicalConfigurationReferenceProductDrafts(nextProducts),
          syncedProductsQueryData: productsQueryData ?? null,
        }
      : {}),
    revision: nextRevision,
  }
}

/** Produces a stable representation for reference-product dirty checks. */
export function canonicalizeTechnicalConfigurationReferenceProductDrafts(
  products: TechnicalConfigurationReferenceProductDraft[]
) {
  return products.map((product) => ({
    persistedId: product.persistedId,
    model: product.model,
    manufacturer: product.manufacturer,
    description: product.description,
    notes: product.notes,
    responses: Object.entries(product.responses).toSorted(([left], [right]) =>
      left.localeCompare(right)
    ),
  }))
}

/** Compares the editable metadata fields of two reference-product drafts. */
export function haveSameTechnicalConfigurationReferenceProductFields(
  left: TechnicalConfigurationReferenceProductDraft,
  right: TechnicalConfigurationReferenceProductDraft
) {
  return (
    left.model === right.model &&
    left.manufacturer === right.manufacturer &&
    left.description === right.description &&
    left.notes === right.notes
  )
}

/** Returns criterion responses that differ from the persisted base draft. */
export function getChangedTechnicalConfigurationReferenceResponses(
  base: TechnicalConfigurationReferenceProductDraft | undefined,
  draft: TechnicalConfigurationReferenceProductDraft
) {
  return Object.entries(draft.responses).filter(
    ([criterionId, responseText]) => base?.responses[criterionId] !== responseText
  )
}

/** Converts reference-product save failures into user-facing messages. */
export function getTechnicalConfigurationReferenceProductSaveError(error: unknown) {
  if (isTechnicalConfigurationBaselineConflict(error)) {
    return "Dữ liệu sản phẩm tham chiếu đã thay đổi. Các chỉnh sửa chưa lưu được giữ lại; hãy tải lại dữ liệu máy chủ."
  }
  return "Không thể lưu sản phẩm tham chiếu."
}
