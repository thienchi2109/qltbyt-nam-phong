import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Component under test — will be extracted from RepairRequestsMobileList IIFE
import { DaysRemainingBar } from '../_components/DaysRemainingBar'

describe('DaysRemainingBar', () => {
  beforeEach(() => {
    // Pin Date.now to 2026-03-22 for deterministic tests
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-22T00:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when status is completed (Hoàn thành)', () => {
    const { container } = render(
      <DaysRemainingBar deadline="2026-04-01" status="Hoàn thành" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when status is Không HT', () => {
    const { container } = render(
      <DaysRemainingBar deadline="2026-04-01" status="Không HT" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders a progress bar with success text when > 7 days remain', () => {
    render(<DaysRemainingBar deadline="2026-04-10" status="Chờ xử lý" />)
    expect(screen.getByText(/Còn \d+ ngày/)).toBeInTheDocument()
  })

  it('renders a progress bar with warning text when 1-7 days remain', () => {
    render(<DaysRemainingBar deadline="2026-03-25" status="Đã duyệt" />)
    expect(screen.getByText(/Còn \d+ ngày/)).toBeInTheDocument()
  })

  it('renders overdue text when past deadline', () => {
    render(<DaysRemainingBar deadline="2026-03-20" status="Chờ xử lý" />)
    expect(screen.getByText(/Quá hạn \d+ ngày/)).toBeInTheDocument()
  })

  it('contains a progress bar div', () => {
    const { container } = render(
      <DaysRemainingBar deadline="2026-04-01" status="Chờ xử lý" />,
    )
    // The progress bar has a rounded-full class
    const bars = container.querySelectorAll('.rounded-full')
    expect(bars.length).toBeGreaterThanOrEqual(1)
  })
})
