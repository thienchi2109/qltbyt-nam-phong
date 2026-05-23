"use client"

import * as React from "react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type SheetSide = "top" | "bottom" | "left" | "right"

interface SideSheetShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  side?: SheetSide
  contentClassName?: string
  headerClassName?: string
  bodyClassName?: string
  footerClassName?: string
}

/**
 * Shared right-side sheet presentation shell for feature-owned dialog content.
 */
export function SideSheetShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = "right",
  contentClassName,
  headerClassName,
  bodyClassName,
  footerClassName,
}: SideSheetShellProps) {
  const hasHeader = title !== null && title !== undefined

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={cn("w-full p-0", contentClassName)}>
        <div className="flex h-full flex-col">
          {hasHeader ? (
            <SheetHeader className={cn("border-b p-4", headerClassName)}>
              <SheetTitle>{title}</SheetTitle>
              {description ? <SheetDescription>{description}</SheetDescription> : null}
            </SheetHeader>
          ) : null}
          <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
          {footer ? <div className={cn("border-t p-4", footerClassName)}>{footer}</div> : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
