import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader2 } from 'lucide-react'
import { TransfersKanbanCard } from './TransfersKanbanCard'
import type { TransferListItem, TransferStatus } from '@/types/transfers-data-grid'
import { TRANSFER_STATUS_LABELS } from '@/types/transfers-data-grid'

interface TransfersKanbanColumnProps {
  status: TransferStatus
  tasks: TransferListItem[]
  total: number
  hasMore: boolean
  onClickTask: (task: TransferListItem) => void
  renderActions: (task: TransferListItem) => React.ReactNode
  onLoadMore?: () => void
  isLoadingMore?: boolean
  /** Current date for overdue calculation - should refresh periodically */
  referenceDate: Date
}

export function TransfersKanbanColumn({
  status,
  tasks,
  total,
  hasMore,
  onClickTask,
  renderActions,
  onLoadMore,
  isLoadingMore = false,
  referenceDate,
}: TransfersKanbanColumnProps) {
  const parentRef = React.useRef<HTMLDivElement>(null)

  // Use ref to avoid onLoadMore in useEffect deps (prevents infinite loops)
  const onLoadMoreRef = React.useRef(onLoadMore)
  React.useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  }, [onLoadMore])

  // Virtual scrolling with dynamic height measurement
  const rowVirtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140, // Base estimate
    overscan: 5, // Render 5 extra cards for smooth scrolling
    // Enable dynamic measurement to prevent scroll jitter
    measureElement: (element) => element?.getBoundingClientRect().height ?? 140,
  })

  // Infinite scroll detection
  const virtualItems = rowVirtualizer.getVirtualItems()
  const lastItemIndex = virtualItems[virtualItems.length - 1]?.index

  React.useEffect(() => {
    if (
      lastItemIndex !== undefined &&
      lastItemIndex >= tasks.length - 3 &&
      hasMore &&
      onLoadMoreRef.current &&
      !isLoadingMore
    ) {
      onLoadMoreRef.current()
    }
  }, [lastItemIndex, tasks.length, hasMore, isLoadingMore])

  return (
    <div className="flex flex-col w-80 min-w-[320px] bg-sidebar rounded-lg border shrink-0">
      {/* Header */}
      <div className="p-3 border-b shrink-0">
        <h3 className="font-medium text-sm">
          {TRANSFER_STATUS_LABELS[status]}
        </h3>
        <span className="text-xs text-muted-foreground">
          {tasks.length} / {total}
        </span>
      </div>

      {/* Virtual scroll container */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2"
        style={{ height: '100%' }}
      >
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground py-12">
            <p>Không có yêu cầu</p>
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualRow) => {
              const task = tasks[virtualRow.index]
              if (!task) return null

              return (
                <div
                  key={task.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <TransfersKanbanCard
                    transfer={task}
                    onClick={onClickTask}
                    actions={renderActions(task)}
                    referenceDate={referenceDate}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Loading more indicator */}
        {isLoadingMore && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Đang tải thêm...</span>
          </div>
        )}
      </div>
    </div>
  )
}
