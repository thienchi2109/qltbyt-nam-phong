import * as React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const mockOpenRepair = vi.fn()

vi.mock('../LinkedRequestContext', () => ({
  useLinkedRequest: () => ({ openRepair: mockOpenRepair }),
}))

import { LinkedRequestRowIndicator } from '../LinkedRequestRowIndicator'

describe('LinkedRequestRowIndicator', () => {
  beforeEach(() => {
    mockOpenRepair.mockClear()
  })

  it('renders null when tinh_trang_hien_tai is not "Chờ sửa chữa"', () => {
    const { container } = render(
      <LinkedRequestRowIndicator
        equipmentId={1}
        tinh_trang_hien_tai="Hoạt động"
        active_repair_request_id={42}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders null when active_repair_request_id is null', () => {
    const { container } = render(
      <LinkedRequestRowIndicator
        equipmentId={1}
        tinh_trang_hien_tai="Chờ sửa chữa"
        active_repair_request_id={null}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders null when active_repair_request_id is undefined', () => {
    const { container } = render(
      <LinkedRequestRowIndicator
        equipmentId={1}
        tinh_trang_hien_tai="Chờ sửa chữa"
        active_repair_request_id={undefined}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders Wrench icon when status is "Chờ sửa chữa" and active_repair_request_id exists', () => {
    render(
      <LinkedRequestRowIndicator
        equipmentId={1}
        tinh_trang_hien_tai="Chờ sửa chữa"
        active_repair_request_id={42}
      />,
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Xem phiếu yêu cầu sửa chữa')
  })

  it('calls openRepair with equipmentId on click', async () => {
    const user = userEvent.setup()
    render(
      <LinkedRequestRowIndicator
        equipmentId={7}
        tinh_trang_hien_tai="Chờ sửa chữa"
        active_repair_request_id={99}
      />,
    )
    await user.click(screen.getByRole('button'))
    expect(mockOpenRepair).toHaveBeenCalledTimes(1)
    expect(mockOpenRepair).toHaveBeenCalledWith(7)
  })
})
