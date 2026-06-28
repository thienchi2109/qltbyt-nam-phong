/**
 * add-tasks-dialog.tsx
 *
 * Dialog for adding equipment to a maintenance plan.
 * Uses shared SearchInput, FacetedMultiSelectFilter, and DataTablePagination.
 */

"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"

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
import { useAddTasksEquipment } from "@/hooks/useAddTasksEquipment"
import type { Equipment, MaintenancePlan } from "@/lib/data"
import { useSearchDebounce } from "@/hooks/use-debounce"
import { DataTablePagination } from "@/components/shared/DataTablePagination"

import { AddTasksEquipmentTable } from "./add-tasks-dialog-table"
import {
  addTasksTableReducer,
  getAddTasksSortParam,
  initialAddTasksTableState,
  resolveUpdater,
} from "./add-tasks-dialog.table-state"
import { AddTasksDialogToolbar } from "./add-tasks-dialog-toolbar"

interface AddTasksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: MaintenancePlan | null
  existingEquipmentIds: number[]
  onSuccess: (selectedEquipment: Equipment[]) => void
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
          <AddTasksDialogToolbar
            table={table}
            tableState={tableState}
            filterOptions={filterOptions}
            isFiltered={isFiltered}
            dispatchTable={dispatchTable}
          />
          <AddTasksEquipmentTable
            table={table}
            columnCount={columns.length}
            missingPlanTenant={missingPlanTenant}
            isLoading={isLoading}
            error={error}
          />
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
