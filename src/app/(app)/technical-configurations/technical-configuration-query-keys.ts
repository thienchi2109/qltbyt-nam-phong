/** Shared root for technical-configuration dossier queries. */
export const TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT = [
  "technical-configurations",
  "dossiers",
] as const

/** Builds the cache key for one technical-configuration dossier detail. */
export function technicalConfigurationDossierDetailQueryKey(dossierId: string) {
  return [...TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT, "detail", dossierId] as const
}
