import * as React from 'react'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
import { ACTIVE_TRANSFER_STATUSES, TRANSFER_STATUS_LABELS } from '@/types/transfers-data-grid'

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
  // Mobile: track selected status tab
  const [mobileSelectedStatus, setMobileSelectedStatus] = React.useState<TransferStatus>('cho_duyet')

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

  // Mobile navigation helpers
  const currentMobileIndex = allColumns.indexOf(mobileSelectedStatus)
  const canGoPrev = currentMobileIndex > 0
  const canGoNext = currentMobileIndex < allColumns.length - 1

  const goToPrevColumn = React.useCallback(() => {
    if (canGoPrev) {
      setMobileSelectedStatus(allColumns[currentMobileIndex - 1])
    }
  }, [canGoPrev, allColumns, currentMobileIndex])

  const goToNextColumn = React.useCallback(() => {
    if (canGoNext) {
      setMobileSelectedStatus(allColumns[currentMobileIndex + 1])
    }
  }, [canGoNext, allColumns, currentMobileIndex])

  // Reset mobile selection if current status is no longer in columns
  React.useEffect(() => {
    if (!allColumns.includes(mobileSelectedStatus)) {
      setMobileSelectedStatus(allColumns[0])
    }
  }, [allColumns, mobileSelectedStatus])

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

      {/* Mobile: Status tabs with swipe navigation */}
      <div className="lg:hidden">
        {/* Status tab bar */}
        <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-2 -mx-1 px-1">
          {allColumns.map((status) => {
            const columnData = columns[status] ?? { tasks: [], total: 0 }
            const count = columnData.total || 0
            const isActive = status === mobileSelectedStatus
            
            return (
              <button
                key={status}
                onClick={() => setMobileSelectedStatus(status)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                  "border shrink-0",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{TRANSFER_STATUS_LABELS[status]}</span>
                <span className={cn(
                  "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold",
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Navigation arrows + single column */}
        <div className="relative">
          {/* Left arrow */}
          <button
            onClick={goToPrevColumn}
            disabled={!canGoPrev}
            className={cn(
              "absolute left-0 top-1/2 -translate-y-1/2 z-10",
              "w-8 h-8 rounded-full bg-background/80 backdrop-blur border shadow-sm",
              "flex items-center justify-center transition-opacity",
              canGoPrev ? "opacity-100 hover:bg-muted" : "opacity-0 pointer-events-none"
            )}
            aria-label="Cột trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Right arrow */}
          <button
            onClick={goToNextColumn}
            disabled={!canGoNext}
            className={cn(
              "absolute right-0 top-1/2 -translate-y-1/2 z-10",
              "w-8 h-8 rounded-full bg-background/80 backdrop-blur border shadow-sm",
              "flex items-center justify-center transition-opacity",
              canGoNext ? "opacity-100 hover:bg-muted" : "opacity-0 pointer-events-none"
            )}
            aria-label="Cột sau"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Single column for mobile - full width */}
          <div className="min-h-[calc(100vh-380px)]">
            {(() => {
              const columnData = columns[mobileSelectedStatus] ?? { tasks: [], total: 0, hasMore: false }
              return (
                <KanbanColumnWithInfiniteScroll
                  key={mobileSelectedStatus}
                  status={mobileSelectedStatus}
                  filters={filters}
                  initialTasks={columnData.tasks || []}
                  initialTotal={columnData.total || 0}
                  onViewTransfer={onViewTransfer}
                  renderRowActions={renderRowActions}
                  referenceDate={referenceDate}
                />
              )
            })()}
          </div>

          {/* Dot indicators */}
          <div className="flex justify-center gap-1.5 mt-3">
            {allColumns.map((status, index) => (
              <button
                key={status}
                onClick={() => setMobileSelectedStatus(status)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === currentMobileIndex
                    ? "bg-primary w-4"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
                aria-label={TRANSFER_STATUS_LABELS[status]}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Desktop: Horizontal kanban columns */}
      <div className="hidden lg:flex gap-3 overflow-x-auto pb-4 h-[calc(100vh-300px)]" style={{
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
