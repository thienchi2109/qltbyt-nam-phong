/**
 * add-tasks-dialog.tsx
 *
 * Dialog for adding equipment to a maintenance plan.
 * Uses shared SearchInput, FacetedMultiSelectFilter, and DataTablePagination.
 */

"use client"

import * as React from "react"
import type {
  ColumnDef,
  PaginationState,
  SortingState,
  Updater,
  VisibilityState,
} from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Loader2, FilterX, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAddTasksEquipment } from "@/hooks/useAddTasksEquipment"
import type { AddTasksEquipmentFilters } from "@/hooks/useAddTasksEquipment"
import type { Equipment, MaintenancePlan } from "@/lib/data"
import { ScrollArea } from "./ui/scroll-area"
import { useSearchDebounce } from "@/hooks/use-debounce"
import { SearchInput } from "@/components/shared/SearchInput"
import { FacetedMultiSelectFilter } from "@/components/shared/table-filters/FacetedMultiSelectFilter"
import { DataTablePagination } from "@/components/shared/DataTablePagination"

interface AddTasksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: MaintenancePlan | null
  existingEquipmentIds: number[]
  onSuccess: (selectedEquipment: Equipment[]) => void
}

interface AddTasksTableState {
  filters: AddTasksEquipmentFilters
  columnVisibility: VisibilityState
  pagination: PaginationState
  searchTerm: string
  sorting: SortingState
}

type AddTasksTableAction =
  | { type: "reset-dialog" }
  | { type: "set-column-visibility"; updater: Updater<VisibilityState> }
  | { type: "set-filter"; key: keyof AddTasksEquipmentFilters; values: string[] }
  | { type: "clear-filters" }
  | { type: "set-pagination"; updater: Updater<PaginationState> }
  | { type: "set-search-term"; value: string }
  | { type: "set-sorting"; updater: Updater<SortingState> }

const initialAddTasksTableState: AddTasksTableState = {
  filters: {
    departments: [],
    users: [],
    locations: [],
  },
  columnVisibility: {
    "nguoi_dang_truc_tiep_quan_ly": false,
    "vi_tri_lap_dat": false,
  },
  pagination: { pageIndex: 0, pageSize: 10 },
  searchTerm: "",
  sorting: [],
}

const DEFAULT_ADD_TASKS_SORT = "id.asc"

function resolveUpdater<T>(updater: Updater<T>, current: T): T {
  if (typeof updater !== "function") {
    return updater
  }

  return (updater as (old: T) => T)(current)
}

function addTasksTableReducer(
  state: AddTasksTableState,
  action: AddTasksTableAction,
): AddTasksTableState {
  switch (action.type) {
    case "reset-dialog":
      return {
        ...initialAddTasksTableState,
        filters: {
          departments: [],
          users: [],
          locations: [],
        },
        columnVisibility: { ...initialAddTasksTableState.columnVisibility },
        pagination: { ...initialAddTasksTableState.pagination },
        sorting: [...initialAddTasksTableState.sorting],
      }
    case "set-column-visibility":
      return { ...state, columnVisibility: resolveUpdater(action.updater, state.columnVisibility) }
    case "set-filter":
      return {
        ...state,
        filters: { ...state.filters, [action.key]: action.values },
        pagination: { ...state.pagination, pageIndex: 0 },
      }
    case "clear-filters":
      return {
        ...state,
        filters: {
          departments: [],
          users: [],
          locations: [],
        },
        pagination: { ...state.pagination, pageIndex: 0 },
      }
    case "set-pagination":
      return { ...state, pagination: resolveUpdater(action.updater, state.pagination) }
    case "set-search-term":
      return { ...state, searchTerm: action.value, pagination: { ...state.pagination, pageIndex: 0 } }
    case "set-sorting":
      return {
        ...state,
        sorting: resolveUpdater(action.updater, state.sorting),
        pagination: { ...state.pagination, pageIndex: 0 },
      }
  }
}

function getAddTasksSortParam(sorting: SortingState): string {
  const [primarySort] = sorting
  if (!primarySort) return DEFAULT_ADD_TASKS_SORT
  return `${primarySort.id}.${primarySort.desc ? "desc" : "asc"}`
}

