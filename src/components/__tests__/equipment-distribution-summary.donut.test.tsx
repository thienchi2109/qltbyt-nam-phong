import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EquipmentDistributionSummary } from '@/components/equipment-distribution-summary'

const mockUseEquipmentDistribution = vi.fn()
const mockDynamicPieChart = vi.fn(({ data }) => (
  <div data-testid="status-donut">{JSON.stringify(data)}</div>
))

vi.mock('@/hooks/use-equipment-distribution', () => ({
  useEquipmentDistribution: (...args: unknown[]) => mockUseEquipmentDistribution(...args),
  STATUS_COLORS: {
    hoat_dong: '#22c55e',
    cho_sua_chua: '#ef4444',
    cho_bao_tri: '#f59e0b',
    cho_hieu_chuan: '#8b5cf6',
    ngung_su_dung: '#6b7280',
    chua_co_nhu_cau: '#9ca3af',
  },
  STATUS_LABELS: {
    hoat_dong: 'Hoạt động',
    cho_sua_chua: 'Chờ sửa chữa',
    cho_bao_tri: 'Chờ bảo trì',
    cho_hieu_chuan: 'Chờ HC/KĐ',
    ngung_su_dung: 'Ngừng sử dụng',
    chua_co_nhu_cau: 'Chưa có nhu cầu',
  },
}))

vi.mock('@/components/dynamic-chart', () => ({
  DynamicPieChart: (props: unknown) => mockDynamicPieChart(props),
}))

describe('EquipmentDistributionSummary donut', () => {
  it('renders donut chart for selected facility and includes balanced layout wrapper', () => {
    mockUseEquipmentDistribution.mockReturnValue({
      data: {
        totalEquipment: 10,
        byDepartment: [
          {
            name: 'Khoa A',
            total: 10,
            hoat_dong: 8,
            cho_sua_chua: 2,
            cho_bao_tri: 0,
            cho_hieu_chuan: 0,
            ngung_su_dung: 0,
            chua_co_nhu_cau: 0,
          },
        ],
        byLocation: [],
        departments: ['Khoa A'],
        locations: [],
      },
      isLoading: false,
      error: null,
    })

    render(<EquipmentDistributionSummary tenantFilter="42" selectedDonVi={42} effectiveTenantKey="42" />)

    expect(screen.getByTestId('status-donut')).toBeInTheDocument()
    expect(mockUseEquipmentDistribution).toHaveBeenCalledWith(undefined, undefined, '42', 42, '42')
    expect(screen.getByTestId('status-distribution-layout')).toBeInTheDocument()
  })

  it('shows empty-state message when all status counts are zero', () => {
    mockUseEquipmentDistribution.mockReturnValue({
      data: {
        totalEquipment: 0,
        byDepartment: [
          {
            name: 'Khoa A',
            total: 0,
            hoat_dong: 0,
            cho_sua_chua: 0,
            cho_bao_tri: 0,
            cho_hieu_chuan: 0,
            ngung_su_dung: 0,
            chua_co_nhu_cau: 0,
          },
        ],
        byLocation: [],
        departments: ['Khoa A'],
        locations: [],
      },
      isLoading: false,
      error: null,
    })

    render(<EquipmentDistributionSummary tenantFilter="42" selectedDonVi={42} effectiveTenantKey="42" />)

    expect(screen.getByText('Không có dữ liệu trạng thái')).toBeInTheDocument()
  })
  it('renders legend keys for donut status colors', () => {
    mockUseEquipmentDistribution.mockReturnValue({
      data: {
        totalEquipment: 10,
        byDepartment: [
          {
            name: 'Khoa A',
            total: 10,
            hoat_dong: 8,
            cho_sua_chua: 2,
            cho_bao_tri: 0,
            cho_hieu_chuan: 0,
            ngung_su_dung: 0,
            chua_co_nhu_cau: 0,
          },
        ],
        byLocation: [],
        departments: ['Khoa A'],
        locations: [],
      },
      isLoading: false,
      error: null,
    })

    render(<EquipmentDistributionSummary tenantFilter="42" selectedDonVi={42} effectiveTenantKey="42" />)

    expect(screen.getByTestId('status-donut-legend')).toBeInTheDocument()
    expect(screen.getAllByTestId('status-donut-legend-item')).toHaveLength(2)
    expect(screen.getByTestId('status-donut-legend-swatch-hoat_dong')).toBeInTheDocument()
    expect(screen.getByTestId('status-donut-legend-swatch-cho_sua_chua')).toBeInTheDocument()
  })
})
