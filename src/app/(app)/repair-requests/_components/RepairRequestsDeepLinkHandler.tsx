"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import type { UseRepairRequestsDeepLinkOptions } from "../_hooks/useRepairRequestsDeepLink"
import { useRepairRequestsDeepLink } from "../_hooks/useRepairRequestsDeepLink"

export type RepairRequestsDeepLinkHandlerProps = Omit<
  UseRepairRequestsDeepLinkOptions,
  "pathname" | "router" | "searchParams"
>

function getSearchSnapshot() {
  if (typeof window === "undefined") return ""
  return window.location.search
}

function subscribeToSearchChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {}

  window.addEventListener("popstate", onStoreChange)
  window.addEventListener("hashchange", onStoreChange)

  return () => {
    window.removeEventListener("popstate", onStoreChange)
    window.removeEventListener("hashchange", onStoreChange)
  }
}

/** Feeds browser search params into the repair-request deep-link hook. */
export function RepairRequestsDeepLinkHandler(props: RepairRequestsDeepLinkHandlerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const search = React.useSyncExternalStore(
    subscribeToSearchChanges,
    getSearchSnapshot,
    () => "",
  )
  const searchParams = React.useMemo(() => new URLSearchParams(search), [search])

  useRepairRequestsDeepLink({
    ...props,
    pathname,
    router,
    searchParams,
  })

  return null
}
