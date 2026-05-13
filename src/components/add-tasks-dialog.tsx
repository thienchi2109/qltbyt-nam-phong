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
  ColumnFiltersState,
  PaginationState,
  RowSelectionState,
  SortingState,
  Updater,
  VisibilityState,
} from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
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
  columnFilters: ColumnFiltersState
  columnVisibility: VisibilityState
  pagination: PaginationState
  rowSelection: RowSelectionState
  searchTerm: string
  sorting: SortingState
}

type AddTasksTableAction =
  | { type: "reset-dialog" }
  | { type: "set-column-filters"; updater: Updater<ColumnFiltersState> }
  | { type: "set-column-visibility"; updater: Updater<VisibilityState> }
  | { type: "set-pagination"; updater: Updater<PaginationState> }
  | { type: "set-row-selection"; updater: Updater<RowSelectionState> }
  | { type: "set-search-term"; value: string }
  | { type: "set-sorting"; updater: Updater<SortingState> }

const initialAddTasksTableState: AddTasksTableState = {
  columnFilters: [],
  columnVisibility: {
    "nguoi_dang_truc_tiep_quan_ly": false,
    "vi_tri_lap_dat": false,
  },
  pagination: { pageIndex: 0, pageSize: 10 },
  rowSelection: {},
  searchTerm: "",
  sorting: [],
}

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
        columnFilters: [...initialAddTasksTableState.columnFilters],
        columnVisibility: { ...initialAddTasksTableState.columnVisibility },
        pagination: { ...initialAddTasksTableState.pagination },
        rowSelection: { ...initialAddTasksTableState.rowSelection },
        sorting: [...initialAddTasksTableState.sorting],
      }
    case "set-column-filters":
      return { ...state, columnFilters: resolveUpdater(action.updater, state.columnFilters) }
    case "set-column-visibility":
      return { ...state, columnVisibility: resolveUpdater(action.updater, state.columnVisibility) }
    case "set-pagination":
      return { ...state, pagination: resolveUpdater(action.updater, state.pagination) }
    case "set-row-selection":
      return { ...state, rowSelection: resolveUpdater(action.updater, state.rowSelection) }
    case "set-search-term":
      return { ...state, searchTerm: action.value }
    case "set-sorting":
      return { ...state, sorting: resolveUpdater(action.updater, state.sorting) }
  }
}

function getUniqueTrimmedValues(equipment: Equipment[], key: keyof Equipment) {
  return Array.from(new Set(
    equipment.flatMap((item) => {
      const value = item[key]
      if (typeof value !== "string") return []
      const trimmed = value.trim()
      return trimmed ? [trimmed] : []
    }),
  ))
}

export function AddTasksDialog({
  open,
  onOpenChange,
  plan,
  existingEquipmentIds,
  onSuccess,
}: AddTasksDialogProps) {
  const { data, isLoading, error } = useAddTasksEquipment(open)
  const equipment = data ?? []
  const [tableState, dispatchTable] = React.useReducer(
    addTasksTableReducer,
    initialAddTasksTableState,
  )

  const debouncedSearch = useSearchDebounce(tableState.searchTerm)

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
      {
        accessorKey: "khoa_phong_quan_ly",
        header: "Khoa/Phòng",
        filterFn: (row, id, value) => {
          const rowValue = row.getValue(id) as string | null
          return rowValue ? value.includes(rowValue.trim()) : false
        },
      },
      {
        accessorKey: "nguoi_dang_truc_tiep_quan_ly",
        header: "Người quản lý",
        filterFn: (row, id, value) => {
          const rowValue = row.getValue(id) as string | null
          return rowValue ? value.includes(rowValue.trim()) : false
        },
      },
      {
        accessorKey: "vi_tri_lap_dat",
        header: "Vị trí lắp đặt",
        filterFn: (row, id, value) => {
          const rowValue = row.getValue(id) as string | null
          return rowValue ? value.includes(rowValue.trim()) : false
        },
      },
    ], [])

  const table = useReactTable({
    data: equipment,
    columns,
    state: {
      sorting: tableState.sorting,
      columnFilters: tableState.columnFilters,
      globalFilter: debouncedSearch,
      rowSelection: tableState.rowSelection,
      columnVisibility: tableState.columnVisibility,
      pagination: tableState.pagination,
    },
    enableRowSelection: (row) => !existingEquipmentIds.includes(row.original.id),
    onRowSelectionChange: (updater) => dispatchTable({ type: "set-row-selection", updater }),
    onSortingChange: (updater) => dispatchTable({ type: "set-sorting", updater }),
    onColumnFiltersChange: (updater) => dispatchTable({ type: "set-column-filters", updater }),
    onColumnVisibilityChange: (updater) => dispatchTable({ type: "set-column-visibility", updater }),
    onPaginationChange: (updater) => dispatchTable({ type: "set-pagination", updater }),
    onGlobalFilterChange: (value: string) => dispatchTable({ type: "set-search-term", value }),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      dispatchTable({ type: "reset-dialog" })
    }
    onOpenChange(nextOpen)
  }

  const handleAdd = () => {
    const selectedEquipment = table.getFilteredSelectedRowModel().rows.map(row => row.original);
    if (selectedEquipment.length === 0) {
      return;
    }
    onSuccess(selectedEquipment);
    handleOpenChange(false);
  }

  const departments = React.useMemo(() => getUniqueTrimmedValues(equipment, "khoa_phong_quan_ly"), [equipment])
  const users = React.useMemo(() => getUniqueTrimmedValues(equipment, "nguoi_dang_truc_tiep_quan_ly"), [equipment])
  const locations = React.useMemo(() => getUniqueTrimmedValues(equipment, "vi_tri_lap_dat"), [equipment])

  const isFiltered = table.getState().columnFilters.length > 0 || (debouncedSearch?.length ?? 0) > 0;

  const totalSelectableRows = React.useMemo(
    () => table.getFilteredRowModel().rows.filter(row => row.getCanSelect()).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [equipment, tableState.columnFilters, existingEquipmentIds, debouncedSearch]
  );

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
              column={table.getColumn("khoa_phong_quan_ly")}
              title="Khoa/Phòng"
              options={departments.map(d => ({ label: d, value: d }))}
            />
            <FacetedMultiSelectFilter
              column={table.getColumn("nguoi_dang_truc_tiep_quan_ly")}
              title="Người quản lý"
              options={users.map(u => ({ label: u, value: u }))}
            />
            <FacetedMultiSelectFilter
              column={table.getColumn("vi_tri_lap_dat")}
              title="Vị trí"
              options={locations.map(l => ({ label: l, value: l }))}
            />
            {isFiltered && (
              <Button
                variant="ghost"
                onClick={() => {
                  table.resetColumnFilters();
                  dispatchTable({ type: "set-search-term", value: "" });
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
                  {error ? (
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
              Đã chọn {table.getFilteredSelectedRowModel().rows.length} trên{" "}
              {totalSelectableRows} thiết bị (có thể thêm).
            </div>
            <DataTablePagination
              table={table}
              totalCount={table.getFilteredRowModel().rows.length}
              entity={{ singular: "thiết bị" }}
              pageSizeOptions={[10, 20, 50]}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleAdd} disabled={table.getFilteredSelectedRowModel().rows.length === 0}>
            Thêm {table.getFilteredSelectedRowModel().rows.length > 0 ? `${table.getFilteredSelectedRowModel().rows.length} thiết bị` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
