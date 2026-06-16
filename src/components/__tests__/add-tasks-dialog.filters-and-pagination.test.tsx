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

type MockChildrenProps = { children?: React.ReactNode }
type MockOpenProps = MockChildrenProps & { open?: boolean }
type MockTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean
    open?: boolean
    setOpen?: (open: boolean) => void
}
type MockCheckboxItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & MockChildrenProps & {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    onSelect?: (event: { preventDefault: () => void }) => void
}
type RpcRequest = {
    fn: string
    args?: Record<string, unknown>
}

/**
 * Mock radix DropdownMenu for inline rendering in jsdom
 */
vi.mock('@/components/ui/dropdown-menu', () => {
    return {
        DropdownMenu: ({ children }: MockChildrenProps) => {
            const [open, setOpen] = React.useState(false)
            return (
                <div data-testid="dropdown-menu">
                    {React.Children.map(children, (child: React.ReactNode) =>
                        React.isValidElement(child)
                            ? React.cloneElement(child as React.ReactElement<MockTriggerProps>, { open, setOpen })
                            : child
                    )}
                </div>
            )
        },
        DropdownMenuTrigger: ({ children, asChild, open, setOpen, ...rest }: MockTriggerProps) => {
            const handleClick = () => setOpen?.(!open)
            if (asChild && React.isValidElement(children)) {
                const child = children as React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>
                return React.cloneElement(child, {
                    ...rest,
                    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
                        handleClick()
                        child.props.onClick?.(event)
                    },
                })
            }
            return <button {...rest} onClick={handleClick}>{children}</button>
        },
        DropdownMenuContent: ({ children, open, ...rest }: MockOpenProps & React.HTMLAttributes<HTMLDivElement>) => {
            if (!open) return null
            return <div data-testid="dropdown-content" {...rest}>{children}</div>
        },
        DropdownMenuCheckboxItem: ({ children, checked, onCheckedChange, onSelect, ...rest }: MockCheckboxItemProps) => (
            <button {...rest} onClick={() => { onSelect?.({ preventDefault: () => { } }); onCheckedChange?.(!checked) }}>
                {children}
            </button>
        ),
        DropdownMenuLabel: ({ children, ...rest }: MockChildrenProps & React.HTMLAttributes<HTMLDivElement>) => <div {...rest}>{children}</div>,
        DropdownMenuSeparator: () => <hr />,
        DropdownMenuItem: ({ children, onClick, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & MockChildrenProps) => (
            <button {...rest} onClick={onClick}>{children}</button>
        ),
    }
})

/**
 * Mock radix Dialog for inline rendering in jsdom
 */
vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children, open }: MockOpenProps) => open ? <div data-testid="dialog">{children}</div> : null,
    DialogContent: ({ children, ...rest }: MockChildrenProps & React.HTMLAttributes<HTMLDivElement>) => <div data-testid="dialog-content" {...rest}>{children}</div>,
    DialogHeader: ({ children }: MockChildrenProps) => <div>{children}</div>,
    DialogTitle: ({ children }: MockChildrenProps) => <h2>{children}</h2>,
    DialogDescription: ({ children }: MockChildrenProps) => <p>{children}</p>,
    DialogFooter: ({ children }: MockChildrenProps) => <div data-testid="dialog-footer">{children}</div>,
}))

/**
 * Mock scroll area for inline rendering
 */
vi.mock('@/components/ui/scroll-area', () => ({
    ScrollArea: ({ children }: MockChildrenProps) => <div>{children}</div>,
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
import type { MaintenancePlan } from '@/lib/data'

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

const MOCK_FILTER_BUCKETS = {
    department: [
        { name: 'ICU', count: 5 },
        { name: 'Surgery', count: 5 },
        { name: 'Radiology', count: 5 },
    ],
    user: [
        { name: 'User A', count: 8 },
        { name: 'User B', count: 7 },
    ],
    location: [
        { name: 'Room 1', count: 1 },
        { name: 'Room 2', count: 1 },
    ],
}

function mockRpcByPage() {
    mockCallRpc.mockImplementation((request: RpcRequest) => {
        const { fn, args } = request
        if (fn === 'equipment_filter_buckets') {
            return Promise.resolve(MOCK_FILTER_BUCKETS)
        }
        if (fn === 'equipment_list_enhanced') {
            const page = Number(args?.p_page ?? 1)
            const pageSize = Number(args?.p_page_size ?? 10)
            const start = (page - 1) * pageSize
            return Promise.resolve({
                data: MOCK_EQUIPMENT.slice(start, start + pageSize),
                total: 1947,
                page,
                pageSize,
            })
        }
        return Promise.resolve(null)
    })
}

describe('AddTasksDialog filters and pagination', () => {
    const baseProps = {
        open: true,
        onOpenChange: vi.fn(),
        plan: {
            id: 1,
            created_at: '2026-01-01T00:00:00Z',
            ten_ke_hoach: 'Test Plan',
            nam: 2026,
            khoa_phong: null,
            trang_thai: 'Bản nháp',
            ngay_phe_duyet: null,
            nguoi_duyet: null,
            nguoi_lap_ke_hoach: null,
            loai_cong_viec: 'Bảo trì',
            don_vi: 17,
        } satisfies MaintenancePlan,
        existingEquipmentIds: [] as number[],
        onSuccess: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockRpcByPage()
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

    it('requests server-side equipment pages within the plan tenant scope', async () => {
        renderWithQueryClient(<AddTasksDialog {...baseProps} />)

        await waitFor(() => {
            expect(screen.getByText('TB-001')).toBeInTheDocument()
        })

        expect(mockCallRpc).toHaveBeenCalledWith(expect.objectContaining({
            fn: 'equipment_list_enhanced',
            args: expect.objectContaining({
                p_page: 1,
                p_page_size: 10,
                p_don_vi: 17,
            }),
        }))
        expect(screen.getByText('Đã chọn 0 trên 1947 thiết bị phù hợp.')).toBeInTheDocument()
    })

    it('keeps selected equipment across server pages', async () => {
        const onSuccess = vi.fn()
        renderWithQueryClient(<AddTasksDialog {...baseProps} onSuccess={onSuccess} />)

        await waitFor(() => {
            expect(screen.getByText('TB-001')).toBeInTheDocument()
        })

        fireEvent.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0])
        fireEvent.click(screen.getByRole('button', { name: /Trang tiếp/i }))

        await waitFor(() => {
            expect(screen.getByText('TB-011')).toBeInTheDocument()
        })

        fireEvent.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0])
        fireEvent.click(screen.getByRole('button', { name: /Thêm 2 thiết bị/i }))

        expect(onSuccess).toHaveBeenCalledWith([
            expect.objectContaining({ id: 1 }),
            expect.objectContaining({ id: 11 }),
        ])
    })
})
