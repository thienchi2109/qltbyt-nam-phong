import * as React from 'react'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { RepairRequestWithEquipment } from '@/app/(app)/repair-requests/types'
import { STRINGS } from '@/components/equipment-linked-request/strings'

const mocks = vi.hoisted(() => ({
  detailView: vi.fn(),
}))

vi.mock('@/app/(app)/repair-requests/_components/RepairRequestsDetailView', () => ({
  RepairRequestsDetailView: ({
    requestToView,
    onClose,
    contentHeader,
    footerContent,
  }: {
    requestToView: RepairRequestWithEquipment | null
    onClose: () => void
    contentHeader?: React.ReactNode
    footerContent?: React.ReactNode
  }) => {
    mocks.detailView({ requestToView, onClose, contentHeader, footerContent })
    return (
      <div role="dialog" data-testid="detail-view">
        <div data-testid="content-header">{contentHeader}</div>
        <div data-testid="footer-content">{footerContent}</div>
      </div>
    )
  },
}))

import RepairRequestSheetAdapter from '../adapters/repairRequestSheetAdapter'

const mockRequest = {
  id: 9001,
  thiet_bi_id: 42,
} as RepairRequestWithEquipment

describe('RepairRequestSheetAdapter', () => {
  it('injects the multi-active alert and repair-requests link into the detail sheet slots', () => {
    render(<RepairRequestSheetAdapter request={mockRequest} activeCount={3} onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('alert')).toHaveTextContent(STRINGS.multiActiveAlert(3))
    expect(
      within(dialog).getByRole('link', { name: STRINGS.footerOpenInRepairRequests }),
    ).toHaveAttribute('href', '/repair-requests?equipmentId=42')
  })
})
