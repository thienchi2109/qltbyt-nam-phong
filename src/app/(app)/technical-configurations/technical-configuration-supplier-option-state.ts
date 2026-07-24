import type {
  TechnicalConfigurationOptionWire,
  TechnicalConfigurationSupplierWire,
} from "./supplier-option-types"

export type TechnicalConfigurationSupplierDraft = {
  persistedId: string | null
  name: string
}

export type TechnicalConfigurationOptionDraft = {
  persistedId: string | null
  supplierId: string
  model: string
  manufacturer: string
  optionName: string
  notes: string
}

export type TechnicalConfigurationOptionDraftPatch = Partial<
  Pick<TechnicalConfigurationOptionDraft, "model" | "manufacturer" | "optionName" | "notes">
>

export type TechnicalConfigurationSupplierOptionSelection = {
  supplierId: string | null
  optionId: string | null
  supplierDraft: TechnicalConfigurationSupplierDraft
  optionDraft: TechnicalConfigurationOptionDraft
}

/** Creates a blank supplier draft without implying that creation has started. */
export function createEmptyTechnicalConfigurationSupplierDraft(): TechnicalConfigurationSupplierDraft {
  return { persistedId: null, name: "" }
}

/** Creates a blank option draft for one supplier. */
export function createEmptyTechnicalConfigurationOptionDraft(
  supplierId = ""
): TechnicalConfigurationOptionDraft {
  return {
    persistedId: null,
    supplierId,
    model: "",
    manufacturer: "",
    optionName: "",
    notes: "",
  }
}

/** Converts a canonical supplier snapshot into an editable draft. */
export function toTechnicalConfigurationSupplierDraft(
  supplier: TechnicalConfigurationSupplierWire
): TechnicalConfigurationSupplierDraft {
  return {
    persistedId: supplier.id,
    name: supplier.name,
  }
}

/** Converts a canonical option snapshot into an editable draft. */
export function toTechnicalConfigurationOptionDraft(
  option: TechnicalConfigurationOptionWire
): TechnicalConfigurationOptionDraft {
  return {
    persistedId: option.id,
    supplierId: option.supplier_id,
    model: option.model ?? "",
    manufacturer: option.manufacturer ?? "",
    optionName: option.option_name ?? "",
    notes: option.notes ?? "",
  }
}

/** Normalizes optional single-line identity fields for RPC parameters. */
export function toNullableTechnicalConfigurationIdentityText(value: string): string | null {
  const normalized = value.replaceAll(/\s+/g, " ").trim()
  return normalized || null
}

/** Normalizes optional multiline notes without collapsing internal whitespace. */
export function toNullableTechnicalConfigurationNotes(value: string): string | null {
  const normalized = value.trim()
  return normalized || null
}

/** Selects a valid supplier and option while keeping canonical snapshots separate from drafts. */
export function selectTechnicalConfigurationSupplierOption({
  suppliers,
  options,
  preferredSupplierId,
  preferredOptionId,
}: {
  suppliers: TechnicalConfigurationSupplierWire[]
  options: TechnicalConfigurationOptionWire[]
  preferredSupplierId?: string | null
  preferredOptionId?: string | null
}): TechnicalConfigurationSupplierOptionSelection {
  const supplier =
    suppliers.find((item) => item.id === preferredSupplierId) ?? suppliers.at(0) ?? null
  const supplierOptions = supplier ? options.filter((item) => item.supplier_id === supplier.id) : []
  const option =
    supplierOptions.find((item) => item.id === preferredOptionId) ?? supplierOptions.at(0) ?? null

  return {
    supplierId: supplier?.id ?? null,
    optionId: option?.id ?? null,
    supplierDraft: supplier
      ? toTechnicalConfigurationSupplierDraft(supplier)
      : createEmptyTechnicalConfigurationSupplierDraft(),
    optionDraft: option
      ? toTechnicalConfigurationOptionDraft(option)
      : createEmptyTechnicalConfigurationOptionDraft(supplier?.id),
  }
}

/** Compares one supplier draft with its canonical server snapshot. */
export function isTechnicalConfigurationSupplierDraftDirty({
  draft,
  baseline,
  isCreating,
}: {
  draft: TechnicalConfigurationSupplierDraft
  baseline: TechnicalConfigurationSupplierDraft
  isCreating: boolean
}): boolean {
  if (isCreating) return draft.name.length > 0
  return draft.persistedId !== baseline.persistedId || draft.name !== baseline.name
}

/** Compares one option draft with its canonical server snapshot. */
export function isTechnicalConfigurationOptionDraftDirty({
  draft,
  baseline,
  isCreating,
}: {
  draft: TechnicalConfigurationOptionDraft
  baseline: TechnicalConfigurationOptionDraft
  isCreating: boolean
}): boolean {
  if (isCreating) {
    return Boolean(draft.model || draft.manufacturer || draft.optionName || draft.notes)
  }
  return (
    draft.persistedId !== baseline.persistedId ||
    draft.supplierId !== baseline.supplierId ||
    draft.model !== baseline.model ||
    draft.manufacturer !== baseline.manufacturer ||
    draft.optionName !== baseline.optionName ||
    draft.notes !== baseline.notes
  )
}

/** Returns the item after a deleted item, falling back to the preceding item. */
export function getNextTechnicalConfigurationSelectionId(
  ids: string[],
  deletedId: string
): string | null {
  const deletedIndex = ids.indexOf(deletedId)
  if (deletedIndex < 0) return ids.at(0) ?? null
  return ids[deletedIndex + 1] ?? ids[deletedIndex - 1] ?? null
}
