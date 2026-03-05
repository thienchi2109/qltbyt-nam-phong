/**
 * add-tasks-dialog.tsx
 *
 * Dialog for adding equipment to a maintenance plan.
 * Uses shared SearchInput, FacetedMultiSelectFilter, and DataTablePagination.
 */

"use client"

import * as React from "react"
import type { ColumnDef, ColumnFiltersState, SortingState, VisibilityState } from "@tanstack/react-table"
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
import { useToast } from "@/hooks/use-toast"
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

export function AddTasksDialog({
  open,
  onOpenChange,
  plan,
  existingEquipmentIds,
  onSuccess,
}: AddTasksDialogProps) {
  const { toast } = useToast()
  const { data, isLoading, error } = useAddTasksEquipment(open)
  const equipment = data ?? []
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Show toast on fetch error
  React.useEffect(() => {
    if (error) {
      toast({ variant: "destructive", title: "Lỗi tải thiết bị", description: error.message })
    }
  }, [error, toast])

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const debouncedSearch = useSearchDebounce(searchTerm)
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    "nguoi_dang_truc_tiep_quan_ly": false,
    "vi_tri_lap_dat": false,
  })

  // Reset table state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setRowSelection({})
      setSearchTerm("")
      setColumnFilters([])
    }
  }, [open])

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
      sorting,
      columnFilters,
      globalFilter: debouncedSearch,
      rowSelection,
      columnVisibility,
    },
    enableRowSelection: (row) => !existingEquipmentIds.includes(row.original.id),
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: (value: string) => setSearchTerm(value),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const handleAdd = () => {
    setIsSubmitting(true);
    const selectedEquipment = table.getFilteredSelectedRowModel().rows.map(row => row.original);
    if (selectedEquipment.length === 0) {
      toast({
        variant: "destructive",
        title: "Chưa chọn thiết bị",
        description: "Vui lòng chọn ít nhất một thiết bị để thêm.",
      });
      setIsSubmitting(false);
      return;
    }
    onSuccess(selectedEquipment);
    onOpenChange(false);
    setIsSubmitting(false);
  }

  const departments = React.useMemo(() => Array.from(new Set(equipment.map((item) => item.khoa_phong_quan_ly?.trim()).filter(Boolean))), [equipment])
  const users = React.useMemo(() => Array.from(new Set(equipment.map((item) => item.nguoi_dang_truc_tiep_quan_ly?.trim()).filter(Boolean))), [equipment])
  const locations = React.useMemo(() => Array.from(new Set(equipment.map((item) => item.vi_tri_lap_dat?.trim()).filter(Boolean))), [equipment])

  const isFiltered = table.getState().columnFilters.length > 0 || (debouncedSearch?.length ?? 0) > 0;

  const totalSelectableRows = React.useMemo(
    () => table.getFilteredRowModel().rows.filter(row => row.getCanSelect()).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [equipment.length, columnFilters, existingEquipmentIds, debouncedSearch]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              value={searchTerm}
              onChange={setSearchTerm}
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
                  setSearchTerm("");
                }}
                className="h-8 px-2 lg:px-3"
              >
                Xóa bộ lọc
                <FilterX className="ml-2 h-4 w-4" />
              </Button>
            )}
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-8 gap-1">
                    Cột
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px]">
                  <DropdownMenuLabel>Hiện/Ẩn cột</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => {
                      const header = (column.columnDef.header as string) || column.id;
                      return (
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
                      )
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
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleAdd} disabled={isSubmitting || table.getFilteredSelectedRowModel().rows.length === 0}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Thêm {table.getFilteredSelectedRowModel().rows.length > 0 ? `${table.getFilteredSelectedRowModel().rows.length} thiết bị` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
