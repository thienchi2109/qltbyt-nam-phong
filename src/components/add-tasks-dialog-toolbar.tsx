import * as React from "react"
import type { Dispatch } from "react"
import type { Column, Table } from "@tanstack/react-table"
import { ChevronDown, FilterX } from "lucide-react"

import type { AddTasksFilterOptions } from "@/hooks/useAddTasksEquipment"
import type { Equipment } from "@/lib/data"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SearchInput } from "@/components/shared/SearchInput"
import { FacetedMultiSelectFilter } from "@/components/shared/table-filters/FacetedMultiSelectFilter"

import type {
  AddTasksTableAction,
  AddTasksTableState,
} from "./add-tasks-dialog.table-state"

interface AddTasksDialogToolbarProps {
  table: Table<Equipment>
  tableState: AddTasksTableState
  filterOptions: AddTasksFilterOptions
  isFiltered: boolean
  dispatchTable: Dispatch<AddTasksTableAction>
}

function getColumnVisibilityLabel(column: Column<Equipment, unknown>): string {
  const header = column.columnDef.header
  if (typeof header === "string" && header.trim().length > 0) {
    return header
  }
  return column.id
}

/** Renders search, faceted filters, clear-filter action, and column visibility controls. */
export function AddTasksDialogToolbar({
  table,
  tableState,
  filterOptions,
  isFiltered,
  dispatchTable,
}: AddTasksDialogToolbarProps) {
  return (
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
                const header = getColumnVisibilityLabel(column)
                return [(
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {header}
                  </DropdownMenuCheckboxItem>
                )]
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
