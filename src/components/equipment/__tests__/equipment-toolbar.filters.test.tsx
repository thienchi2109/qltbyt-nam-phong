/**
 * equipment-toolbar.filters.test.tsx
 *
 * Tests that the equipment toolbar correctly uses the shared FacetedMultiSelectFilter
 * after migration, and that mobile/tablet filter sheet still triggers correctly.
 */

import * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import "@testing-library/jest-dom"
import { render, screen, fireEvent } from '@testing-library/react'
import type { Table } from '@tanstack/react-table'
import type { Equipment } from '@/types/database'

type DropdownStateProps = {
    open?: boolean
    setOpen?: React.Dispatch<React.SetStateAction<boolean>>
}

type DropdownChildProps = DropdownStateProps & Record<string, unknown>

type DropdownWithChildrenProps = DropdownStateProps & {
    children: React.ReactNode
}

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
        DropdownMenu: ({ children }: { children: React.ReactNode }) => {
            const [open, setOpen] = React.useState(false)
            return (
                <div data-testid="dropdown-menu">
                    {React.Children.map(children, (child) =>
                        React.isValidElement(child)
                            ? React.cloneElement(child as React.ReactElement<DropdownChildProps>, { open, setOpen })
                            : child
                    )}
                </div>
            )
        },
        DropdownMenuTrigger: ({ children, asChild, open, setOpen, ...rest }: DropdownWithChildrenProps & { asChild?: boolean }) => {
            const toggleDropdownMenu = () => setOpen?.(!open)
            if (asChild && React.isValidElement(children)) {
                const childElement = children as React.ReactElement<{ onClick?: (...args: unknown[]) => void }>
                return React.cloneElement(childElement, {
                    ...rest,
                    onClick: (...args: unknown[]) => {
                        toggleDropdownMenu()
                            ; childElement.props.onClick?.(...args)
                    },
                })
            }
            return <button {...rest} onClick={toggleDropdownMenu}>{children}</button>
        },
        DropdownMenuContent: ({ children, open, ...rest }: DropdownWithChildrenProps) => {
            if (!open) return null
            return <div data-testid="dropdown-content" {...rest}>{children}</div>
        },
        DropdownMenuItem: ({ children, onSelect, ...rest }: { children: React.ReactNode; onSelect?: () => void } & Record<string, unknown>) => (
            <button {...rest} onClick={onSelect}>{children}</button>
        ),
    }
})

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: vi.fn() }),
}))


import { EquipmentToolbar } from '../equipment-toolbar'

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
    return table as unknown as Table<Equipment>
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
        filterMode: 'faceted' as const,
        filterState: {
            isFiltered: false,
            hasFacilityFilter: false,
        },
        actionState: {
            canCreateEquipment: true,
            isExporting: false,
        },
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
        render(<EquipmentToolbar {...baseProps} filterMode="sheet" />)

        expect(screen.getByText('Lọc')).toBeInTheDocument()
        expect(screen.queryByText('Tình trạng')).not.toBeInTheDocument()
        expect(screen.queryByText('Khoa/Phòng')).not.toBeInTheDocument()
    })

    it('calls onOpenFilterSheet when mobile filter button is clicked', () => {
        const onOpenFilterSheet = vi.fn()
        render(<EquipmentToolbar {...baseProps} filterMode="sheet" onOpenFilterSheet={onOpenFilterSheet} />)

        fireEvent.click(screen.getByText('Lọc'))
        expect(onOpenFilterSheet).toHaveBeenCalled()
    })

    it('shows clear all button when filters are active', () => {
        render(
            <EquipmentToolbar
                {...baseProps}
                filterState={{ ...baseProps.filterState, isFiltered: true }}
            />
        )

        expect(screen.getByText('Xóa tất cả')).toBeInTheDocument()
    })

    it('hides add actions when create permission is disabled', () => {
        render(
            <EquipmentToolbar
                {...baseProps}
                actionState={{ ...baseProps.actionState, canCreateEquipment: false }}
            />
        )

        expect(screen.queryByText('Thêm thiết bị')).not.toBeInTheDocument()
    })

    it('places selection actions immediately before the add equipment button', () => {
        render(
            <EquipmentToolbar
                {...baseProps}
                selectionActions={<div data-testid="toolbar-selection-actions">Đã chọn 1 thiết bị</div>}
            />
        )

        const selectionActions = screen.getByTestId('toolbar-selection-actions')
        const addButton = screen.getByRole('button', { name: /Thêm thiết bị/i })

        expect(selectionActions.compareDocumentPosition(addButton)).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING
        )
    })

})
