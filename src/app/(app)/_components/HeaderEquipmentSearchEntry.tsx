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
  <Button
    type="submit"
    variant="ghost"
    size="icon"
    className="h-6 w-6 rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
  >
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
      className="hidden w-56 shrink-0 items-center md:flex xl:w-64 2xl:w-72"
      onSubmit={handleSubmit}
    >
      <SearchInput
        id="header-equipment-search"
        value={keyword}
        onChange={setKeyword}
        aria-label={SEARCH_LABEL}
        autoComplete="off"
        placeholder={SEARCH_LABEL}
        className="h-8 min-w-0 rounded-lg border-transparent bg-muted/50 text-sm shadow-none transition-colors placeholder:text-muted-foreground/80 hover:bg-muted/70 focus-visible:border-primary/30 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:ring-offset-0"
        showClearButton={false}
        endAddon={SEARCH_BUTTON_ADDON}
      />
    </form>
  )
}
