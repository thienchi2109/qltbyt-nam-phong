/**
 * add-tasks-dialog.filters-and-pagination.test.tsx
 *
 * Tests that AddTasksDialog uses shared SearchInput, FacetedMultiSelectFilter,
 * and DataTablePagination after migration.
 */

import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import "@testing-library/jest-dom"
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Mock radix DropdownMenu for inline rendering in jsdom
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
        DropdownMenuCheckboxItem: ({ children, checked, onCheckedChange, onSelect, ...rest }: any) => (
            <button {...rest} onClick={() => { onSelect?.({ preventDefault: () => { } }); onCheckedChange?.(!checked) }}>
                {children}
            </button>
        ),
        DropdownMenuLabel: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
        DropdownMenuSeparator: () => <hr />,
        DropdownMenuItem: ({ children, onSelect, ...rest }: any) => (
            <button {...rest} onClick={onSelect}>{children}</button>
        ),
    }
})

/**
 * Mock radix Dialog for inline rendering in jsdom
 */
vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
    DialogContent: ({ children, ...rest }: any) => <div data-testid="dialog-content" {...rest}>{children}</div>,
    DialogHeader: ({ children }: any) => <div>{children}</div>,
    DialogTitle: ({ children }: any) => <h2>{children}</h2>,
    DialogDescription: ({ children }: any) => <p>{children}</p>,
    DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}))

/**
 * Mock scroll area for inline rendering
 */
vi.mock('@/components/ui/scroll-area', () => ({
    ScrollArea: ({ children }: any) => <div>{children}</div>,
}))

/**
 * Mock RPC client (equipment fetch)
 */
vi.mock('@/lib/rpc-client', () => ({
    callRpc: vi.fn(),
}))

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/hooks/use-debounce', () => ({
    useSearchDebounce: (value: string) => value,
}))

import { AddTasksDialog } from '../add-tasks-dialog'
import { callRpc } from '@/lib/rpc-client'

const mockCallRpc = vi.mocked(callRpc)

function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
        },
    })
}

function renderWithQueryClient(ui: React.ReactElement) {
    const queryClient = createTestQueryClient()
    return render(
        React.createElement(QueryClientProvider, { client: queryClient }, ui)
    )
}

const MOCK_EQUIPMENT = Array.from({ length: 15 }, (_, i) => ({
    id: i + 1,
    ma_thiet_bi: `TB-${String(i + 1).padStart(3, '0')}`,
    ten_thiet_bi: `Thiết bị ${i + 1}`,
    model: `Model-${i + 1}`,
    khoa_phong_quan_ly: i % 3 === 0 ? 'ICU' : i % 3 === 1 ? 'Surgery' : 'Radiology',
    nguoi_dang_truc_tiep_quan_ly: i % 2 === 0 ? 'User A' : 'User B',
    vi_tri_lap_dat: `Room ${i + 1}`,
}))

describe('AddTasksDialog filters and pagination', () => {
    const baseProps = {
        open: true,
        onOpenChange: vi.fn(),
        plan: { id: 1, ten_ke_hoach: 'Test Plan' } as any,
        existingEquipmentIds: [] as number[],
        onSuccess: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockCallRpc.mockResolvedValue(MOCK_EQUIPMENT as any)
    })

    it('renders SearchInput with type="search" attribute', async () => {
        renderWithQueryClient(<AddTasksDialog {...baseProps} />)

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Tìm kiếm chung...')).toBeInTheDocument()
        })

        const searchInput = screen.getByPlaceholderText('Tìm kiếm chung...')
        expect(searchInput).toHaveAttribute('type', 'search')
    })

    it('renders shared FacetedMultiSelectFilter titles', async () => {
        renderWithQueryClient(<AddTasksDialog {...baseProps} />)

        // Wait for data to load (table headers + filter buttons both visible)
        await waitFor(() => {
            expect(screen.getByText('TB-001')).toBeInTheDocument()
        }, { timeout: 5000 })

        // 'Khoa/Phòng' appears in both filter button AND table header, so use getAllByText
        expect(screen.getAllByText('Khoa/Phòng').length).toBeGreaterThanOrEqual(2)
        // These only appear as filter titles (not as table headers)
        expect(screen.getAllByText('Người quản lý').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Vị trí').length).toBeGreaterThanOrEqual(1)
    })

    it('renders pagination controls after data loads', async () => {
        renderWithQueryClient(<AddTasksDialog {...baseProps} />)

        // Wait for table data to render
        await waitFor(() => {
            expect(screen.getByText('TB-001')).toBeInTheDocument()
        }, { timeout: 5000 })

        // DataTablePagination should render with "Trang tiếp" button
        const nextButton = screen.queryByRole('button', { name: /Trang ti/i })
        expect(nextButton).toBeTruthy()
    })

    it('disables selection for already-added equipment', async () => {
        renderWithQueryClient(<AddTasksDialog {...baseProps} existingEquipmentIds={[1, 2, 3]} />)

        await waitFor(() => {
            expect(screen.getByText('TB-001')).toBeInTheDocument()
        }, { timeout: 5000 })

        // Find checkboxes — the header + row checkboxes
        const checkboxes = screen.getAllByRole('checkbox')
        // At least some checkboxes should be disabled (3 existing equipment)
        const disabledCheckboxes = checkboxes.filter(cb => cb.hasAttribute('disabled') || cb.getAttribute('data-disabled') !== null)
        expect(disabledCheckboxes.length).toBeGreaterThan(0)
    })
})
