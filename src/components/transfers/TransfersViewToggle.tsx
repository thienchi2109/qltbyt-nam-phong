'use client'

import * as React from 'react'
import { LayoutGrid, Table } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { ViewMode } from '@/types/transfers-data-grid'

export function TransfersViewToggle() {
  const [view, setView] = useLocalStorage<ViewMode>(
    'transfers-view-mode',
    'table'
  )

  return (
    <div className="flex gap-1 rounded-lg border p-1">
      <Button
        variant={view === 'table' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => setView('table')}
        className="gap-2"
      >
        <Table className="size-4" />
        <span className="hidden sm:inline">Bảng</span>
      </Button>
      <Button
        variant={view === 'kanban' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => setView('kanban')}
        className="gap-2"
      >
        <LayoutGrid className="size-4" />
        <span className="hidden sm:inline">Kanban</span>
      </Button>
    </div>
  )
}

export function useTransfersViewMode() {
  return useLocalStorage<ViewMode>('transfers-view-mode', 'table')
}
