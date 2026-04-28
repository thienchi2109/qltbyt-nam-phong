import * as React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Equipment } from '@/types/database'
import { LinkedRequestProvider } from '../LinkedRequestContext'
import { LinkedRequestRowIndicator } from '../LinkedRequestRowIndicator'

const mockCallRpc = vi.fn()

vi.mock('@/lib/rpc-client', () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))

vi.mock('@/components/ui/tooltip', async () => {
  const { tooltipMockModule } = await import('@/test-utils/tooltip-mock')
  return tooltipMockModule
})

const baseEquipment = {
  id: 42,
  ma_thiet_bi: 'TB-042',
  tinh_trang_hien_tai: 'Chờ sửa chữa',
  active_repair_request_id: 777,
} satisfies Pick<Equipment, 'id' | 'ma_thiet_bi' | 'tinh_trang_hien_tai' | 'active_repair_request_id'>

function renderIndicator(
  equipment: Pick<Equipment, 'id' | 'ma_thiet_bi' | 'tinh_trang_hien_tai' | 'active_repair_request_id'> = baseEquipment,
  onParentClick = vi.fn(),
) {
  const handleParentKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onParentClick()
    }
  }

  return {
    onParentClick,
    ...render(
      <LinkedRequestProvider>
        <div
          role="button"
          tabIndex={0}
          onClick={onParentClick}
          onKeyDown={handleParentKeyDown}
        >
          parent
          <LinkedRequestRowIndicator equipment={equipment} />
        </div>
      </LinkedRequestProvider>,
    ),
  }
}

describe('LinkedRequestRowIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hides when equipment is not waiting for repair', () => {
    renderIndicator({ ...baseEquipment, tinh_trang_hien_tai: 'Hoạt động' })

    expect(screen.queryByRole('button', { name: /yêu cầu sửa chữa hiện tại/i })).toBeNull()
  })

  it('hides when waiting repair equipment has no active request id', () => {
    renderIndicator({ ...baseEquipment, active_repair_request_id: null })

    expect(screen.queryByRole('button', { name: /yêu cầu sửa chữa hiện tại/i })).toBeNull()
  })

  it('renders with accessible label and tooltip when row has an active repair request', async () => {
    const user = userEvent.setup()
    renderIndicator()

    const button = screen.getByRole('button', {
      name: 'Xem yêu cầu sửa chữa hiện tại của thiết bị TB-042',
    })
    await user.hover(button)

    expect(screen.getByRole('tooltip')).toHaveTextContent('Xem phiếu yêu cầu sửa chữa')
    expect(mockCallRpc).not.toHaveBeenCalled()
  })

  it('opens the linked repair request without bubbling to the parent row', async () => {
    const user = userEvent.setup()
    const onParentClick = vi.fn()
    renderIndicator(baseEquipment, onParentClick)

    await user.click(screen.getByRole('button', {
      name: 'Xem yêu cầu sửa chữa hiện tại của thiết bị TB-042',
    }))

    expect(onParentClick).not.toHaveBeenCalled()
    expect(mockCallRpc).not.toHaveBeenCalled()
  })
})
