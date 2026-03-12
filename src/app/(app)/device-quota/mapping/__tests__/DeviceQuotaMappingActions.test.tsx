import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DeviceQuotaMappingActions } from '../_components/DeviceQuotaMappingActions'
import type { DeviceQuotaMappingContextValue } from '../_components/DeviceQuotaMappingContext'
import { useDeviceQuotaMappingContext } from '../_hooks/useDeviceQuotaMappingContext'

vi.mock('../_hooks/useDeviceQuotaMappingContext', () => ({
  useDeviceQuotaMappingContext: vi.fn(),
}))

vi.mock('../_components/DeviceQuotaMappingPreviewDialog', () => ({
  DeviceQuotaMappingPreviewDialog: ({
    open,
    onConfirm,
    isLinking,
    targetCategory,
  }: {
    open: boolean
    onConfirm: (confirmedIds: number[]) => void
    isLinking: boolean
    targetCategory: { ten_nhom: string } | null
  }) =>
    open ? (
      <div data-testid="mapping-preview-dialog">
        <div data-testid="linking-state">
          {isLinking ? 'linking' : 'idle'}
        </div>
        <div>{targetCategory?.ten_nhom}</div>
        <button onClick={() => onConfirm([101, 102])}>Xác nhận preview</button>
      </div>
    ) : null,
}))

vi.mock('../_components/SuggestedMappingPreviewDialog', () => ({
  SuggestedMappingPreviewDialog: ({
    open,
  }: {
    open: boolean
  }) =>
    open ? (
      <div data-testid="suggested-mapping-dialog">Suggested dialog</div>
    ) : null,
}))

const mockUseContext = vi.mocked(useDeviceQuotaMappingContext)

const mutate = vi.fn()

const makeContext = (overrides: Record<string, unknown> = {}) => ({
  selectedEquipmentIds: new Set([101, 102]),
  selectedCategoryId: 5,
  allCategories: [
    {
      id: 5,
      parent_id: null,
      ma_nhom: 'A',
      ten_nhom: 'Nhóm A',
      phan_loai: null,
      level: 1,
      so_luong_hien_co: 0,
    },
  ],
  linkEquipment: { mutate },
  isLinking: false,
  donViId: 1,
  user: { id: '1', username: 'admin', role: 'admin' },
  ...overrides,
})

describe('DeviceQuotaMappingActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the preview open while linking and closes it only after success', () => {
    const context = makeContext()
    mockUseContext.mockImplementation(
      () => context as unknown as DeviceQuotaMappingContextValue
    )

    const { rerender } = render(<DeviceQuotaMappingActions />)

    fireEvent.click(screen.getByRole('button', { name: 'Phân loại' }))
    expect(screen.getByTestId('mapping-preview-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('linking-state')).toHaveTextContent('idle')

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận preview' }))

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate).toHaveBeenCalledWith(
      { thiet_bi_ids: [101, 102], nhom_id: 5 },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    )
    expect(screen.getByTestId('mapping-preview-dialog')).toBeInTheDocument()

    context.isLinking = true
    rerender(<DeviceQuotaMappingActions />)
    expect(screen.getByTestId('linking-state')).toHaveTextContent('linking')

    const [, options] = mutate.mock.calls[0] as [
      { thiet_bi_ids: number[]; nhom_id: number },
      { onSuccess: () => void }
    ]
    context.isLinking = false
    act(() => {
      options.onSuccess()
    })
    rerender(<DeviceQuotaMappingActions />)

    expect(screen.queryByTestId('mapping-preview-dialog')).not.toBeInTheDocument()
  })

  it('shows "Gợi ý phân loại" button when donViId is set, even without equipment selection', () => {
    mockUseContext.mockImplementation(
      () =>
        makeContext({
          selectedEquipmentIds: new Set(),
          selectedCategoryId: null,
        }) as unknown as DeviceQuotaMappingContextValue
    )

    render(<DeviceQuotaMappingActions />)

    expect(screen.getByRole('button', { name: /gợi ý phân loại/i })).toBeInTheDocument()
  })

  it('opens suggested mapping dialog when "Gợi ý phân loại" button is clicked', () => {
    mockUseContext.mockImplementation(
      () =>
        makeContext({
          selectedEquipmentIds: new Set(),
          selectedCategoryId: null,
        }) as unknown as DeviceQuotaMappingContextValue
    )

    render(<DeviceQuotaMappingActions />)

    fireEvent.click(screen.getByRole('button', { name: /gợi ý phân loại/i }))

    expect(screen.getByTestId('suggested-mapping-dialog')).toBeInTheDocument()
  })

  it('does not show "Gợi ý phân loại" button when donViId is null', () => {
    mockUseContext.mockImplementation(
      () =>
        makeContext({
          selectedEquipmentIds: new Set(),
          selectedCategoryId: null,
          donViId: null,
        }) as unknown as DeviceQuotaMappingContextValue
    )

    render(<DeviceQuotaMappingActions />)

    expect(screen.queryByRole('button', { name: /gợi ý phân loại/i })).not.toBeInTheDocument()
  })
})

