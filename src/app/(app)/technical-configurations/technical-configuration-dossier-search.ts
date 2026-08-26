const COMBINING_MARKS = /\p{M}+/gu
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu
const MULTIPLE_WHITESPACE = /\s+/g

/** Debounce interval for dossier-list search requests. */
export const TECHNICAL_CONFIGURATION_DOSSIER_SEARCH_DEBOUNCE_MS = 300

/** Maximum raw dossier-search input length accepted by the contract. */
export const TECHNICAL_CONFIGURATION_DOSSIER_SEARCH_MAX_LENGTH = 200

/** Normalizes dossier search text for client state and cache identity. */
export function normalizeTechnicalConfigurationDossierSearch(value: string): string {
  return value
    .normalize("NFD")
    .toLowerCase()
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d")
    .replace(NON_ALPHANUMERIC, " ")
    .trim()
    .replace(MULTIPLE_WHITESPACE, " ")
}
