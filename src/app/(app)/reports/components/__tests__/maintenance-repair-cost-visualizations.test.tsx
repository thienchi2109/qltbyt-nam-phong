import * as React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const mockDynamicBarChart = vi.fn(() => <div data-testid="repair-cost-bar-chart" />)
const mockDynamicScatterChart = vi.fn(() => <div data-testid="repair-usage-cost-scatter" />)

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/dynamic-chart', () => ({
  DynamicBarChart: (props: unknown) => mockDynamicBarChart(props),
  DynamicScatterChart: (props: unknown) => mockDynamicScatterChart(props),
}))

import { MaintenanceRepairCostVisualizations } from '../maintenance-repair-cost-visualizations'

describe('MaintenanceRepairCostVisualizations', () => {
  const topEquipmentRepairCosts = [
    {
      equipmentId: 1,
      equipmentName: 'Monitor 1',
      equipmentCode: 'TB-001',
      totalRepairCost: 5000000,
      averageCompletedRepairCost: 2500000,
      completedRepairRequests: 2,
      costRecordedCount: 2,
    },
    {
      equipmentId: 2,
      equipmentName: 'Ventilator 2',
      equipmentCode: 'TB-002',
      totalRepairCost: 3200000,
      averageCompletedRepairCost: 1600000,
      completedRepairRequests: 2,
      costRecordedCount: 2,
    },
  ]

  const period = {
    points: [
      {
        equipmentId: 1,
        equipmentName: 'Monitor 1',
        equipmentCode: 'TB-001',
        totalUsageHours: 120,
        totalRepairCost: 5000000,
        completedRepairRequests: 2,
        costRecordedCount: 2,
      },
      {
        equipmentId: 2,
        equipmentName: 'Ventilator 2',
        equipmentCode: 'TB-002',
        totalUsageHours: 88,
        totalRepairCost: 3200000,
        completedRepairRequests: 2,
        costRecordedCount: 2,
      },
      {
        equipmentId: 3,
        equipmentName: 'Pump 3',
        equipmentCode: 'TB-003',
        totalUsageHours: 45,
        totalRepairCost: 1800000,
        completedRepairRequests: 1,
        costRecordedCount: 1,
      },
    ],
    dataQuality: {
      equipmentWithUsage: 4,
      equipmentWithRepairCost: 3,
      equipmentWithBoth: 3,
    },
  }

  const cumulative = {
    points: [
      {
        equipmentId: 1,
        equipmentName: 'Monitor 1',
        equipmentCode: 'TB-001',
        totalUsageHours: 180,
        totalRepairCost: 6500000,
        completedRepairRequests: 3,
        costRecordedCount: 3,
      },
      {
        equipmentId: 2,
        equipmentName: 'Ventilator 2',
        equipmentCode: 'TB-002',
        totalUsageHours: 110,
        totalRepairCost: 3200000,
        completedRepairRequests: 2,
        costRecordedCount: 2,
      },
      {
        equipmentId: 3,
        equipmentName: 'Pump 3',
        equipmentCode: 'TB-003',
        totalUsageHours: 70,
        totalRepairCost: 2100000,
        completedRepairRequests: 2,
        costRecordedCount: 1,
      },
    ],
    dataQuality: {
      equipmentWithUsage: 5,
      equipmentWithRepairCost: 4,
      equipmentWithBoth: 3,
    },
  }

  it('renders the top repair-cost chart and period correlation chart by default', () => {
    render(
      <MaintenanceRepairCostVisualizations
        topEquipmentRepairCosts={topEquipmentRepairCosts}
        repairUsageCostCorrelation={{ period, cumulative }}
      />
    )

    expect(screen.getByText('Top 10 thiết bị có chi phí sửa chữa cao nhất')).toBeInTheDocument()
    expect(screen.getByText('Giờ sử dụng và chi phí sửa chữa')).toBeInTheDocument()
    expect(screen.getByTestId('repair-cost-bar-chart')).toBeInTheDocument()
    expect(screen.getByTestId('repair-usage-cost-scatter')).toBeInTheDocument()

    expect(mockDynamicBarChart).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            equipmentName: 'Monitor 1',
            totalRepairCost: 5000000,
          }),
        ]),
      })
    )

    expect(mockDynamicScatterChart).toHaveBeenCalledWith(
      expect.objectContaining({
        data: period.points,
      })
    )
  })

  it('switches the correlation chart to cumulative mode without changing the top repair-cost chart', async () => {
    const user = userEvent.setup()

    render(
      <MaintenanceRepairCostVisualizations
        topEquipmentRepairCosts={topEquipmentRepairCosts}
        repairUsageCostCorrelation={{ period, cumulative }}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Lũy kế' }))

    expect(mockDynamicScatterChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: cumulative.points,
      })
    )
    expect(mockDynamicBarChart).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            equipmentCode: 'TB-001',
            totalRepairCost: 5000000,
          }),
        ]),
      })
    )
  })

  it('renders a correlation data-quality empty state when fewer than three equipment have both usage and repair cost', () => {
    render(
      <MaintenanceRepairCostVisualizations
        topEquipmentRepairCosts={topEquipmentRepairCosts}
        repairUsageCostCorrelation={{
          period: {
            points: period.points.slice(0, 2),
            dataQuality: {
              equipmentWithUsage: 5,
              equipmentWithRepairCost: 4,
              equipmentWithBoth: 2,
            },
          },
          cumulative,
        }}
      />
    )

    expect(screen.getByText('Chưa đủ dữ liệu để hiển thị tương quan.')).toBeInTheDocument()
    expect(screen.getByText('Thiết bị có giờ sử dụng: 5')).toBeInTheDocument()
    expect(screen.getByText('Thiết bị có chi phí sửa chữa: 4')).toBeInTheDocument()
    expect(screen.getByText('Thiết bị có đủ cả hai: 2')).toBeInTheDocument()
    expect(screen.queryByTestId('repair-usage-cost-scatter')).not.toBeInTheDocument()
  })

  it('renders a repair-cost empty state when no recorded repair cost data exists in the selected period', () => {
    render(
      <MaintenanceRepairCostVisualizations
        topEquipmentRepairCosts={[]}
        repairUsageCostCorrelation={{ period, cumulative }}
      />
    )

    expect(screen.getByText('Không có dữ liệu chi phí sửa chữa trong khoảng thời gian đã chọn.')).toBeInTheDocument()
    expect(screen.queryByTestId('repair-cost-bar-chart')).not.toBeInTheDocument()
  })
})
