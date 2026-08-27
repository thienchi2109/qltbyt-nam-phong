const VIETNAMESE_CHARACTERS = "áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ"
const VIETNAMESE_REPLACEMENTS =
  "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd"
const VIETNAMESE_CHARACTER = new RegExp(`[${VIETNAMESE_CHARACTERS}]`, "gu")
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu
const MULTIPLE_WHITESPACE = /\s+/g

/** Debounce interval for dossier-list search requests. */
export const TECHNICAL_CONFIGURATION_DOSSIER_SEARCH_DEBOUNCE_MS = 300

/** Maximum raw dossier-search input length accepted by the contract. */
export const TECHNICAL_CONFIGURATION_DOSSIER_SEARCH_MAX_LENGTH = 200

/** Normalizes dossier search text for client state and cache identity. */
export function normalizeTechnicalConfigurationDossierSearch(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(VIETNAMESE_CHARACTER, (character) => {
      const index = VIETNAMESE_CHARACTERS.indexOf(character)
      return index === -1 ? character : VIETNAMESE_REPLACEMENTS.charAt(index)
    })
    .replace(NON_ALPHANUMERIC, " ")
    .trim()
    .replace(MULTIPLE_WHITESPACE, " ")
}
