const COMBINING_MARKS = /[\u0300-\u036f]/g
const MULTIPLE_WHITESPACE = /\s+/g

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase("vi-VN")
    .trim()
    .replace(MULTIPLE_WHITESPACE, " ")
}

export function includesNormalizedSearch(source: string, normalizedSearch: string): boolean {
  if (!normalizedSearch) return true
  return normalizeSearchText(source).includes(normalizedSearch)
}
