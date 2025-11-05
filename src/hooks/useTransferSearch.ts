import * as React from "react"

import { useSearchDebounce } from "@/hooks/use-debounce"

interface UseTransferSearchOptions {
  /** Minimum characters before treating search as active */
  minLength?: number
}

interface UseTransferSearchResult {
  searchTerm: string
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  debouncedSearch: string
  isActive: boolean
  clearSearch: () => void
}

export const useTransferSearch = (
  initialValue = "",
  options: UseTransferSearchOptions = {},
): UseTransferSearchResult => {
  const { minLength = 2 } = options
  const [searchTerm, setSearchTerm] = React.useState(initialValue)

  const debouncedSearch = useSearchDebounce(searchTerm.trim())
  const isActive = debouncedSearch.length >= minLength

  const clearSearch = React.useCallback(() => {
    setSearchTerm("")
  }, [])

  return {
    searchTerm,
    setSearchTerm,
    debouncedSearch,
    isActive,
    clearSearch,
  }
}
