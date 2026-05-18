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

function ControlledWrapper({
  totalCount = DATA.length,
  onPaginationChange,
}: {
  totalCount?: number
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void
}) {
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 5 })
  const handlePaginationChange = React.useCallback(
    (nextPagination: { pageIndex: number; pageSize: number }) => {
      setPagination(nextPagination)
      onPaginationChange?.(nextPagination)
    },
    [onPaginationChange]
  )
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
      totalCount={totalCount}
      entity={{ singular: 'muc' }}
      paginationMode={{
        mode: 'controlled',
        pagination,
        onPaginationChange: handlePaginationChange,
      }}
      pageSizeOptions={[]}
    />
  )
}

function ServerWrapper({
  currentPage = 1,
  totalPages = 12,
  isLoading = false,
  onPageChange,
}: {
  currentPage?: number
  totalPages?: number
  isLoading?: boolean
  onPageChange: (page: number) => void
}) {
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
        currentPage,
        totalPages,
        pageSize: 5,
        onPageChange,
        onPageSizeChange: vi.fn(),
      }}
      pageSizeOptions={[]}
      isLoading={isLoading}
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

  it('jumps to a submitted page in server mode once', () => {
    const onPageChange = vi.fn()
    render(<ServerWrapper onPageChange={onPageChange} />)

    const input = screen.getByRole('spinbutton', { name: /đi tới trang/i })
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(onPageChange).toHaveBeenCalledTimes(1)
    expect(onPageChange).toHaveBeenCalledWith(10)
  })

  it('does not jump while typing a page number', () => {
    const onPageChange = vi.fn()
    render(<ServerWrapper onPageChange={onPageChange} />)

    fireEvent.change(screen.getByRole('spinbutton', { name: /đi tới trang/i }), {
      target: { value: '10' },
    })

    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('clamps submitted server page jumps to available pages', () => {
    const onPageChange = vi.fn()
    render(<ServerWrapper onPageChange={onPageChange} />)

    const input = screen.getByRole('spinbutton', { name: /đi tới trang/i })
    fireEvent.change(input, { target: { value: '999' } })
    fireEvent.click(screen.getByRole('button', { name: /đi tới trang/i }))
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /đi tới trang/i }))

    expect(onPageChange).toHaveBeenNthCalledWith(1, 12)
    expect(onPageChange).toHaveBeenNthCalledWith(2, 1)
  })

  it('jumps through controlled pagination state', () => {
    const onPaginationChange = vi.fn()
    render(<ControlledWrapper totalCount={60} onPaginationChange={onPaginationChange} />)

    const input = screen.getByRole('spinbutton', { name: /đi tới trang/i })
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 9, pageSize: 5 })
  })

  it('disables page jump controls while loading', () => {
    render(<ServerWrapper isLoading onPageChange={vi.fn()} />)

    expect(screen.getByRole('spinbutton', { name: /đi tới trang/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /đi tới trang/i })).toBeDisabled()
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
