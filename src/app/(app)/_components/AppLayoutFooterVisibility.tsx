"use client"

import * as React from "react"

type SuppressionTarget = "footer" | "chrome"
type SuppressionRequest = (target: SuppressionTarget) => () => void

const FooterHiddenContext = React.createContext(false)
const ChromeHiddenContext = React.createContext(false)
const SuppressionRequestContext = React.createContext<SuppressionRequest>(() => () => undefined)

/** Coordinates reference-counted footer and app-chrome suppression requests. */
export function FooterVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [footerSuppressionCount, setFooterSuppressionCount] = React.useState(0)
  const [chromeSuppressionCount, setChromeSuppressionCount] = React.useState(0)
  const requestSuppression = React.useCallback((target: SuppressionTarget) => {
    let isActive = true
    const setCount = target === "footer" ? setFooterSuppressionCount : setChromeSuppressionCount
    setCount((current) => current + 1)

    return () => {
      if (!isActive) return
      isActive = false
      setCount((current) => Math.max(0, current - 1))
    }
  }, [])
  const isChromeHidden = chromeSuppressionCount > 0
  const isFooterHidden = footerSuppressionCount > 0 || isChromeHidden

  return (
    <SuppressionRequestContext.Provider value={requestSuppression}>
      <ChromeHiddenContext.Provider value={isChromeHidden}>
        <FooterHiddenContext.Provider value={isFooterHidden}>
          {children}
        </FooterHiddenContext.Provider>
      </ChromeHiddenContext.Provider>
    </SuppressionRequestContext.Provider>
  )
}

/** Reports whether the desktop application footer is currently suppressed. */
export function useFooterHidden() {
  return React.useContext(FooterHiddenContext)
}

/** Removes app-shell chrome while keeping the main workspace subtree mounted. */
export function AppLayoutChrome({ children }: { children: React.ReactNode }) {
  const isChromeHidden = React.useContext(ChromeHiddenContext)
  return isChromeHidden ? null : <>{children}</>
}

function useLayoutSuppression(target: SuppressionTarget, enabled: boolean) {
  const requestSuppression = React.useContext(SuppressionRequestContext)

  React.useLayoutEffect(() => {
    if (!enabled) return
    return requestSuppression(target)
  }, [enabled, requestSuppression, target])
}

/** Suppresses the desktop footer for the lifetime of the calling component. */
export function useSuppressFooter() {
  useLayoutSuppression("footer", true)
}

/** Suppresses app-shell chrome while enabled and restores it during cleanup. */
export function useSuppressAppChrome(enabled: boolean) {
  useLayoutSuppression("chrome", enabled)
}
