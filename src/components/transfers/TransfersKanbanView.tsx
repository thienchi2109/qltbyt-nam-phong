import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TransfersKanbanColumn } from './TransfersKanbanColumn'
import {
  useTransfersKanban,
  useTransferColumnInfiniteScroll,
  useMergedColumnData,
} from '@/hooks/useTransferDataGrid'
import type {
  TransferListFilters,
  TransferListItem,
  TransferStatusCounts,
  TransferStatus,
} from '@/types/transfers-data-grid'
import { ACTIVE_TRANSFER_STATUSES } from '@/types/transfers-data-grid'

interface TransfersKanbanViewProps {
  filters: TransferListFilters
  onViewTransfer: (item: TransferListItem) => void
  renderRowActions: (item: TransferListItem) => React.ReactNode
  statusCounts: TransferStatusCounts | undefined
  /**
   * User role - determines if tenant selection is required before loading.
   * Global and regional_leader users must select a facility first.
   */
  userRole?: 'global' | 'regional_leader' | 'to_qltb' | 'technician' | 'user'
}

/**
 * Single column with integrated infinite scroll
 */
function KanbanColumnWithInfiniteScroll({
  status,
  filters,
  initialTasks,
  initialTotal,
  onViewTransfer,
  renderRowActions,
  referenceDate,
}: {
  status: TransferStatus
  filters: TransferListFilters
  initialTasks: TransferListItem[] | undefined
  initialTotal: number
  onViewTransfer: (item: TransferListItem) => void
  renderRowActions: (item: TransferListItem) => React.ReactNode
  referenceDate: Date
}) {
  const [infiniteScrollEnabled, setInfiniteScrollEnabled] = React.useState(false)

  // Track if we've done the initial fetch after enabling infinite scroll
  const didInitialFetchRef = React.useRef(false)

  // Create a stable key from filters to detect changes
  const filtersKey = React.useMemo(() => JSON.stringify(filters), [filters])

  // Reset infinite scroll state when filters change (prevents auto-fetching after filter change)
  React.useEffect(() => {
    setInfiniteScrollEnabled(false)
    didInitialFetchRef.current = false
  }, [filtersKey])

  // Infinite scroll for this specific column (disabled until user scrolls near bottom)
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTransferColumnInfiniteScroll(filters, status, infiniteScrollEnabled)

  // One-time fetch when infinite scroll is first enabled
  // This handles the case where user scrolls, we enable the query, but fetchNextPage
  // wasn't called because hasNextPage was undefined during the initial scroll trigger
  React.useEffect(() => {
    if (
      infiniteScrollEnabled &&
      hasNextPage &&
      !isFetchingNextPage &&
      !didInitialFetchRef.current
    ) {
      didInitialFetchRef.current = true
      fetchNextPage()
    }
  }, [infiniteScrollEnabled, hasNextPage, isFetchingNextPage, fetchNextPage])

  // Merge initial kanban data with infinite scroll pages
  const { tasks, hasMore, isLoadingMore } = useMergedColumnData(
    initialTasks,
    infiniteData?.pages,
    false
  )

  const handleLoadMore = React.useCallback(() => {
    // Enable infinite scroll on first trigger (loads page 2)
    if (!infiniteScrollEnabled) {
      setInfiniteScrollEnabled(true)
      return // useEffect above will handle the fetch once query is enabled
    }

    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [infiniteScrollEnabled, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <TransfersKanbanColumn
      status={status}
      tasks={tasks}
      total={initialTotal}
      hasMore={hasMore}
      onClickTask={onViewTransfer}
      renderActions={renderRowActions}
      onLoadMore={handleLoadMore}
      isLoadingMore={isFetchingNextPage}
      referenceDate={referenceDate}
    />
  )
}

export function TransfersKanbanView({
  filters,
  onViewTransfer,
  renderRowActions,
  statusCounts,
  userRole,
}: TransfersKanbanViewProps) {
  const [showCompleted, setShowCompleted] = React.useState(false)

  // Reference date for overdue calculation, refreshes every minute
  const [referenceDate, setReferenceDate] = React.useState(() => new Date())
  React.useEffect(() => {
    const interval = setInterval(() => {
      setReferenceDate(new Date())
    }, 60_000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  // Initial kanban load (30 items per column)
  // NOTE: Tenant selection check is handled by parent (page.tsx)
  // This component assumes data fetching is already authorized
  const { data, isLoading, isFetching } = useTransfersKanban(filters, {
    excludeCompleted: !showCompleted,
    perColumnLimit: 30,
    userRole,
  })

  const columns = data?.columns || {}

  // Columns to display
  const activeColumns: TransferStatus[] = ACTIVE_TRANSFER_STATUSES
  const allColumns = showCompleted
    ? ([...activeColumns, 'hoan_thanh'] as TransferStatus[])
    : activeColumns

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          Đang tải dữ liệu...
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header: Show Completed toggle */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCompleted(!showCompleted)}
        >
          {showCompleted ? 'Ẩn' : 'Hiện'} hoàn thành
        </Button>
      </div>

      {/* Kanban columns - horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-4 h-[calc(100vh-300px)]" style={{
        WebkitOverflowScrolling: 'touch'
      }}>
        {allColumns.map((status) => {
          // Handle empty columns: Backend may omit statuses with 0 items
          // Provide defaults to ensure all columns render correctly
          const columnData = columns[status] ?? { tasks: [], total: 0, hasMore: false }
          const initialTasks = columnData.tasks || []
          const initialTotal = columnData.total || 0

          return (
            <KanbanColumnWithInfiniteScroll
              key={status}
              status={status}
              filters={filters}
              initialTasks={initialTasks}
              initialTotal={initialTotal}
              onViewTransfer={onViewTransfer}
              renderRowActions={renderRowActions}
              referenceDate={referenceDate}
            />
          )
        })}
      </div>

      {/* Fetching indicator */}
      {isFetching && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang đồng bộ dữ liệu...
        </div>
      )}
    </div>
  )
}
