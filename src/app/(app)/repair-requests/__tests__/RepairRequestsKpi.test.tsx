/**
 * Tests for KPI summary cards behavior on Repair Requests page.
 *
 * Verifies that:
 * - KPI status counts query fires for authenticated users regardless of tenant selection
 * - KPI total is computed from status counts (not from gated table query)
 * - Table/list query stays gated by shouldFetchData
 * - Placeholder is shown when no tenant is selected for privileged users
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'
import { render, screen } from '@testing-library/react'

// ── Hoisted mocks ──────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
  useSession: vi.fn(),
  useTenantSelection: vi.fn(),
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
  toast: vi.fn(),
}))

// ── Module mocks ───────────────────────────────────────────────────────
vi.mock('@/lib/rpc-client', () => ({
  callRpc: mocks.callRpc,
}))

vi.mock('next-auth/react', () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock('@/contexts/TenantSelectionContext', () => ({
  useTenantSelection: () => mocks.useTenantSelection(),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock('@/hooks/use-tenant-branding', () => ({
  useTenantBranding: () => ({ data: null }),
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: () => false,
}))

vi.mock('@/hooks/use-debounce', () => ({
  useSearchDebounce: (v: string) => v,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/repair-requests',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/error-boundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock all child components to isolate KPI logic
vi.mock('../_components/RepairRequestsContext', () => ({
  RepairRequestsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../_hooks/useRepairRequestsContext', () => ({
  useRepairRequestsContext: () => ({
    isRegionalLeader: false,
    dialogState: { requestToView: null },
    openEditDialog: vi.fn(),
    openDeleteDialog: vi.fn(),
    openApproveDialog: vi.fn(),
    openCompleteDialog: vi.fn(),
    openViewDialog: vi.fn(),
    openCreateSheet: vi.fn(),
    closeAllDialogs: vi.fn(),
  }),
}))

vi.mock('../_hooks/useRepairRequestUIHandlers', () => ({
  useRepairRequestUIHandlers: () => ({ handleGenerateRequestSheet: vi.fn() }),
}))

vi.mock('../_hooks/useRepairRequestShortcuts', () => ({
  useRepairRequestShortcuts: vi.fn(),
}))

vi.mock('../_components/RepairRequestsColumns', () => ({
  useRepairRequestColumns: () => [],
  renderActions: () => null,
}))

vi.mock('../_components/RepairRequestsFilterModal', () => ({
  RepairRequestsFilterModal: () => null,
}))

vi.mock('../_components/RepairRequestsDetailContent', () => ({
  RepairRequestsDetailContent: () => null,
}))

vi.mock('../_components/RepairRequestsEditDialog', () => ({
  RepairRequestsEditDialog: () => null,
}))

vi.mock('../_components/RepairRequestsDeleteDialog', () => ({
  RepairRequestsDeleteDialog: () => null,
}))

vi.mock('../_components/RepairRequestsApproveDialog', () => ({
  RepairRequestsApproveDialog: () => null,
}))

vi.mock('../_components/RepairRequestsCompleteDialog', () => ({
  RepairRequestsCompleteDialog: () => null,
}))

vi.mock('../_components/RepairRequestsCreateSheet', () => ({
  RepairRequestsCreateSheet: () => null,
}))

vi.mock('../_components/RepairRequestsTable', () => ({
  RepairRequestsTable: () => <div data-testid="repair-table">table</div>,
}))

vi.mock('../_components/RepairRequestsToolbar', () => ({
  RepairRequestsToolbar: () => <div data-testid="repair-toolbar">toolbar</div>,
}))

vi.mock('../_components/RepairRequestsMobileList', () => ({
  RepairRequestsMobileList: () => null,
}))

vi.mock('@/components/shared/DataTablePagination', () => ({
  DataTablePagination: () => <div data-testid="pagination">pagination</div>,
}))

vi.mock('@/components/shared/TenantSelector', () => ({
  TenantSelector: () => <div data-testid="tenant-selector">selector</div>,
}))

vi.mock('@/components/repair-request-alert', () => ({
  RepairRequestAlert: () => null,
}))

vi.mock('@/components/summary/summary-bar', () => ({
  SummaryBar: ({ items, loading }: { items: Array<{ key: string; label: string; value: number }>; loading: boolean }) => (
    <div data-testid="summary-bar">
      {items.map((item) => (
        <div key={item.key} data-testid={`kpi-${item.key}`} data-value={item.value}>
          {item.label}: {item.value}
        </div>
      ))}
      {loading && <div data-testid="summary-loading">loading</div>}
    </div>
  ),
}))

vi.mock('@/lib/rr-prefs', () => ({
  getUiFilters: () => ({ status: [], dateRange: null }),
  setUiFilters: vi.fn(),
  getColumnVisibility: () => ({}),
  setColumnVisibility: vi.fn(),
}))

// Track useQuery calls to verify enabled conditions
let mockUseQueryCalls: Array<{ queryKey: unknown[]; enabled: boolean }> = []

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: unknown[]; enabled: boolean; queryFn: () => Promise<unknown> }) => {
    mockUseQueryCalls.push({ queryKey: options.queryKey, enabled: options.enabled })

    // Determine which query this is based on queryKey
    const key = options.queryKey[0] as string

    if (key === 'repair_request_status_counts') {
      return {
        data: mockStatusCounts,
        isLoading: false,
      }
    }

    if (key === 'repair_request_list') {
      return {
        data: options.enabled ? { data: [], total: 0, page: 1, pageSize: 20 } : undefined,
        isLoading: false,
        isFetching: false,
        refetch: vi.fn(),
      }
    }

    return { data: undefined, isLoading: false, isFetching: false }
  },
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}))

// ── Shared test state ──────────────────────────────────────────────────
let mockStatusCounts: Record<string, number> | undefined

// Import component AFTER mocks
import RepairRequestsPageClient from '../_components/RepairRequestsPageClient'

// ── Helpers ────────────────────────────────────────────────────────────
function setupGlobalUser(overrides: { shouldFetchData?: boolean } = {}) {
  mocks.useSession.mockReturnValue({
    data: {
      user: { id: 1, role: 'global', don_vi: null, dia_ban_id: null, name: 'Global Admin' },
    },
    status: 'authenticated',
  })

  mocks.useTenantSelection.mockReturnValue({
    selectedFacilityId: undefined,
    setSelectedFacilityId: vi.fn(),
    facilities: [
      { id: 1, name: 'Hospital A' },
      { id: 2, name: 'Hospital B' },
    ],
    showSelector: true,
    isLoading: false,
    shouldFetchData: overrides.shouldFetchData ?? false,
  })
}

function setupTenantUser() {
  mocks.useSession.mockReturnValue({
    data: {
      user: { id: 2, role: 'to_qltb', don_vi: 1, dia_ban_id: null, name: 'Tenant User' },
    },
    status: 'authenticated',
  })

  mocks.useTenantSelection.mockReturnValue({
    selectedFacilityId: 1,
    setSelectedFacilityId: vi.fn(),
    facilities: [],
    showSelector: false,
    isLoading: false,
    shouldFetchData: true,
  })
}

// ── Tests ──────────────────────────────────────────────────────────────
describe('RepairRequests KPI Cards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseQueryCalls = []
    mockStatusCounts = {
      'Chờ xử lý': 3,
      'Đã duyệt': 2,
      'Hoàn thành': 5,
      'Không HT': 1,
    }
    mocks.callRpc.mockResolvedValue([])
  })

  describe('KPI query fires without tenant selection', () => {
    it('should enable status counts query when user is authenticated but no tenant selected', () => {
      setupGlobalUser({ shouldFetchData: false })
      render(<RepairRequestsPageClient />)

      const statusCountsCall = mockUseQueryCalls.find(
        (c) => (c.queryKey[0] as string) === 'repair_request_status_counts'
      )
      expect(statusCountsCall).toBeDefined()
      expect(statusCountsCall!.enabled).toBe(true)
    })

    it('should pass p_don_vi as null when selectedFacilityId is undefined', () => {
      setupGlobalUser({ shouldFetchData: false })
      render(<RepairRequestsPageClient />)

      const statusCountsCall = mockUseQueryCalls.find(
        (c) => (c.queryKey[0] as string) === 'repair_request_status_counts'
      )
      // queryKey should have facilityId: null (coalesced from undefined)
      const params = statusCountsCall!.queryKey[1] as Record<string, unknown>
      expect(params.facilityId).toBeNull()
    })
  })

  describe('KPI total = sum of status counts', () => {
    it('should compute total KPI as sum of all status counts', () => {
      setupGlobalUser({ shouldFetchData: false })
      render(<RepairRequestsPageClient />)

      const totalKpi = screen.getByTestId('kpi-total')
      // 3 + 2 + 5 + 1 = 11
      expect(totalKpi).toHaveAttribute('data-value', '11')
    })

    it('should show 0 total when statusCounts is undefined', () => {
      mockStatusCounts = undefined
      setupGlobalUser({ shouldFetchData: false })
      render(<RepairRequestsPageClient />)

      const totalKpi = screen.getByTestId('kpi-total')
      expect(totalKpi).toHaveAttribute('data-value', '0')
    })

    it('should show individual status counts correctly', () => {
      setupGlobalUser({ shouldFetchData: false })
      render(<RepairRequestsPageClient />)

      expect(screen.getByTestId('kpi-Chờ xử lý')).toHaveAttribute('data-value', '3')
      expect(screen.getByTestId('kpi-Đã duyệt')).toHaveAttribute('data-value', '2')
      expect(screen.getByTestId('kpi-Hoàn thành')).toHaveAttribute('data-value', '5')
      expect(screen.getByTestId('kpi-Không HT')).toHaveAttribute('data-value', '1')
    })
  })

  describe('Table query stays gated', () => {
    it('should disable list query when shouldFetchData is false', () => {
      setupGlobalUser({ shouldFetchData: false })
      render(<RepairRequestsPageClient />)

      const listCall = mockUseQueryCalls.find(
        (c) => (c.queryKey[0] as string) === 'repair_request_list'
      )
      expect(listCall).toBeDefined()
      expect(listCall!.enabled).toBe(false)
    })

    it('should enable list query when shouldFetchData is true', () => {
      setupTenantUser()
      render(<RepairRequestsPageClient />)

      const listCall = mockUseQueryCalls.find(
        (c) => (c.queryKey[0] as string) === 'repair_request_list'
      )
      expect(listCall).toBeDefined()
      expect(listCall!.enabled).toBe(true)
    })
  })

  describe('Placeholder shown when no tenant selected', () => {
    it('should show tenant selection placeholder when shouldFetchData is false', () => {
      setupGlobalUser({ shouldFetchData: false })
      render(<RepairRequestsPageClient />)

      expect(screen.getByText('Chọn cơ sở y tế')).toBeInTheDocument()
      expect(
        screen.getByText(/Vui lòng chọn một cơ sở y tế/)
      ).toBeInTheDocument()
    })

    it('should not show table or pagination when shouldFetchData is false', () => {
      setupGlobalUser({ shouldFetchData: false })
      render(<RepairRequestsPageClient />)

      // Toolbar is always visible (contains search/filters for tenant selection)
      expect(screen.queryByTestId('repair-table')).not.toBeInTheDocument()
      expect(screen.queryByTestId('pagination')).not.toBeInTheDocument()
    })

    it('should show table and pagination when shouldFetchData is true', () => {
      setupTenantUser()
      render(<RepairRequestsPageClient />)

      expect(screen.queryByText('Chọn cơ sở y tế')).not.toBeInTheDocument()
      expect(screen.getByTestId('repair-toolbar')).toBeInTheDocument()
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
  })

  describe('KPI total consistency with status filters', () => {
    it('should use status counts total, not list total, for KPI', () => {
      // Setup: tenant user with shouldFetchData=true, but list returns different total
      setupTenantUser()
      // statusCounts sums to 11, but list total would be different if filtered
      mockStatusCounts = {
        'Chờ xử lý': 10,
        'Đã duyệt': 5,
        'Hoàn thành': 20,
        'Không HT': 3,
      }
      render(<RepairRequestsPageClient />)

      const totalKpi = screen.getByTestId('kpi-total')
      // Should be 10 + 5 + 20 + 3 = 38, from statusCounts, not from list total
      expect(totalKpi).toHaveAttribute('data-value', '38')
    })
  })
})
