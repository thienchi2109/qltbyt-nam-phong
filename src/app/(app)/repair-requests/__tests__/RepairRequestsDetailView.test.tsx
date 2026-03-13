/**
 * TDD RED phase: Tests for RepairRequestsDetailView component.
 *
 * Verifies:
 * - Renders nothing when requestToView is null
 * - Renders Dialog on mobile / Sheet on desktop
 * - Shows correct title
 * - Calls onClose when close button clicked
 */

// Polyfill matchMedia for Radix Dialog/Sheet in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

import { describe, it, expect, vi } from 'vitest'
import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { RepairRequestsDetailView } from '../_components/RepairRequestsDetailView'
import type { RepairRequestWithEquipment } from '../types'

// Mock RepairRequestsDetailContent to isolate the view wrapper
vi.mock('../_components/RepairRequestsDetailContent', () => ({
  RepairRequestsDetailContent: ({ request }: { request: unknown }) => (
    <div data-testid="detail-content">detail for {(request as any)?.ten_thiet_bi}</div>
  ),
}))

const mockRequest = {
  id: 1,
  ten_thiet_bi: 'Test Device',
  trang_thai: 'Chờ xử lý',
  ngay_yeu_cau: '2026-01-01',
  mo_ta_su_co: 'Broken screen',
  don_vi_id: 1,
  equipment_id: 100,
  don_vi_name: 'Hospital A',
} as unknown as RepairRequestWithEquipment

describe('RepairRequestsDetailView', () => {
  it('renders nothing when requestToView is null', () => {
    const { container } = render(
      <RepairRequestsDetailView requestToView={null} isMobile={false} onClose={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders Dialog with correct title on mobile', () => {
    const { container } = render(
      <RepairRequestsDetailView requestToView={mockRequest} isMobile={true} onClose={vi.fn()} />
    )
    expect(screen.getByText('Chi tiết yêu cầu sửa chữa')).toBeInTheDocument()
    expect(screen.getByTestId('detail-content')).toHaveTextContent('detail for Test Device')
    // Dialog uses centered positioning (translate-x), not side-anchored
    const dialogEl = screen.getByRole('dialog')
    expect(dialogEl.className).toContain('translate-x-')
    expect(dialogEl.className).not.toContain('inset-y-0')
  })

  it('renders Sheet with correct title on desktop', () => {
    const { container } = render(
      <RepairRequestsDetailView requestToView={mockRequest} isMobile={false} onClose={vi.fn()} />
    )
    expect(screen.getByText('Chi tiết yêu cầu sửa chữa')).toBeInTheDocument()
    expect(screen.getByTestId('detail-content')).toHaveTextContent('detail for Test Device')
    // Sheet uses side-anchored positioning (inset-y-0), not centered
    const dialogEl = screen.getByRole('dialog')
    expect(dialogEl.className).toContain('inset-y-0')
    expect(dialogEl.className).not.toContain('translate-x-')
  })

  it('calls onClose when close button clicked on mobile', () => {
    const onClose = vi.fn()
    render(
      <RepairRequestsDetailView requestToView={mockRequest} isMobile={true} onClose={onClose} />
    )
    const closeButton = screen.getByRole('button', { name: /đóng/i })
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when close button clicked on desktop', () => {
    const onClose = vi.fn()
    render(
      <RepairRequestsDetailView requestToView={mockRequest} isMobile={false} onClose={onClose} />
    )
    const closeButton = screen.getByRole('button', { name: /đóng/i })
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
