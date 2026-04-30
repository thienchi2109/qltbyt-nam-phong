import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/dynamic-chart', () => ({
  DynamicBarChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="dynamic-bar-chart">{JSON.stringify(data)}</div>
  ),
  DynamicPieChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="dynamic-pie-chart">{JSON.stringify(data)}</div>
  ),
  DynamicLineChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="dynamic-line-chart">{JSON.stringify(data)}</div>
  ),
}))

import { AssistantReportChartCard } from '../AssistantReportChartCard'

describe('AssistantReportChartCard', () => {
  it('renders a bar chart for grouped department counts', () => {
    render(
      <AssistantReportChartCard
        artifact={{
          kind: 'reportChart',
          version: 1,
          title: 'Số lượng thiết bị theo khoa',
          chart: {
            type: 'bar',
            xKey: 'khoa_phong_quan_ly',
            yKey: 'so_luong',
            data: [{ khoa_phong_quan_ly: 'ICU', so_luong: 12 }],
          },
          table: {
            columns: ['khoa_phong_quan_ly', 'so_luong'],
            rows: [{ khoa_phong_quan_ly: 'ICU', so_luong: 12 }],
          },
        }}
      />,
    )

    expect(screen.getByText('Số lượng thiết bị theo khoa')).toBeInTheDocument()
    expect(screen.getByTestId('dynamic-bar-chart')).toBeInTheDocument()
  })

  it('renders a pie chart for status ratio data', () => {
    render(
      <AssistantReportChartCard
        artifact={{
          kind: 'reportChart',
          version: 1,
          title: 'Tỷ lệ tình trạng thiết bị',
          chart: {
            type: 'pie',
            labelKey: 'tinh_trang_hien_tai',
            valueKey: 'so_luong',
            data: [{ tinh_trang_hien_tai: 'Hoạt động', so_luong: 21 }],
          },
        }}
      />,
    )

    expect(screen.getByTestId('dynamic-pie-chart')).toBeInTheDocument()
  })
})
