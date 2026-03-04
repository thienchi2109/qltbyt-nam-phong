/**
 * equipment-toolbar.filters.test.tsx
 *
 * Tests that the equipment toolbar correctly uses the shared FacetedMultiSelectFilter
 * after migration, and that mobile/tablet filter sheet still triggers correctly.
 */

import * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
    getCoreRowModel,
    getFilteredRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    useReactTable,
    type ColumnDef,
} from '@tanstack/react-table'
import type { Equipment } from '@/types/database'

/**
 * Mock dynamic imports (QR scanner components) to avoid SSR issues in tests
 */
vi.mock('next/dynamic', () => ({
    default: () => () => null,
}))

/**
 * Mock radix DropdownMenu to render inline (no portal in jsdom)
 */
vi.mock('@/components/ui/dropdown-menu', () => {
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
        DropdownMenuItem: ({ children, onSelect, ...rest }: any) => (
            <button {...rest} onClick={onSelect}>{children}</button>
        ),
    }
})

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: vi.fn() }),
}))

import { EquipmentToolbar } from '../equipment-toolbar'

type Row = Equipment

const MOCK_DATA: Partial<Equipment>[] = [
    { id: 1, tinh_trang_hien_tai: 'Hoạt động', khoa_phong_quan_ly: 'ICU' },
]

const COLUMNS: ColumnDef<Equipment>[] = [
    { accessorKey: 'tinh_trang_hien_tai', header: 'Tình trạng' },
    { accessorKey: 'khoa_phong_quan_ly', header: 'Khoa/Phòng' },
]

function createMockTable() {
    const table = {
        getColumn: vi.fn().mockReturnValue({
            getFilterValue: () => undefined,
            setFilterValue: vi.fn(),
        }),
        resetColumnFilters: vi.fn(),
        getHeaderGroups: () => [],
        getRowModel: () => ({ rows: [] }),
        getAllColumns: () => [],
        getState: () => ({ columnFilters: [] }),
    }
    return table as any
}

describe('EquipmentToolbar with shared filters', () => {
    const baseProps = {
        table: createMockTable(),
        searchTerm: '',
        onSearchChange: vi.fn(),
        columnFilters: [],
        isFiltered: false,
        statuses: ['Hoạt động', 'Hỏng'],
        departments: ['ICU', 'Surgery'],
        users: ['User A'],
        classifications: ['Loại A'],
        fundingSources: ['Ngân sách'],
        isMobile: false,
        useTabletFilters: false,
        isRegionalLeader: false,
        hasFacilityFilter: false,
        onOpenFilterSheet: vi.fn(),
        onOpenColumnsDialog: vi.fn(),
        onDownloadTemplate: vi.fn(),
        onExportData: vi.fn(),
        onAddEquipment: vi.fn(),
        onImportEquipment: vi.fn(),
        onClearFacilityFilter: vi.fn(),
    }

    it('renders shared FacetedMultiSelectFilter titles in desktop mode', () => {
        render(<EquipmentToolbar {...baseProps} />)

        expect(screen.getByText('Tình trạng')).toBeInTheDocument()
        expect(screen.getByText('Khoa/Phòng')).toBeInTheDocument()
        expect(screen.getByText('Người sử dụng')).toBeInTheDocument()
        expect(screen.getByText('Phân loại')).toBeInTheDocument()
        expect(screen.getByText('Nguồn kinh phí')).toBeInTheDocument()
    })

    it('renders mobile filter sheet trigger instead of faceted filters on mobile', () => {
        render(<EquipmentToolbar {...baseProps} isMobile={true} />)

        expect(screen.getByText('Lọc')).toBeInTheDocument()
        expect(screen.queryByText('Tình trạng')).not.toBeInTheDocument()
        expect(screen.queryByText('Khoa/Phòng')).not.toBeInTheDocument()
    })

    it('calls onOpenFilterSheet when mobile filter button is clicked', () => {
        const onOpenFilterSheet = vi.fn()
        render(<EquipmentToolbar {...baseProps} isMobile={true} onOpenFilterSheet={onOpenFilterSheet} />)

        fireEvent.click(screen.getByText('Lọc'))
        expect(onOpenFilterSheet).toHaveBeenCalled()
    })

    it('shows clear all button when filters are active', () => {
        render(<EquipmentToolbar {...baseProps} isFiltered={true} />)

        expect(screen.getByText('Xóa tất cả')).toBeInTheDocument()
    })
})
