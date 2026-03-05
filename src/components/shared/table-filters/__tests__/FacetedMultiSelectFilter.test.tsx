import * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import "@testing-library/jest-dom"
import { render, screen, fireEvent } from '@testing-library/react'
import {
    getCoreRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFilteredRowModel,
    useReactTable,
    type ColumnDef,
} from '@tanstack/react-table'

/**
 * Mock radix DropdownMenu so content renders inline (no portal / no jsdom issues).
 */
vi.mock('@/components/ui/dropdown-menu', () => {
    const Trigger = ({ children, asChild, ...rest }: any) => {
        if (asChild && React.isValidElement(children)) {
            return React.cloneElement(children as React.ReactElement<any>, rest)
        }
        return <button {...rest}>{children}</button>
    }
    return {
        DropdownMenu: ({ children }: any) => {
            const [open, setOpen] = React.useState(false)
            return (
                <div data-testid="dropdown-menu">
                    {React.Children.map(children, (child: any) =>
                        React.isValidElement(child)
                            ? React.cloneElement(child as React.ReactElement<any>, { open, setOpen })
                            : child
                    )}
                </div>
            )
        },
        DropdownMenuTrigger: ({ children, asChild, open, setOpen, ...rest }: any) => {
            const handleClick = () => setOpen?.(!open)
            if (asChild && React.isValidElement(children)) {
                return React.cloneElement(children as React.ReactElement<any>, {
                    ...rest,
                    onClick: (...args: any[]) => {
                        handleClick()
                            ; (children as any).props?.onClick?.(...args)
                    },
                })
            }
            return <button {...rest} onClick={handleClick}>{children}</button>
        },
        DropdownMenuContent: ({ children, open, ...rest }: any) => {
            if (!open) return null
            return <div data-testid="dropdown-content" {...rest}>{children}</div>
        },
    }
})

import { FacetedMultiSelectFilter } from '../FacetedMultiSelectFilter'

type Row = { id: number; department: string }

const DATA: Row[] = [
    { id: 1, department: 'ICU' },
    { id: 2, department: 'Surgery' },
    { id: 3, department: 'Radiology' },
    { id: 4, department: 'ICU' },
]

const COLUMNS: ColumnDef<Row>[] = [
    {
        accessorKey: 'department',
        header: 'Department',
        filterFn: (row, id, value: string[]) => {
            return value.includes(row.getValue(id) as string)
        },
    },
]

const OPTIONS = [
    { label: 'ICU', value: 'ICU' },
    { label: 'Surgery', value: 'Surgery' },
    { label: 'Radiology', value: 'Radiology' },
]

/**
 * Test wrapper with real TanStack Table for integration testing.
 */
function Wrapper({ onFilterChange }: { onFilterChange?: (values: string[] | undefined) => void }) {
    const [columnFilters, setColumnFilters] = React.useState<any[]>([])
    const table = useReactTable({
        data: DATA,
        columns: COLUMNS,
        state: { columnFilters },
        onColumnFiltersChange: (updater) => {
            const next = typeof updater === 'function' ? updater(columnFilters) : updater
            setColumnFilters(next)
            const deptFilter = next.find((f: any) => f.id === 'department')
            onFilterChange?.(deptFilter?.value as string[] | undefined)
        },
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
    })

    return (
        <FacetedMultiSelectFilter
            column={table.getColumn('department')}
            title="Khoa/Phòng"
            options={OPTIONS}
        />
    )
}

function NoColumnWrapper() {
    return <FacetedMultiSelectFilter title="Empty" options={OPTIONS} />
}

describe('FacetedMultiSelectFilter', () => {
    it('renders title on the trigger button', () => {
        render(<Wrapper />)
        expect(screen.getByText('Khoa/Phòng')).toBeInTheDocument()
    })

    it('shows all options when dropdown is opened', () => {
        render(<Wrapper />)
        fireEvent.click(screen.getByText('Khoa/Phòng'))

        expect(screen.getByRole('button', { name: 'ICU' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Surgery' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Radiology' })).toBeInTheDocument()
    })

    it('selects an option and calls column.setFilterValue', () => {
        const onFilterChange = vi.fn()
        render(<Wrapper onFilterChange={onFilterChange} />)

        fireEvent.click(screen.getByText('Khoa/Phòng'))
        fireEvent.click(screen.getByRole('button', { name: 'ICU' }))

        expect(onFilterChange).toHaveBeenCalledWith(['ICU'])
    })

    it('supports multi-select toggle', () => {
        const onFilterChange = vi.fn()
        render(<Wrapper onFilterChange={onFilterChange} />)

        fireEvent.click(screen.getByText('Khoa/Phòng'))
        fireEvent.click(screen.getByRole('button', { name: 'ICU' }))
        fireEvent.click(screen.getByRole('button', { name: 'Surgery' }))

        expect(onFilterChange).toHaveBeenLastCalledWith(
            expect.arrayContaining(['ICU', 'Surgery'])
        )
    })

    it('deselects an option when clicked again', () => {
        const onFilterChange = vi.fn()
        render(<Wrapper onFilterChange={onFilterChange} />)

        fireEvent.click(screen.getByText('Khoa/Phòng'))
        fireEvent.click(screen.getByRole('button', { name: 'ICU' }))
        fireEvent.click(screen.getByRole('button', { name: 'ICU' }))

        expect(onFilterChange).toHaveBeenLastCalledWith(undefined)
    })

    it('shows selected count badge when options are selected', () => {
        render(<Wrapper />)

        fireEvent.click(screen.getByText('Khoa/Phòng'))
        fireEvent.click(screen.getByRole('button', { name: 'ICU' }))
        fireEvent.click(screen.getByRole('button', { name: 'Surgery' }))

        expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('clears all selections when clear button is clicked', () => {
        const onFilterChange = vi.fn()
        render(<Wrapper onFilterChange={onFilterChange} />)

        fireEvent.click(screen.getByText('Khoa/Phòng'))
        fireEvent.click(screen.getByRole('button', { name: 'ICU' }))
        fireEvent.click(screen.getByRole('button', { name: 'Surgery' }))
        fireEvent.click(screen.getByText('Xóa bộ lọc'))

        expect(onFilterChange).toHaveBeenLastCalledWith(undefined)
    })

    it('handles undefined column gracefully without crashing', () => {
        expect(() => render(<NoColumnWrapper />)).not.toThrow()
        expect(screen.getByText('Empty')).toBeInTheDocument()
    })
})
