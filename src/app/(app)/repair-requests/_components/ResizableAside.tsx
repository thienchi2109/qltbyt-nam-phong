"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronRight, PanelRightClose } from "lucide-react"

export function ResizableAside({
  width,
  setWidth,
  collapsed,
  setCollapsed,
  min = 320,
  max = 560,
  className,
  children,
}: {
  width: number
  setWidth: (n: number) => void
  collapsed: boolean
  setCollapsed: (b: boolean) => void
  min?: number
  max?: number
  className?: string
  children?: React.ReactNode
}) {
  const startXRef = React.useRef<number | null>(null)
  const startWRef = React.useRef<number>(width)

  const onMouseDown = (e: React.MouseEvent) => {
    startXRef.current = e.clientX
    startWRef.current = width
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }

  const onMouseMove = (e: MouseEvent) => {
    if (startXRef.current == null) return
    const delta = startXRef.current - e.clientX // dragging handle left reduces aside width
    const next = Math.min(max, Math.max(min, startWRef.current + delta))
    setWidth(next)
  }

  const onMouseUp = () => {
    startXRef.current = null
    window.removeEventListener("mousemove", onMouseMove)
    window.removeEventListener("mouseup", onMouseUp)
  }

  React.useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [])

  return (
    <aside
      className={cn("h-full border-l bg-background relative flex flex-col", collapsed && "hidden", className)}
      style={{ width }}
    >
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-accent"
        onMouseDown={onMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
      />
      <div className="p-3 border-b flex items-center justify-between">
        <div className="text-sm font-medium">Action Hub</div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(true)} title="Thu gọn">
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </aside>
  )
}

export function ExpandAsideButton({ onExpand }: { onExpand: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onExpand} className="gap-1">
      <ChevronRight className="h-4 w-4" /> Mở Action Hub
    </Button>
  )
}