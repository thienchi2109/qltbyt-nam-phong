"use client"

import * as React from "react"
import { List, type ListImperativeAPI, type RowComponentProps } from "react-window"
import AutoSizer from "react-virtualized-auto-sizer"
import type { TransferKanbanItem } from "@/types/transfer-kanban"
import type { DensityMode } from "./DensityToggle"

interface VirtualizedKanbanColumnProps {
  transfers: TransferKanbanItem[]
  density: DensityMode
  renderCard: (transfer: TransferKanbanItem, index: number) => React.ReactNode
  onScroll?: (scrollTop: number) => void
}

export function VirtualizedKanbanColumn({
  transfers,
  density,
  renderCard,
  onScroll,
}: VirtualizedKanbanColumnProps) {
  const listRef = React.useRef<ListImperativeAPI | null>(null)

  // Row component for virtualized list
  const RowComponent = React.useCallback(
    ({ index, style }: RowComponentProps) => (
      <div style={style}>
        {renderCard(transfers[index], index)}
      </div>
    ),
    [transfers, renderCard]
  )

  if (transfers.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        Không có yêu cầu nào
      </div>
    )
  }

  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          listRef={listRef}
          rowCount={transfers.length}
          rowHeight={density === "compact" ? 88 : 168}
          defaultHeight={height}
          overscanCount={5}
          rowComponent={RowComponent}
          rowProps={{}}
          style={{ width }}
        />
      )}
    </AutoSizer>
  )
}
