import { DataTablePaginationMain } from "./DataTablePagination"
import { DataTablePaginationInfo } from "./DataTablePaginationInfo"
import { DataTablePaginationNavigation } from "./DataTablePaginationNavigation"
import { DataTablePaginationSizeSelector } from "./DataTablePaginationSizeSelector"

export const DataTablePagination = Object.assign(DataTablePaginationMain, {
  Info: DataTablePaginationInfo,
  SizeSelector: DataTablePaginationSizeSelector,
  Navigation: DataTablePaginationNavigation,
})

export type {
  DataTablePaginationProps,
  EntityLabels,
  DisplayFormat,
  PaginationMode,
  ResponsiveConfig,
  DisplayContext,
} from "./types"
