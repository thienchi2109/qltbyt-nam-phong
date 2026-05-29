"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import type { UseRepairRequestsDeepLinkOptions } from "../_hooks/useRepairRequestsDeepLink"
import { useRepairRequestsDeepLink } from "../_hooks/useRepairRequestsDeepLink"

export type RepairRequestsDeepLinkHandlerProps = Omit<
  UseRepairRequestsDeepLinkOptions,
  "pathname" | "router" | "searchParams"
>

const HISTORY_SEARCH_CHANGE_EVENT = "repair-requests-history-search-change"

let activeHistorySubscribers = 0
let originalHistoryMethods: Pick<History, "pushState" | "replaceState"> | null = null

function getSearchSnapshot() {
  if (typeof window === "undefined") return ""
  return window.location.search
}

function notifySearchChange() {
  window.dispatchEvent(new Event(HISTORY_SEARCH_CHANGE_EVENT))
}

function patchHistoryMethods() {
  if (typeof window === "undefined" || originalHistoryMethods) return

  const { pushState, replaceState } = window.history
  originalHistoryMethods = { pushState, replaceState }

  window.history.pushState = function pushStateWithSearchNotification(...args) {
    const result = pushState.apply(this, args)
    notifySearchChange()
    return result
  }

  window.history.replaceState = function replaceStateWithSearchNotification(...args) {
    const result = replaceState.apply(this, args)
    notifySearchChange()
    return result
  }
}

function restoreHistoryMethods() {
  if (typeof window === "undefined" || !originalHistoryMethods) return

  window.history.pushState = originalHistoryMethods.pushState
  window.history.replaceState = originalHistoryMethods.replaceState
  originalHistoryMethods = null
}

function subscribeToSearchChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {}

  activeHistorySubscribers += 1
  patchHistoryMethods()

  window.addEventListener("popstate", onStoreChange)
  window.addEventListener("hashchange", onStoreChange)
  window.addEventListener(HISTORY_SEARCH_CHANGE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("popstate", onStoreChange)
    window.removeEventListener("hashchange", onStoreChange)
    window.removeEventListener(HISTORY_SEARCH_CHANGE_EVENT, onStoreChange)

    activeHistorySubscribers -= 1
    if (activeHistorySubscribers === 0) {
      restoreHistoryMethods()
    }
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
