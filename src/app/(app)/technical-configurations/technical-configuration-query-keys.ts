/** Shared root for technical-configuration dossier queries. */
export const TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT = [
  "technical-configurations",
  "dossiers",
] as const

/** Builds the cache key for one technical-configuration dossier detail. */
export function technicalConfigurationDossierDetailQueryKey(dossierId: string) {
  return [...TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT, "detail", dossierId] as const
}

/** Builds the cache key for paginated baseline versions in one dossier. */
export function technicalConfigurationBaselineVersionsQueryKey(dossierId: string) {
  return ["technical-configurations", "baseline-versions", dossierId] as const
}

/** Builds the cache key for reference products under one exact baseline version. */
export function technicalConfigurationReferenceProductsQueryKey(baselineVersionId: string) {
  return ["technical-configurations", "reference-products", baselineVersionId] as const
}

/** Builds the cache key for baseline and reference evidence under one baseline version. */
export function technicalConfigurationDocumentsQueryKey(baselineVersionId: string) {
  return ["technical-configurations", "documents", baselineVersionId] as const
}

/** Builds the cache key for supplier identities in one dossier. */
export function technicalConfigurationSuppliersQueryKey(dossierId: string) {
  return ["technical-configurations", "suppliers", dossierId] as const
}

/** Builds the cache key for option identities in one dossier. */
export function technicalConfigurationOptionsQueryKey(dossierId: string) {
  return ["technical-configurations", "options", dossierId] as const
}

/** Builds the cache key for one option's nullable exact-baseline response snapshot. */
export function technicalConfigurationOptionResponsesQueryKey(
  optionId: string,
  baselineVersionId: string
) {
  return ["technical-configurations", "option-responses", optionId, baselineVersionId] as const
}
