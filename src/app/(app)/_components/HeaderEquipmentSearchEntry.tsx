"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"

import { SearchInput } from "@/components/shared/SearchInput"
import { Button } from "@/components/ui/button"
import { isPrivilegedRole } from "@/lib/rbac"

type HeaderEquipmentSearchEntryProps = {
  userRole?: string
}

const SEARCH_LABEL = "Tìm kiếm thiết bị"
const SEARCH_BUTTON_ADDON = (
  <Button type="submit" variant="ghost" size="icon" className="h-7 w-7">
    <Search className="size-4" />
    <span className="sr-only">{SEARCH_LABEL}</span>
  </Button>
)

/**
 * Header-only submit entry for the Reports equipment search tab.
 */
export function HeaderEquipmentSearchEntry({ userRole }: HeaderEquipmentSearchEntryProps) {
  const router = useRouter()
  const [keyword, setKeyword] = React.useState("")

  if (!isPrivilegedRole(userRole)) {
    return null
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedKeyword = keyword.trim()

    if (!trimmedKeyword) {
      return
    }

    const params = new URLSearchParams({
      tab: "equipment-search",
      q: trimmedKeyword,
    })
    router.push(`/reports?${params.toString()}`)
    setKeyword("")
  }

  return (
    <form
      role="search"
      aria-label={SEARCH_LABEL}
      className="hidden w-full max-w-xs items-center gap-2 md:flex lg:max-w-sm"
      onSubmit={handleSubmit}
    >
      <SearchInput
        id="header-equipment-search"
        value={keyword}
        onChange={setKeyword}
        aria-label={SEARCH_LABEL}
        autoComplete="off"
        placeholder={SEARCH_LABEL}
        className="h-9 min-w-0"
        showClearButton={false}
        endAddon={SEARCH_BUTTON_ADDON}
      />
    </form>
  )
}
