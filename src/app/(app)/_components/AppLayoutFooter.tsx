"use client"

import * as React from "react"
import { Copyright } from "lucide-react"

import { useFooterHidden } from "./AppLayoutFooterVisibility"

/** Renders the desktop application footer unless a mounted workspace suppresses it. */
export function AppLayoutFooter(): React.JSX.Element | null {
  const isFooterHidden = useFooterHidden()
  if (isFooterHidden) return null

  return (
    <footer className="hidden flex-col items-center gap-1 border-t border-border bg-muted p-4 text-center caption-responsive md:flex">
      <div className="flex items-center gap-1 text-muted-foreground">
        <span>Hệ thống quản lý thiết bị y tế CVMEMS</span>
        <Copyright className="size-3" />
      </div>
    </footer>
  )
}
