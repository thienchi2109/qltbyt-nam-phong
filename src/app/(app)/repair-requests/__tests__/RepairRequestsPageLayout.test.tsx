/**
 * TDD RED phase: Tests for RepairRequestsPageLayout component.
 *
 * Verifies header, summary bar, create button visibility,
 * tenant placeholder, and table rendering.
 */
import { describe, it, expect, vi } from 'vitest'
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { RepairRequestsPageLayout } from '../_components/RepairRequestsPageLayout'

// ── Mock child components ──────────────────────────────────────────────
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
      {loading ? <div data-testid="summary-loading">loading</div> : null}
    </div>
  ),
}))

vi.mock('../_components/RepairRequestsCreateSheet', () => ({
  RepairRequestsCreateSheet: () => <div data-testid="create-sheet">create-sheet</div>,
}))

vi.mock('../_components/RepairRequestsToolbar', () => ({
  RepairRequestsToolbar: () => <div data-testid="repair-toolbar">toolbar</div>,
}))

vi.mock('../_components/RepairRequestsFilterModal', () => ({
  RepairRequestsFilterModal: () => null,
}))

vi.mock('../_components/RepairRequestsTable', () => ({
  RepairRequestsTable: () => <div data-testid="repair-table">table</div>,
}))

vi.mock('../_components/RepairRequestsMobileList', () => ({
  RepairRequestsMobileList: () => <div data-testid="mobile-list">mobile</div>,
}))

vi.mock('../_components/RepairRequestsColumns', () => ({
  renderActions: () => null,
}))

vi.mock('@/components/shared/DataTablePagination', () => ({
  DataTablePagination: () => <div data-testid="pagination">pagination</div>,
}))

vi.mock('@/components/shared/TenantSelector', () => ({
  TenantSelector: () => <div data-testid="tenant-selector">selector</div>,
}))

// ── Helpers ────────────────────────────────────────────────────────────
const defaultProps = {
  selectedFacilityName: null,
  isRegionalLeader: false,
  summaryItems: [
    { key: 'total', label: 'Tổng', value: 10, tone: 'default' as const },
  ],
  statusCountsLoading: false,
  requests: [],
  searchTerm: '',
  onSearchChange: vi.fn(),
  searchInputRef: { current: null },
  isFiltered: false,
  onClearFilters: vi.fn(),
  isFilterModalOpen: false,
  onFilterModalOpenChange: vi.fn(),
  uiFilters: { status: [] as string[], dateRange: null },
  onFilterChange: vi.fn(),
  selectedFacilityId: null as number | null,
  showFacilityFilter: false,
  facilityOptions: [] as Array<{ id: number; name: string }>,
  onRemoveFilter: vi.fn(),
  table: {
    getRowModel: () => ({ rows: [] }),
    getState: () => ({ columnFilters: [] }),
    resetColumnFilters: vi.fn(),
  } as any,
  tableKey: 'all_0',
  isMobile: false,
  shouldFetchData: true,
  isLoading: false,
  isFetching: false,
  totalRequests: 0,
  repairPagination: {
    pagination: { pageIndex: 0, pageSize: 20 },
    setPagination: vi.fn(),
  },
  columnOptions: {} as any,
  setRequestToView: vi.fn(),
  openCreateSheet: vi.fn(),
}

// ── Tests ──────────────────────────────────────────────────────────────
describe('RepairRequestsPageLayout', () => {
  it('renders header with title "Yêu cầu sửa chữa"', () => {
    render(<RepairRequestsPageLayout {...defaultProps} />)
    expect(screen.getByText('Yêu cầu sửa chữa')).toBeInTheDocument()
  })

  it('renders facility name subtitle when provided', () => {
    render(<RepairRequestsPageLayout {...defaultProps} selectedFacilityName="Hospital A" />)
    expect(screen.getByText('Hospital A')).toBeInTheDocument()
  })

  it('hides create button when isRegionalLeader=true', () => {
    render(<RepairRequestsPageLayout {...defaultProps} isRegionalLeader={true} />)
    expect(screen.queryByText('Tạo yêu cầu')).not.toBeInTheDocument()
  })

  it('shows create button when isRegionalLeader=false', () => {
    render(<RepairRequestsPageLayout {...defaultProps} isRegionalLeader={false} isMobile={false} />)
    expect(screen.getByText('Tạo yêu cầu')).toBeInTheDocument()
  })

  it('shows tenant selection placeholder when shouldFetchData=false', () => {
    render(<RepairRequestsPageLayout {...defaultProps} shouldFetchData={false} />)
    expect(screen.getByText('Chọn cơ sở y tế')).toBeInTheDocument()
    expect(screen.getByText(/Vui lòng chọn một cơ sở y tế/)).toBeInTheDocument()
  })

  it('shows table content when shouldFetchData=true', () => {
    render(<RepairRequestsPageLayout {...defaultProps} shouldFetchData={true} />)
    expect(screen.queryByText('Chọn cơ sở y tế')).not.toBeInTheDocument()
    expect(screen.getByTestId('repair-table')).toBeInTheDocument()
    expect(screen.getByTestId('pagination')).toBeInTheDocument()
  })

  it('renders SummaryBar with provided items', () => {
    const items = [
      { key: 'total', label: 'Tổng', value: 42, tone: 'default' as const },
    ]
    render(<RepairRequestsPageLayout {...defaultProps} summaryItems={items} />)
    expect(screen.getByTestId('kpi-total')).toHaveAttribute('data-value', '42')
  })
})
