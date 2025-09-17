
"use client"

import * as React from "react"
import type { Column, ColumnDef, ColumnFiltersState, SortingState, VisibilityState } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Loader2, PlusCircle, FilterX, ChevronDown } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import type { Equipment, MaintenancePlan } from "@/lib/data"
import { ScrollArea } from "./ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useSearchDebounce } from "@/hooks/use-debounce"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>
  title?: string
  options: {
    label: string
    value: string
  }[]
}

function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const selectedValues = new Set(column?.getFilterValue() as string[])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <PlusCircle className="mr-2 h-4 w-4" />
          {title}
          {selectedValues?.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedValues.size} đã chọn
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={option.value}
                        className="rounded-sm px-1 font-normal"
                      >
                        <span className="truncate max-w-[100px]">{option.label}</span>
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]" align="start">
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => {
          const isSelected = selectedValues.has(option.value)
          return (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={isSelected}
              onCheckedChange={(checked) => {
                if (checked) {
                  selectedValues.add(option.value)
                } else {
                  selectedValues.delete(option.value)
                }
                const filterValues = Array.from(selectedValues)
                column?.setFilterValue(
                  filterValues.length ? filterValues : undefined
                )
              }}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="truncate">{option.label}</span>
            </DropdownMenuCheckboxItem>
          )
        })}
        {selectedValues.size > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => column?.setFilterValue(undefined)}
              className="justify-center text-center"
            >
              Xóa bộ lọc
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

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
  const [equipment, setEquipment] = React.useState<Equipment[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

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

  React.useEffect(() => {
    if (open) {
      const fetchEquipment = async () => {
        setIsLoading(true)
        try {
          const eq = await callRpc<any[]>({ fn: 'equipment_list', args: { p_q: null, p_sort: 'id.asc', p_page: 1, p_page_size: 5000 } })
          setEquipment((eq || []) as Equipment[])
        } catch (error: any) {
          toast({ variant: "destructive", title: "Lỗi tải thiết bị", description: error.message })
          setEquipment([])
        }
        setIsLoading(false)
      }
      fetchEquipment()
    } else {
        setRowSelection({})
        setSearchTerm("")
        setColumnFilters([])
    }
  }, [open, toast])

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
    [table]
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
                <Input
                    placeholder="Tìm kiếm chung..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="h-8 w-[150px] lg:w-[250px]"
                />
                <DataTableFacetedFilter
                    column={table.getColumn("khoa_phong_quan_ly")}
                    title="Khoa/Phòng"
                    options={departments.map(d => ({label: d, value: d}))}
                />
                <DataTableFacetedFilter
                    column={table.getColumn("nguoi_dang_truc_tiep_quan_ly")}
                    title="Người quản lý"
                    options={users.map(u => ({label: u, value: u}))}
                />
                 <DataTableFacetedFilter
                    column={table.getColumn("vi_tri_lap_dat")}
                    title="Vị trí"
                    options={locations.map(l => ({label: l, value: l}))}
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
            <div className="text-sm text-muted-foreground">
                Đã chọn {table.getFilteredSelectedRowModel().rows.length} trên{" "}
                {totalSelectableRows} thiết bị (có thể thêm).
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
