/**
 * EquipmentColumnsDialog.test.tsx
 *
 * Verifies that column visibility toggle buttons inside the dialog
 * update their label and variant when clicked (TDD Red–Green).
 */

import { render, screen, within, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'
import {
    createColumnHelper,
    getCoreRowModel,
    useReactTable,
    type VisibilityState,
} from '@tanstack/react-table'
import type { Equipment } from '@/types/database'

// ---------- Mocks ----------

// Mock useEquipmentContext — dialog always open
const mockCloseColumnsDialog = vi.fn()
vi.mock('../_hooks/useEquipmentContext', () => ({
    useEquipmentContext: () => ({
        dialogState: { isColumnsOpen: true },
        closeColumnsDialog: mockCloseColumnsDialog,
    }),
}))

// Mock columnLabels — only the columns we test
vi.mock('@/components/equipment/equipment-table-columns', () => ({
    columnLabels: {
        ma_thiet_bi: 'Mã thiết bị',
        ten_thiet_bi: 'Tên thiết bị',
        model: 'Model',
    },
}))

// Mock Dialog to render inline (no portal / no animations)
vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
        open ? <div data-testid="dialog">{children}</div> : null,
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock Button with forwarded props
vi.mock('@/components/ui/button', () => ({
    Button: ({
        children,
        onClick,
        variant,
        ...rest
    }: {
        children: React.ReactNode
        onClick?: () => void
        variant?: string
        [key: string]: unknown
    }) => (
        <button data-variant={variant} onClick={onClick} {...rest}>
            {children}
        </button>
    ),
}))

// ---------- Test harness ----------

import { EquipmentColumnsDialog } from '../_components/EquipmentColumnsDialog'

const columnHelper = createColumnHelper<Equipment>()

const TEST_COLUMNS = [
    columnHelper.accessor('ma_thiet_bi', { header: 'Mã thiết bị' }),
    columnHelper.accessor('ten_thiet_bi', { header: 'Tên thiết bị' }),
    columnHelper.accessor('model', { header: 'Model' }),
]

const EMPTY_DATA: Equipment[] = []

/**
 * Wrapper component that creates a real TanStack Table instance
 * with controlled columnVisibility state.
 */
function TestHarness({ initialVisibility }: { initialVisibility: VisibilityState }) {
    const [columnVisibility, setColumnVisibility] = React.useState(initialVisibility)

    const table = useReactTable({
        data: EMPTY_DATA,
        columns: TEST_COLUMNS,
        state: { columnVisibility },
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
    })

    return <EquipmentColumnsDialog table={table} />
}

// ---------- Tests ----------

describe('EquipmentColumnsDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should show "Hiện" for hidden columns and "Ẩn" for visible columns', () => {
        render(
            <TestHarness
                initialVisibility={{ ma_thiet_bi: false, ten_thiet_bi: true, model: true }}
            />
        )

        const dialog = screen.getByTestId('dialog')

        // "Mã thiết bị" is hidden → button should say "Hiện"
        const maRow = screen.getByText('Mã thiết bị').closest('div')!
        expect(within(maRow).getByRole('button')).toHaveTextContent('Hiện')

        // "Tên thiết bị" is visible → button should say "Ẩn"
        const tenRow = within(dialog).getByText('Tên thiết bị').closest('div')!
        expect(within(tenRow).getByRole('button')).toHaveTextContent('Ẩn')
    })

    it('should update button label after toggling column visibility', () => {
        render(
            <TestHarness
                initialVisibility={{ ma_thiet_bi: true, ten_thiet_bi: true, model: true }}
            />
        )

        // All columns start visible — "Mã thiết bị" button should say "Ẩn"
        const maRow = screen.getByText('Mã thiết bị').closest('div')!
        const toggleButton = within(maRow).getByRole('button')
        expect(toggleButton).toHaveTextContent('Ẩn')

        // Click to hide the column
        fireEvent.click(toggleButton)

        // BUG: Without the fix, React.memo prevents re-render so the button
        // stays as "Ẩn" instead of changing to "Hiện"
        expect(toggleButton).toHaveTextContent('Hiện')
    })

    it('should toggle button variant between secondary and outline', () => {
        render(
            <TestHarness
                initialVisibility={{ ma_thiet_bi: true, ten_thiet_bi: true, model: true }}
            />
        )

        const maRow = screen.getByText('Mã thiết bị').closest('div')!
        const toggleButton = within(maRow).getByRole('button')

        // Visible column → variant should be 'secondary'
        expect(toggleButton).toHaveAttribute('data-variant', 'secondary')

        // Click to hide
        fireEvent.click(toggleButton)

        // After hiding → variant should change to 'outline'
        expect(toggleButton).toHaveAttribute('data-variant', 'outline')
    })
})
