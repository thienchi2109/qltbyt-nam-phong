import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DeviceQuotaMappingActions } from '../_components/DeviceQuotaMappingActions'
import type { DeviceQuotaMappingContextValue } from '../_components/DeviceQuotaMappingContext'
import { useDeviceQuotaMappingContext } from '../_hooks/useDeviceQuotaMappingContext'

vi.mock('../_hooks/useDeviceQuotaMappingContext', () => ({
  useDeviceQuotaMappingContext: vi.fn(),
}))

vi.mock('../_components/MappingPreviewDialog', () => ({
  MappingPreviewDialog: ({
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

    fireEvent.click(screen.getByRole('button', { name: /phân loại/i }))
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
})