/** Renders the dialog for adding available equipment to a maintenance plan. */
export function AddTasksDialog({
  open,
  onOpenChange,
  plan,
  existingEquipmentIds,
  onSuccess,
}: AddTasksDialogProps) {
  const [tableState, dispatchTable] = React.useReducer(
    addTasksTableReducer,
    initialAddTasksTableState,
  )
  const [selectedEquipmentById, setSelectedEquipmentById] = React.useState<Map<number, Equipment>>(
    () => new Map(),
  )

  const debouncedSearch = useSearchDebounce(tableState.searchTerm)
  const sortParam = React.useMemo(() => getAddTasksSortParam(tableState.sorting), [tableState.sorting])
  const planDonVi = plan?.don_vi ?? null
  const missingPlanTenant = open && plan !== null && planDonVi === null
  const existingEquipmentIdSet = React.useMemo(
    () => new Set(existingEquipmentIds),
    [existingEquipmentIds],
  )
  const {
    equipment,
    total,
    isLoading,
    isFetching,
    error,
    filterOptions,
  } = useAddTasksEquipment({
    open,
    planDonVi,
    search: debouncedSearch,
    pagination: tableState.pagination,
    sort: sortParam,
    filters: tableState.filters,
  })
  const selectedEquipment = React.useMemo(
    () => Array.from(selectedEquipmentById.values()),
    [selectedEquipmentById],
  )
  const rowSelection = React.useMemo(
    () => Object.fromEntries(
      equipment.flatMap((item) => selectedEquipmentById.has(item.id) ? [[String(item.id), true]] : []),
    ),
    [equipment, selectedEquipmentById],
  )
  const totalPages = Math.max(0, Math.ceil(total / tableState.pagination.pageSize))

  const columns: ColumnDef<Equipment>[] = React.useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            disabled={!table.getRowModel().rows.some(row => row.getCanSelect())}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            disabled={!row.getCanSelect()}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      { accessorKey: "ma_thiet_bi", header: "Mã thiết bị" },
      { accessorKey: "ten_thiet_bi", header: "Tên thiết bị" },
      { accessorKey: "model", header: "Model" },
      { accessorKey: "khoa_phong_quan_ly", header: "Khoa/Phòng" },
      { accessorKey: "nguoi_dang_truc_tiep_quan_ly", header: "Người quản lý" },
      { accessorKey: "vi_tri_lap_dat", header: "Vị trí lắp đặt" },
    ], [])

  const table = useReactTable({
    data: equipment,
    columns,
    getRowId: (row) => String(row.id),
    state: {
      sorting: tableState.sorting,
      rowSelection,
      columnVisibility: tableState.columnVisibility,
      pagination: tableState.pagination,
    },
    enableRowSelection: (row) => !existingEquipmentIdSet.has(row.original.id),
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    pageCount: totalPages,
    onRowSelectionChange: (updater) => {
      const nextRowSelection = resolveUpdater(updater, rowSelection)
      setSelectedEquipmentById((currentSelection) => {
        const nextSelection = new Map(currentSelection)
        for (const item of equipment) {
          if (existingEquipmentIdSet.has(item.id)) continue
          if (nextRowSelection[String(item.id)]) {
            nextSelection.set(item.id, item)
          } else {
            nextSelection.delete(item.id)
          }
        }
        return nextSelection
      })
    },
    onSortingChange: (updater) => dispatchTable({ type: "set-sorting", updater }),
    onColumnVisibilityChange: (updater) => dispatchTable({ type: "set-column-visibility", updater }),
    onPaginationChange: (updater) => dispatchTable({ type: "set-pagination", updater }),
    getCoreRowModel: getCoreRowModel(),
  })

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      dispatchTable({ type: "reset-dialog" })
      setSelectedEquipmentById(new Map())
    }
    onOpenChange(nextOpen)
  }

  const handleAdd = () => {
    if (selectedEquipment.length === 0) {
      return;
    }
    onSuccess(selectedEquipment);
    handleOpenChange(false);
  }

  const hasActiveFilters =
    tableState.filters.departments.length > 0 ||
    tableState.filters.users.length > 0 ||
    tableState.filters.locations.length > 0
  const isFiltered = hasActiveFilters || (debouncedSearch?.length ?? 0) > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Thêm thiết bị vào kế hoạch: {plan?.ten_ke_hoach}</DialogTitle>
          <DialogDescription>
            Chọn các thiết bị từ danh sách bên dưới để thêm vào kế hoạch. Các thiết bị đã có trong kế hoạch sẽ bị vô hiệu hóa.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow flex flex-col overflow-hidden gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <SearchInput
              placeholder="Tìm kiếm chung..."
              value={tableState.searchTerm}
              onChange={(value) => dispatchTable({ type: "set-search-term", value })}
              showSearchIcon={false}
              className="h-8 w-[150px] lg:w-[250px]"
            />
            <FacetedMultiSelectFilter
              title="Khoa/Phòng"
              options={filterOptions.departments}
              value={tableState.filters.departments}
              onChange={(values) => dispatchTable({ type: "set-filter", key: "departments", values })}
            />
            <FacetedMultiSelectFilter
              title="Người quản lý"
              options={filterOptions.users}
              value={tableState.filters.users}
              onChange={(values) => dispatchTable({ type: "set-filter", key: "users", values })}
            />
            <FacetedMultiSelectFilter
              title="Vị trí"
              options={filterOptions.locations}
              value={tableState.filters.locations}
              onChange={(values) => dispatchTable({ type: "set-filter", key: "locations", values })}
            />
            {isFiltered && (
              <Button
                variant="ghost"
                onClick={() => {
                  dispatchTable({ type: "clear-filters" })
                  dispatchTable({ type: "set-search-term", value: "" })
                }}
                className="h-8 px-2 lg:px-3"
              >
                Xóa bộ lọc
                <FilterX className="ml-2 size-4" />
              </Button>
            )}
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-8 gap-1">
                    Cột
                    <ChevronDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px]">
                  <DropdownMenuLabel>Hiện/Ẩn cột</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table
                    .getAllColumns()
                    .flatMap((column) => {
                      if (!column.getCanHide()) return []
                      const header = (column.columnDef.header as string) || column.id;
                      return [(
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          className="capitalize"
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) =>
                            column.toggleVisibility(!!value)
                          }
                          onSelect={(e) => e.preventDefault()}
                        >
                          {header}
                        </DropdownMenuCheckboxItem>
                      )]
                    })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex-grow rounded-md border overflow-hidden">
            <ScrollArea className="h-full">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {missingPlanTenant ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center text-destructive">
                        Không xác định được đơn vị của kế hoạch.
                      </TableCell>
                    </TableRow>
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center text-destructive">
                        Không thể tải thiết bị: {error.message}
                      </TableCell>
                    </TableRow>
                  ) : isLoading ? (
		                    <TableRow>
		                      <TableCell colSpan={columns.length} className="h-24 text-center">
		                        <Loader2 className="mx-auto size-6 animate-spin" />
		                      </TableCell>
                    </TableRow>
                  ) : table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className={cn(!row.getCanSelect() && "bg-muted/50 text-muted-foreground")}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        Không tìm thấy kết quả phù hợp
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Đã chọn {selectedEquipment.length} trên {total} thiết bị phù hợp.
            </div>
            <DataTablePagination
              table={table}
              totalCount={total}
              entity={{ singular: "thiết bị" }}
              paginationMode={{
                mode: "server",
                currentPage: tableState.pagination.pageIndex + 1,
                totalPages,
                pageSize: tableState.pagination.pageSize,
                onPageChange: (page) => {
                  dispatchTable({
                    type: "set-pagination",
                    updater: (current) => ({ ...current, pageIndex: Math.max(0, page - 1) }),
                  })
                },
                onPageSizeChange: (pageSize) => {
                  dispatchTable({
                    type: "set-pagination",
                    updater: { pageIndex: 0, pageSize },
                  })
                },
              }}
              pageSizeOptions={[10, 20, 50]}
              isLoading={isFetching}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleAdd} disabled={selectedEquipment.length === 0}>
            Thêm {selectedEquipment.length > 0 ? `${selectedEquipment.length} thiết bị` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
