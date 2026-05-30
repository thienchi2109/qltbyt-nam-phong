import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribeToMobileBreakpoint(onStoreChange: () => void) {
  const mql = window.matchMedia(MOBILE_MEDIA_QUERY)
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", onStoreChange)

    return () => mql.removeEventListener("change", onStoreChange)
  }

  mql.addListener(onStoreChange)

  return () => mql.removeListener(onStoreChange)
}

function getMobileBreakpointSnapshot() {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

function getServerMobileBreakpointSnapshot() {
  return false
}

/** Returns whether the current viewport matches the mobile breakpoint. */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribeToMobileBreakpoint,
    getMobileBreakpointSnapshot,
    getServerMobileBreakpointSnapshot,
  )
}
