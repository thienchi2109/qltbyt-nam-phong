// @ts-expect-error DataTablePagination barrel should not re-export internal pagination types.
import type { DataTablePaginationProps } from '@/components/shared/DataTablePagination'
// @ts-expect-error DataTablePagination barrel should not re-export internal pagination types.
import type { EntityLabels } from '@/components/shared/DataTablePagination'
// @ts-expect-error DataTablePagination barrel should not re-export internal pagination types.
import type { DisplayFormat } from '@/components/shared/DataTablePagination'
// @ts-expect-error DataTablePagination barrel should not re-export internal pagination types.
import type { PaginationMode } from '@/components/shared/DataTablePagination'
// @ts-expect-error DataTablePagination barrel should not re-export internal pagination types.
import type { ResponsiveConfig } from '@/components/shared/DataTablePagination'
// @ts-expect-error DataTablePagination barrel should not re-export internal pagination types.
import type { DisplayContext } from '@/components/shared/DataTablePagination'

type _GuardBarrelTypeUsage = [
  DataTablePaginationProps<unknown>,
  EntityLabels,
  DisplayFormat,
  PaginationMode,
  ResponsiveConfig,
  DisplayContext,
]

void (0 as unknown as _GuardBarrelTypeUsage | undefined)
