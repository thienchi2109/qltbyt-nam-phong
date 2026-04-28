'use client'

import * as React from 'react'

import { Sheet, SheetContent } from '@/components/ui/sheet'

interface LinkedRequestSheetShellProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function LinkedRequestSheetShell({
  open,
  onClose,
  children,
}: LinkedRequestSheetShellProps) {
  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0">
        {children}
      </SheetContent>
    </Sheet>
  )
}
