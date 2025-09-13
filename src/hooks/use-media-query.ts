"use client"

import * as React from "react"

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    // Ensure window is defined (for SSR/Next.js)
    if (typeof window === "undefined") {
      return
    }

    const mediaQueryList = window.matchMedia(query)

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Set initial state
    setMatches(mediaQueryList.matches)

    // Add listener for changes
    // Using addEventListener for modern browsers, with a fallback for older ones
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener("change", listener)
    } else {
      // Fallback for older browsers (e.g., Safari < 14)
      mediaQueryList.addListener(listener)
    }

    // Cleanup listener on component unmount
    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener("change", listener)
      } else {
        mediaQueryList.removeListener(listener)
      }
    }
  }, [query])

  return matches
}
