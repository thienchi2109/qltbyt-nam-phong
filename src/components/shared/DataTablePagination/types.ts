import type * as React from "react"
import type { RowData, Table } from "@tanstack/react-table"

// ============================================================================
// Display Types
// ============================================================================

export type DisplayFormat =
  | "count-total" // "X tren Y thiet bi"
  | "range-total" // "X-Y tren tong Z yeu cau"
  | "selection-count" // "Da chon X tren Y cong viec"
  | "compact" // "X / Y" (mobile)

export interface DisplayContext {
  startItem: number
  endItem: number
  totalCount: number
  currentPage: number
  totalPages: number
  selectedCount?: number
  entity: EntityLabels
}

export interface EntityLabels {
  singular: string // "thiet bi", "yeu cau", "ke hoach", "cong viec"
  plural?: string // Optional, defaults to singular
}

// ============================================================================
// Pagination Mode Types (Discriminated Unions)
// ============================================================================

/** Mode 1: TanStack Table manages state internally (default when paginationMode is omitted) */
interface TanStackManagedMode {
  mode: "tanstack"
}

/** Mode 2: External controlled pagination (0-based) */
interface ControlledMode {
  mode: "controlled"
  pagination: { pageIndex: number; pageSize: number }
  onPaginationChange: (pagination: { pageIndex: number; pageSize: number }) => void
}

/** Mode 3: Server-side pagination (1-based) */
interface ServerMode {
  mode: "server"
  currentPage: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export type PaginationMode = TanStackManagedMode | ControlledMode | ServerMode

// ============================================================================
// Responsive Configuration
// ============================================================================

export interface ResponsiveConfig {
  /** Breakpoint to show first/last nav buttons (default: "sm") */
  showFirstLastAt?: "sm" | "md" | "lg"
  /** Breakpoint to show page size selector, null = always show (default: null) */
  showSizeSelectorAt?: "sm" | "md" | "lg" | null
  /** Breakpoint to stack layout vertically (default: "sm") */
  stackLayoutAt?: "sm" | "md" | "lg"
}

// ============================================================================
// Main Component Props
// ============================================================================

export interface DataTablePaginationProps<TData extends RowData> {
  // Required
  table: Table<TData>
  totalCount: number
  entity: EntityLabels

  // Pagination control (discriminated union)
  // Omit paginationMode to use TanStack internal state
  paginationMode?: PaginationMode

  // Display options
  displayFormat?: DisplayFormat | ((ctx: DisplayContext) => React.ReactNode)
  showFilteredIndicator?: boolean
  isFiltered?: boolean

  // Configuration
  pageSizeOptions?: number[]
  responsive?: ResponsiveConfig

  // State
  isLoading?: boolean
  disabled?: boolean
  enabled?: boolean

  // Extra content slots
  slots?: {
    beforeInfo?: React.ReactNode
    afterInfo?: React.ReactNode
    beforeNav?: React.ReactNode
    afterNav?: React.ReactNode
  }

  // Accessibility
  ariaLabels?: {
    firstPage?: string // default: "Den trang dau"
    prevPage?: string // default: "Trang truoc"
    nextPage?: string // default: "Trang tiep"
    lastPage?: string // default: "Den trang cuoi"
  }

  // Styling
  className?: string
}

// ============================================================================
// Hook Types
// ============================================================================

export interface UsePaginationStateOptions {
  initialPageSize?: number
  initialPageIndex?: number
  totalCount: number
  /** Simple key for reset - changes trigger reset to page 0 */
  resetKey?: string | number
}

export interface UsePaginationStateReturn {
  pagination: { pageIndex: number; pageSize: number }
  setPagination: React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>
  pageCount: number
  /** 1-based page for display */
  displayPage: number
  resetToFirstPage: () => void
  setPageSize: (size: number) => void
  /** Navigate to 1-based page number */
  goToPage: (page: number) => void
  canPreviousPage: boolean
  canNextPage: boolean
}
