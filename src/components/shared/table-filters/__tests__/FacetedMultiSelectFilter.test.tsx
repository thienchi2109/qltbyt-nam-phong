import * as React from 'react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import "@testing-library/jest-dom"
import { act, render, screen, fireEvent } from '@testing-library/react'
import {
    getCoreRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFilteredRowModel,
    useReactTable,
    type ColumnFiltersState,
    type ColumnDef,
} from '@tanstack/react-table'

type PopoverStateProps = {
    open?: boolean
    setOpen?: React.Dispatch<React.SetStateAction<boolean>>
}

type PopoverTriggerProps = PopoverStateProps & {
    asChild?: boolean
    children: React.ReactNode
    onClick?: (...args: unknown[]) => void
} & Record<string, unknown>

type PopoverContentProps = PopoverStateProps & {
    children: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>

/**
 * Mock radix Popover so content renders inline (no portal / no jsdom issues).
 */
vi.mock('@/components/ui/popover', () => {
    const Trigger = ({ children, asChild, open, setOpen, ...rest }: PopoverTriggerProps) => {
        const togglePopover = () => setOpen?.(!open)
        if (asChild && React.isValidElement(children)) {
            const childElement = children as React.ReactElement<{ onClick?: (...args: unknown[]) => void }>
            return React.cloneElement(childElement, {
                ...rest,
                onClick: (...args: unknown[]) => {
                    togglePopover()
                    childElement.props.onClick?.(...args)
                },
            })
        }
        return <button {...rest} onClick={togglePopover}>{children}</button>
    }

    return {
        Popover: ({ children }: { children: React.ReactNode }) => {
            const [open, setOpen] = React.useState(false)
            return (
                <div data-testid="popover">
                    {React.Children.map(children, (child) =>
                        React.isValidElement(child)
                            ? React.cloneElement(child as React.ReactElement<PopoverStateProps>, { open, setOpen })
                            : child
                    )}
                </div>
            )
        },
        PopoverTrigger: Trigger,
        PopoverContent: ({ children, open, setOpen: _setOpen, ...rest }: PopoverContentProps) => {
            if (!open) return null
            return <div data-testid="popover-content" role="dialog" {...rest}>{children}</div>
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

const EMPTY_CONTROLLED_VALUE: string[] = []

afterEach(() => {
    vi.useRealTimers()
})

/**
 * Test wrapper with real TanStack Table for integration testing.
 */
function Wrapper({ onFilterChange }: { onFilterChange?: (values: string[] | undefined) => void }) {
    const [columnFilters, setColumnFilters] = React.useReducer(
        (_state: ColumnFiltersState, next: ColumnFiltersState) => next,
        [] as ColumnFiltersState
    )
    const table = useReactTable({
        data: DATA,
        columns: COLUMNS,
        state: { columnFilters },
        onColumnFiltersChange: (updater) => {
            const next = typeof updater === 'function' ? updater(columnFilters) : updater
            setColumnFilters(next)
            const deptFilter = next.find((f) => f.id === 'department')
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

    it('debounces internal option search before filtering visible options', async () => {
        vi.useFakeTimers()
        render(<Wrapper />)

        fireEvent.click(screen.getByRole('button', { name: /Khoa\/Phòng/i }))
        const optionSearch = screen.getByRole('searchbox', { name: 'Tìm lựa chọn Khoa/Phòng' })

        fireEvent.change(optionSearch, { target: { value: 'radio' } })

        expect(screen.getByRole('button', { name: 'ICU' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Surgery' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Radiology' })).toBeInTheDocument()

        act(() => {
            vi.advanceTimersByTime(299)
        })
        expect(screen.getByRole('button', { name: 'ICU' })).toBeInTheDocument()

        act(() => {
            vi.advanceTimersByTime(1)
        })

        expect(screen.queryByRole('button', { name: 'ICU' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Surgery' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Radiology' })).toBeInTheDocument()
    })

    it('does not change filter selection while typing internal option search', async () => {
        vi.useFakeTimers()
        const onFilterChange = vi.fn()
        render(<Wrapper onFilterChange={onFilterChange} />)

        fireEvent.click(screen.getByRole('button', { name: /Khoa\/Phòng/i }))
        fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm lựa chọn Khoa/Phòng' }), {
            target: { value: 'icu' },
        })

        act(() => {
            vi.advanceTimersByTime(300)
        })

        expect(onFilterChange).not.toHaveBeenCalled()
    })

    it('shows empty state when internal option search has no match', async () => {
        vi.useFakeTimers()
        render(<Wrapper />)

        fireEvent.click(screen.getByRole('button', { name: /Khoa\/Phòng/i }))
        fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm lựa chọn Khoa/Phòng' }), {
            target: { value: 'zzz' },
        })

        act(() => {
            vi.advanceTimersByTime(300)
        })

        expect(screen.getByText('Không tìm thấy lựa chọn phù hợp')).toBeInTheDocument()
    })

    it('moves focus from option search to first visible option on ArrowDown', async () => {
        vi.useFakeTimers()
        render(<Wrapper />)

        fireEvent.click(screen.getByRole('button', { name: /Khoa\/Phòng/i }))
        const optionSearch = screen.getByRole('searchbox', { name: 'Tìm lựa chọn Khoa/Phòng' })
        optionSearch.focus()

        fireEvent.keyDown(optionSearch, { key: 'ArrowDown' })

        expect(screen.getByRole('button', { name: 'ICU' })).toHaveFocus()
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

// ============================================
// Controlled (standalone) mode — no TanStack Table column
// ============================================

function ControlledWrapper({
    initialValue = EMPTY_CONTROLLED_VALUE,
    onChange,
}: {
    initialValue?: string[]
    onChange?: (values: string[]) => void
}) {
    const [value, setValue] = React.useReducer(
        (_state: string[], next: string[]) => next,
        initialValue
    )
    const syncSelectedValues = (newValues: string[]) => {
        setValue(newValues)
        onChange?.(newValues)
    }
    return (
        <FacetedMultiSelectFilter
            title="Khoa/Phòng"
            options={OPTIONS}
            value={value}
            onChange={syncSelectedValues}
        />
    )
}

describe('FacetedMultiSelectFilter — controlled mode', () => {
    it('renders pre-selected values from controlled value prop', () => {
        render(<ControlledWrapper initialValue={['ICU']} />)

        // Badge should show "1" for the pre-selected item
        expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('calls onChange when an option is toggled on', () => {
        const onChange = vi.fn()
        render(<ControlledWrapper onChange={onChange} />)

        fireEvent.click(screen.getByText('Khoa/Phòng'))
        fireEvent.click(screen.getByRole('button', { name: 'ICU' }))

        expect(onChange).toHaveBeenCalledWith(['ICU'])
    })

    it('calls onChange when an option is toggled off', () => {
        const onChange = vi.fn()
        render(<ControlledWrapper initialValue={['ICU']} onChange={onChange} />)

        fireEvent.click(screen.getByText('Khoa/Phòng'))
        fireEvent.click(screen.getByRole('button', { name: 'ICU' }))

        expect(onChange).toHaveBeenCalledWith([])
    })

    it('supports multi-select in controlled mode', () => {
        const onChange = vi.fn()
        render(<ControlledWrapper onChange={onChange} />)

        fireEvent.click(screen.getByText('Khoa/Phòng'))
        fireEvent.click(screen.getByRole('button', { name: 'ICU' }))
        fireEvent.click(screen.getByRole('button', { name: 'Surgery' }))

        expect(onChange).toHaveBeenLastCalledWith(
            expect.arrayContaining(['ICU', 'Surgery'])
        )
    })

    it('clears all selections via clear button in controlled mode', () => {
        const onChange = vi.fn()
        render(<ControlledWrapper initialValue={['ICU', 'Surgery']} onChange={onChange} />)

        fireEvent.click(screen.getByText('Khoa/Phòng'))
        fireEvent.click(screen.getByText('Xóa bộ lọc'))

        expect(onChange).toHaveBeenCalledWith([])
    })

    it('shows badge count matching controlled value length', () => {
        render(<ControlledWrapper initialValue={['ICU', 'Surgery']} />)
        expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('preserves selected value when option search hides that option', async () => {
        vi.useFakeTimers()
        render(<ControlledWrapper initialValue={['ICU']} />)

        fireEvent.click(screen.getByRole('button', { name: /Khoa\/Phòng/i }))
        fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm lựa chọn Khoa/Phòng' }), {
            target: { value: 'surgery' },
        })
        act(() => {
            vi.advanceTimersByTime(300)
        })

        expect(screen.queryByRole('button', { name: 'ICU' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Khoa\/Phòng/i })).toHaveTextContent('1')
    })
})
