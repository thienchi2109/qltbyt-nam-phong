import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"

import { BulkActionBar, createSelectionColumn } from "@/components/ui/data-table-selection"

type RowData = {
  id: number
  name: string
}

const DATA: RowData[] = [
  { id: 1, name: "One" },
  { id: 2, name: "Two" },
]

function SelectionTableHarness(props: { onRowClick?: (id: number) => void }) {
  const [rowSelection, setRowSelection] = React.useState({})

  const columns = React.useMemo<ColumnDef<RowData>[]>(
    () => [
      createSelectionColumn<RowData>(),
      {
        accessorKey: "name",
        header: "Name",
      },
    ],
    []
  )

  const table = useReactTable({
    data: DATA,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    getRowId: (row) => String(row.id),
  })

  return (
    <>
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              data-testid={`row-${row.id}`}
              onClick={() => props.onRowClick?.(row.original.id)}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <output data-testid="selected-count">{table.getFilteredSelectedRowModel().rows.length}</output>
    </>
  )
}

describe("BulkActionBar", () => {
  it("returns null when selectedCount is 0", () => {
    const { container } = render(
      <BulkActionBar selectedCount={0} onClearSelection={() => {}}>
        <button type="button">Action</button>
      </BulkActionBar>
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("renders selection summary, action content, and clear button", () => {
    const onClearSelection = vi.fn()

    render(
      <BulkActionBar selectedCount={3} onClearSelection={onClearSelection}>
        <button type="button">Delete</button>
      </BulkActionBar>
    )

    expect(
      screen.getByText((_, element) => {
        return element?.textContent?.replace(/\s+/g, " ").trim() === "Đã chọn 3 mục"
      })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Bỏ chọn" }))
    expect(onClearSelection).toHaveBeenCalledTimes(1)
  })

  it("supports custom entity labels", () => {
    render(
      <BulkActionBar selectedCount={2} onClearSelection={() => {}} entityLabel="thiết bị">
        <span>Actions</span>
      </BulkActionBar>
    )

    expect(
      screen.getByText((_, element) => {
        return element?.textContent?.replace(/\s+/g, " ").trim() === "Đã chọn 2 thiết bị"
      })
    ).toBeInTheDocument()
  })
})

describe("createSelectionColumn", () => {
  it("toggles all page rows from header checkbox", () => {
    render(<SelectionTableHarness />)

    const selectAll = screen.getByRole("checkbox", { name: "Chọn tất cả" })

    fireEvent.click(selectAll)
    expect(screen.getByTestId("selected-count")).toHaveTextContent("2")

    fireEvent.click(selectAll)
    expect(screen.getByTestId("selected-count")).toHaveTextContent("0")
  })

  it("stops row-click propagation when selecting a row", () => {
    const onRowClick = vi.fn()
    render(<SelectionTableHarness onRowClick={onRowClick} />)

    fireEvent.click(screen.getByTestId("row-1"))
    expect(onRowClick).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getAllByRole("checkbox", { name: "Chọn dòng" })[0])

    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("selected-count")).toHaveTextContent("1")
  })
})
