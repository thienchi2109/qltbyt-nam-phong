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
import { Building2 } from 'lucide-react'

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
  onViewTransfer,
  renderRowActions,
}: {
  status: TransferStatus
  filters: TransferListFilters
  initialTasks: TransferListItem[] | undefined
  onViewTransfer: (item: TransferListItem) => void
  renderRowActions: (item: TransferListItem) => React.ReactNode
}) {
  const [infiniteScrollEnabled, setInfiniteScrollEnabled] = React.useState(false)

  // Infinite scroll for this specific column (disabled until user scrolls near bottom)
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTransferColumnInfiniteScroll(filters, status, infiniteScrollEnabled)

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
    }

    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [infiniteScrollEnabled, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <TransfersKanbanColumn
      status={status}
      tasks={tasks}
      total={tasks.length} // Approximate (we don't have exact total for infinite scroll)
      hasMore={hasMore}
      onClickTask={onViewTransfer}
      renderActions={renderRowActions}
      onLoadMore={handleLoadMore}
      isLoadingMore={isFetchingNextPage}
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

  // Check if multi-tenant user needs to select a facility first
  const isMultiTenantUser = userRole === 'global' || userRole === 'regional_leader'
  const hasTenantSelected = !!filters.facilityId
  const requiresTenantSelection = isMultiTenantUser && !hasTenantSelected

  // Initial kanban load (30 items per column)
  // For multi-tenant users, this won't fetch until facilityId is set
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

  // Multi-tenant users must select a facility before viewing Kanban
  if (requiresTenantSelection) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="space-y-2">
            <h3 className="font-medium text-lg">Chọn cơ sở y tế</h3>
            <p className="text-sm text-muted-foreground">
              Vui lòng chọn một cơ sở y tế từ bộ lọc phía trên để xem bảng Kanban.
              Điều này giúp tránh tải dữ liệu lớn từ nhiều cơ sở cùng lúc.
            </p>
          </div>
        </div>
      </div>
    )
  }

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

          return (
            <KanbanColumnWithInfiniteScroll
              key={status}
              status={status}
              filters={filters}
              initialTasks={initialTasks}
              onViewTransfer={onViewTransfer}
              renderRowActions={renderRowActions}
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
