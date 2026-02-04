import * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'

import { DataTablePagination } from '@/components/shared/DataTablePagination'
import type { DisplayContext } from '@/components/shared/DataTablePagination/types'

type Row = { id: number; name: string }

const DATA: Row[] = Array.from({ length: 12 }).map((_, index) => ({
  id: index + 1,
  name: `Row ${index + 1}`,
}))

const COLUMNS: ColumnDef<Row>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
]

function TanstackWrapper() {
  const table = useReactTable({
    data: DATA,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize: 5 },
    },
  })

  return (
    <DataTablePagination
      table={table}
      totalCount={DATA.length}
      entity={{ singular: 'muc' }}
      pageSizeOptions={[]}
    />
  )
}

function ControlledWrapper() {
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 5 })
  const table = useReactTable({
    data: DATA,
    columns: COLUMNS,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <DataTablePagination
      table={table}
      totalCount={DATA.length}
      entity={{ singular: 'muc' }}
      paginationMode={{
        mode: 'controlled',
        pagination,
        onPaginationChange: setPagination,
      }}
      pageSizeOptions={[]}
    />
  )
}

function ServerWrapper({ onPageChange }: { onPageChange: (page: number) => void }) {
  const table = useReactTable({
    data: DATA,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <DataTablePagination
      table={table}
      totalCount={DATA.length}
      entity={{ singular: 'muc' }}
      paginationMode={{
        mode: 'server',
        currentPage: 1,
        totalPages: 3,
        pageSize: 5,
        onPageChange,
        onPageSizeChange: vi.fn(),
      }}
      pageSizeOptions={[]}
    />
  )
}

describe('DataTablePagination', () => {
  it('renders default count-total format in tanstack mode', () => {
    render(<TanstackWrapper />)
    expect(screen.getByText(/5.*12.*muc/)).toBeInTheDocument()
  })

  it('moves to next page in controlled mode', () => {
    render(<ControlledWrapper />)
    fireEvent.click(screen.getByRole('button', { name: /Trang ti/i }))
    expect(screen.getByText('Trang 2 / 3')).toBeInTheDocument()
  })

  it('calls onPageChange in server mode', () => {
    const onPageChange = vi.fn()
    render(<ServerWrapper onPageChange={onPageChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Trang ti/i }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('renders custom display format', () => {
    const Custom = () => {
      const table = useReactTable({
        data: DATA,
        columns: COLUMNS,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        initialState: {
          pagination: { pageIndex: 0, pageSize: 5 },
        },
      })

      const format = (_ctx: DisplayContext) => 'Custom display'

      return (
        <DataTablePagination
          table={table}
          totalCount={DATA.length}
          entity={{ singular: 'muc' }}
          displayFormat={format}
          pageSizeOptions={[]}
        />
      )
    }

    render(<Custom />)
    expect(screen.getByText('Custom display')).toBeInTheDocument()
  })

  it('renders nothing when disabled via enabled=false', () => {
    const Disabled = () => {
      const table = useReactTable({
        data: DATA,
        columns: COLUMNS,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
      })

      return (
        <DataTablePagination
          table={table}
          totalCount={DATA.length}
          entity={{ singular: 'muc' }}
          enabled={false}
          pageSizeOptions={[]}
        />
      )
    }

    const { container } = render(<Disabled />)
    expect(container).toBeEmptyDOMElement()
  })
})
