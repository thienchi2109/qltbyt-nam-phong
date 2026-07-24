import {
  createTechnicalConfigurationOption,
  createTechnicalConfigurationSupplier,
  deleteTechnicalConfigurationOption,
  deleteTechnicalConfigurationSupplier,
  listTechnicalConfigurationOptions,
  listTechnicalConfigurationSuppliers,
  updateTechnicalConfigurationOption,
  updateTechnicalConfigurationSupplier,
} from "./technical-configuration-supplier-option-rpc"
import type {
  TechnicalConfigurationOptionMutationWireResponse,
  TechnicalConfigurationOptionWire,
  TechnicalConfigurationSupplierMutationWireResponse,
  TechnicalConfigurationSupplierWire,
} from "./supplier-option-types"
import {
  toNullableTechnicalConfigurationIdentityText,
  toNullableTechnicalConfigurationNotes,
  type TechnicalConfigurationOptionDraft,
  type TechnicalConfigurationSupplierDraft,
} from "./technical-configuration-supplier-option-state"
import { collectStableTechnicalConfigurationPages } from "./technical-configuration-pagination"

const IDENTITY_PAGE_SIZE = 100

export type TechnicalConfigurationSuppliersSnapshot = {
  suppliers: TechnicalConfigurationSupplierWire[]
  revision: number
}

export type TechnicalConfigurationOptionsSnapshot = {
  options: TechnicalConfigurationOptionWire[]
  revision: number
}

/** Loads every supplier page for a dossier without issuing per-supplier queries. */
export async function listAllTechnicalConfigurationSuppliers(
  dossierId: string,
  signal?: AbortSignal
): Promise<TechnicalConfigurationSuppliersSnapshot> {
  const { items: suppliers, firstPage } = await collectStableTechnicalConfigurationPages<
    TechnicalConfigurationSupplierWire,
    Awaited<ReturnType<typeof listTechnicalConfigurationSuppliers>>
  >({
    loadPage: (page) =>
      listTechnicalConfigurationSuppliers(
        {
          p_dossier_id: dossierId,
          p_page: page,
          p_page_size: IDENTITY_PAGE_SIZE,
        },
        signal
      ),
    snapshotError: "Supplier pagination snapshot changed during load.",
    getItemKey: (supplier) => supplier.id,
    isSameSnapshot: (first, next) => first.revision === next.revision,
  })

  return { suppliers, revision: firstPage.revision }
}

/** Loads every option page for a dossier in one paginated dossier-wide stream. */
export async function listAllTechnicalConfigurationOptions(
  dossierId: string,
  signal?: AbortSignal
): Promise<TechnicalConfigurationOptionsSnapshot> {
  const { items: options, firstPage } = await collectStableTechnicalConfigurationPages<
    TechnicalConfigurationOptionWire,
    Awaited<ReturnType<typeof listTechnicalConfigurationOptions>>
  >({
    loadPage: (page) =>
      listTechnicalConfigurationOptions(
        {
          p_dossier_id: dossierId,
          p_supplier_id: null,
          p_page: page,
          p_page_size: IDENTITY_PAGE_SIZE,
        },
        signal
      ),
    snapshotError: "Option pagination snapshot changed during load.",
    getItemKey: (option) => option.id,
    isSameSnapshot: (first, next) => first.revision === next.revision,
  })

  return { options, revision: firstPage.revision }
}

/** Reads the authoritative filtered option total used by supplier deletion warnings. */
export async function getTechnicalConfigurationSupplierOptionCount(
  dossierId: string,
  supplierId: string
): Promise<number> {
  const response = await listTechnicalConfigurationOptions({
    p_dossier_id: dossierId,
    p_supplier_id: supplierId,
    p_page: 1,
    p_page_size: 1,
  })
  return response.total
}

/** Creates or updates one supplier using the current dossier revision. */
export function saveTechnicalConfigurationSupplier({
  dossierId,
  draft,
  revision,
}: {
  dossierId: string
  draft: TechnicalConfigurationSupplierDraft
  revision: number
}): Promise<TechnicalConfigurationSupplierMutationWireResponse> {
  if (draft.persistedId) {
    return updateTechnicalConfigurationSupplier({
      p_supplier_id: draft.persistedId,
      p_name: draft.name.trim(),
      p_expected_revision: revision,
    })
  }
  return createTechnicalConfigurationSupplier({
    p_dossier_id: dossierId,
    p_name: draft.name.trim(),
    p_expected_revision: revision,
  })
}

/** Creates or updates one option identity using the current dossier revision. */
export function saveTechnicalConfigurationOption({
  draft,
  revision,
}: {
  draft: TechnicalConfigurationOptionDraft
  revision: number
}): Promise<TechnicalConfigurationOptionMutationWireResponse> {
  const identity = {
    p_model: toNullableTechnicalConfigurationIdentityText(draft.model),
    p_manufacturer: toNullableTechnicalConfigurationIdentityText(draft.manufacturer),
    p_option_name: toNullableTechnicalConfigurationIdentityText(draft.optionName),
    p_notes: toNullableTechnicalConfigurationNotes(draft.notes),
    p_expected_revision: revision,
  }
  if (draft.persistedId) {
    return updateTechnicalConfigurationOption({
      p_option_id: draft.persistedId,
      ...identity,
    })
  }
  return createTechnicalConfigurationOption({
    p_supplier_id: draft.supplierId,
    ...identity,
  })
}

/** Deletes one supplier using optimistic dossier concurrency. */
export function removeTechnicalConfigurationSupplier(supplierId: string, revision: number) {
  return deleteTechnicalConfigurationSupplier({
    p_supplier_id: supplierId,
    p_expected_revision: revision,
  })
}

/** Deletes one option using optimistic dossier concurrency. */
export function removeTechnicalConfigurationOption(optionId: string, revision: number) {
  return deleteTechnicalConfigurationOption({
    p_option_id: optionId,
    p_expected_revision: revision,
  })
}
