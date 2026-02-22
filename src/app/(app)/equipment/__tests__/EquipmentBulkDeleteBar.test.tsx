import * as React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { ColumnDef, Table } from "@tanstack/react-table"
import { getCoreRowModel, getFilteredRowModel, useReactTable } from "@tanstack/react-table"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createSelectionColumn } from "@/components/ui/data-table-selection"
import type { Equipment } from "@/types/database"
import { EquipmentBulkDeleteBar } from "../_components/EquipmentBulkDeleteBar"

const state = vi.hoisted(() => ({
  isPending: false,
  mutate: vi.fn(),
}))

vi.mock("@/hooks/use-cached-equipment", () => ({
  useBulkDeleteEquipment: () => ({
    mutate: state.mutate,
    isPending: state.isPending,
  }),
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    children,
  }: {
    children: React.ReactNode
  }) => <div>{children}</div>,
  AlertDialogTrigger: ({
    children,
  }: {
    children: React.ReactNode
  }) => <>{children}</>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
  }) => <button onClick={onClick}>{children}</button>,
  AlertDialogAction: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    disabled?: boolean
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

function createEquipment(id: number): Equipment {
  return {
    id,
    ma_thiet_bi: `TB-${id}`,
    ten_thiet_bi: `Thiết bị ${id}`,
  }
}

const data: Equipment[] = [createEquipment(101), createEquipment(202)]

const columns: ColumnDef<Equipment>[] = [
  createSelectionColumn<Equipment>(),
  {
    accessorKey: "ten_thiet_bi",
    header: "Tên thiết bị",
  },
]

function createTableHarness(onReady: (table: Table<Equipment>) => void) {
  return function TableHarness({
    canBulkSelect,
    isCardView,
  }: {
    canBulkSelect: boolean
    isCardView: boolean
  }) {
    const [rowSelection, setRowSelection] = React.useState({})

    const table = useReactTable({
      data,
      columns,
      state: { rowSelection },
      onRowSelectionChange: setRowSelection,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      enableRowSelection: true,
      getRowId: (row) => String(row.id),
    })

    React.useEffect(() => {
      onReady(table)
    }, [table])

    return (
      <EquipmentBulkDeleteBar
        table={table}
        canBulkSelect={canBulkSelect}
        isCardView={isCardView}
      />
    )
  }
}

describe("EquipmentBulkDeleteBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.isPending = false
  })

  it("renders null when user cannot bulk-select", () => {
    const onReady = vi.fn()
    const Harness = createTableHarness(onReady)

    render(<Harness canBulkSelect={false} isCardView={false} />)

    expect(screen.queryByText(/Đã chọn/i)).not.toBeInTheDocument()
  })

  it("renders null in card view", () => {
    const onReady = vi.fn()
    const Harness = createTableHarness(onReady)

    render(<Harness canBulkSelect={true} isCardView={true} />)

    expect(screen.queryByText(/Đã chọn/i)).not.toBeInTheDocument()
  })

  it("confirms bulk delete and resets row selection after success", async () => {
    let tableRef: Table<Equipment> | null = null
    const Harness = createTableHarness((table) => {
      tableRef = table
    })

    render(<Harness canBulkSelect={true} isCardView={false} />)

    await waitFor(() => {
      expect(tableRef).not.toBeNull()
    })

    act(() => {
      tableRef?.toggleAllPageRowsSelected(true)
    })

    expect(screen.getByText(/^Đã chọn/i)).toHaveTextContent("2")

    fireEvent.click(screen.getByRole("button", { name: "Xóa đã chọn" }))
    fireEvent.click(screen.getByRole("button", { name: "Xóa" }))

    expect(state.mutate).toHaveBeenCalledWith(
      [101, 202],
      expect.objectContaining({ onSuccess: expect.any(Function) })
    )

    const [, options] = state.mutate.mock.calls[0] as [
      number[],
      { onSuccess?: () => void }
    ]

    act(() => {
      options.onSuccess?.()
    })

    expect(tableRef?.getState().rowSelection).toEqual({})
  })
})
