/**
 * TDD RED phase: Tests for RepairRequestsPageLayout component.
 *
 * Verifies header, summary bar, create button visibility,
 * tenant placeholder, and table rendering.
 */
import { describe, it, expect, vi } from 'vitest'
import * as React from 'react'
import "@testing-library/jest-dom"
import { render, screen } from '@testing-library/react'
import type { Table } from '@tanstack/react-table'
import { RepairRequestsPageLayout } from '../_components/RepairRequestsPageLayout'
import type { RepairRequestWithEquipment } from '../types'
import type { RepairRequestColumnOptions } from '../_components/RepairRequestsColumns'

// ── Mock child components ──────────────────────────────────────────────
vi.mock('@/components/repair-request-alert', () => ({
  RepairRequestAlert: () => null,
}))

vi.mock('@/components/kpi', () => ({
  KpiStatusBar: ({ configs, counts, loading }: {
    configs: Array<{ key: string; label: string }>;
    counts: Record<string, number> | undefined;
    loading: boolean;
  }) => {
    const total = counts ? Object.values(counts).reduce((s, v) => s + (v || 0), 0) : 0
    return (
      <div data-testid="kpi-status-bar">
        <div data-testid="kpi-total" data-value={total}>Tổng: {total}</div>
        {configs.map((c: { key: string; label: string }) => (
          <div key={c.key} data-testid={`kpi-${c.key}`} data-value={counts?.[c.key] ?? 0}>
            {c.label}: {counts?.[c.key] ?? 0}
          </div>
        ))}
        {loading && <div data-testid="kpi-loading">loading</div>}
      </div>
    )
  },
  REPAIR_STATUS_CONFIGS: [
    { key: 'Chờ xử lý', label: 'Chờ xử lý', tone: 'warning' },
    { key: 'Đã duyệt', label: 'Đã duyệt', tone: 'muted' },
    { key: 'Hoàn thành', label: 'Hoàn thành', tone: 'success' },
    { key: 'Không HT', label: 'Không HT', tone: 'danger' },
  ],
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
  statusCounts: { 'Chờ xử lý': 3, 'Đã duyệt': 2, 'Hoàn thành': 5, 'Không HT': 0 } as Record<string, number> | undefined,
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
  } as unknown as Table<RepairRequestWithEquipment>,
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
  columnOptions: {} as RepairRequestColumnOptions,
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

  it('renders KpiStatusBar with provided counts', () => {
    const counts = { 'Chờ xử lý': 10, 'Đã duyệt': 5, 'Hoàn thành': 20, 'Không HT': 7 }
    render(<RepairRequestsPageLayout {...defaultProps} statusCounts={counts} />)
    expect(screen.getByTestId('kpi-total')).toHaveAttribute('data-value', '42')
  })
})
