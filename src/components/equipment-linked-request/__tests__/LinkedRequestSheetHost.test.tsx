import * as React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCallRpc = vi.fn()
const mockToast = vi.fn()

vi.mock('@/lib/rpc-client', () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))

vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}))

// Stub the lazy adapter to a synchronous component so we can read its props.
vi.mock('@/components/equipment-linked-request/adapters/repairRequestSheetAdapter', () => ({
  default: ({ request, activeCount, onClose }: {
    request: { id: number }
    activeCount: number
    onClose: () => void
  }) => (
    <div data-testid="adapter-stub">
      <span data-testid="adapter-request-id">{request.id}</span>
      <span data-testid="adapter-active-count">{activeCount}</span>
      <button type="button" onClick={onClose}>stub-close</button>
    </div>
  ),
}))

// Force next/dynamic to resolve synchronously to the mocked module.
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<unknown> }>) => {
    let Component: React.ComponentType<unknown> | null = null
    let pending = true
    let promise: Promise<unknown> | null = null
    return function Dynamic(props: Record<string, unknown>) {
      if (Component) return <Component {...props} />
      if (!promise) {
        promise = loader().then((mod) => {
          Component = mod.default
          pending = false
        })
      }
      if (pending) throw promise
      return null
    }
  },
}))

import { EquipmentDialogContext } from '@/app/(app)/equipment/_components/EquipmentDialogContext'
import {
  LinkedRequestProvider,
  useLinkedRequest,
} from '@/components/equipment-linked-request/LinkedRequestContext'
import { LinkedRequestSheetHost } from '@/components/equipment-linked-request/LinkedRequestSheetHost'

function makeEquipmentDialogStub(isDetailOpen = true) {
  return {
    user: null,
    isGlobal: false,
    isRegionalLeader: false,
    dialogState: {
      isAddOpen: false,
      isImportOpen: false,
      isColumnsOpen: false,
      isDetailOpen,
      isStartUsageOpen: false,
      isEndUsageOpen: false,
      isDeleteOpen: false,
      detailEquipment: null,
      startUsageEquipment: null,
      endUsageLog: null,
      deleteTarget: null,
      deleteSource: null,
    },
    openAddDialog: vi.fn(),
    openImportDialog: vi.fn(),
    openColumnsDialog: vi.fn(),
    openDetailDialog: vi.fn(),
    openStartUsageDialog: vi.fn(),
    openEndUsageDialog: vi.fn(),
    openDeleteDialog: vi.fn(),
    closeAddDialog: vi.fn(),
    closeImportDialog: vi.fn(),
    closeColumnsDialog: vi.fn(),
    closeDetailDialog: vi.fn(),
    closeStartUsageDialog: vi.fn(),
    closeEndUsageDialog: vi.fn(),
    closeDeleteDialog: vi.fn(),
    closeAllDialogs: vi.fn(),
    onDataMutationSuccess: vi.fn(),
  }
}

function Renderer({ equipmentId }: { equipmentId: number | null }) {
  const linked = useLinkedRequest()
  React.useEffect(() => {
    if (equipmentId !== null) linked.openRepair(equipmentId)
  }, [linked, equipmentId])
  return <LinkedRequestSheetHost />
}

function renderHost({ equipmentId = 11 }: { equipmentId?: number | null } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={client}>
      <EquipmentDialogContext.Provider value={makeEquipmentDialogStub()}>
        <LinkedRequestProvider>
          <React.Suspense fallback={<div data-testid="suspense" />}>
            <Renderer equipmentId={equipmentId} />
          </React.Suspense>
        </LinkedRequestProvider>
      </EquipmentDialogContext.Provider>
    </QueryClientProvider>,
  )
}

describe('LinkedRequestSheetHost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallRpc.mockReset()
    mockToast.mockReset()
  })

  it('renders nothing when state is closed', () => {
    renderHost({ equipmentId: null })
    expect(screen.queryByTestId('adapter-stub')).toBeNull()
    expect(mockCallRpc).not.toHaveBeenCalled()
  })

  it('renders the adapter with the resolved request when active_count >= 1', async () => {
    mockCallRpc.mockResolvedValueOnce({
      active_count: 1,
      request: { id: 555, thiet_bi_id: 11 },
    })
    renderHost({ equipmentId: 11 })

    const adapter = await screen.findByTestId('adapter-stub')
    expect(adapter).toBeInTheDocument()
    expect(screen.getByTestId('adapter-request-id').textContent).toBe('555')
    expect(screen.getByTestId('adapter-active-count').textContent).toBe('1')
  })

  it('passes activeCount through to the adapter for multi-active', async () => {
    mockCallRpc.mockResolvedValueOnce({
      active_count: 3,
      request: { id: 999, thiet_bi_id: 11 },
    })
    renderHost({ equipmentId: 11 })
    await screen.findByTestId('adapter-stub')
    expect(screen.getByTestId('adapter-active-count').textContent).toBe('3')
  })

  it('renders an explicit loading sheet while resolving the active repair request', async () => {
    mockCallRpc.mockImplementationOnce(() => new Promise(() => {}))

    renderHost({ equipmentId: 11 })

    expect(await screen.findByText('Đang mở yêu cầu sửa chữa')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng chờ trong giây lát.')).toBeInTheDocument()
  })

  it('renders an explicit error sheet when the active repair resolver fails', async () => {
    mockCallRpc.mockRejectedValueOnce(new Error('RPC failed'))

    renderHost({ equipmentId: 11 })

    expect(await screen.findByText('Không thể mở yêu cầu sửa chữa')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng thử lại từ danh sách thiết bị.')).toBeInTheDocument()
  })

  it('auto-closes and toasts when resolver returns active_count: 0 while open', async () => {
    mockCallRpc.mockResolvedValueOnce({ active_count: 0, request: null })
    renderHost({ equipmentId: 11 })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: 'Yêu cầu đã được hoàn thành' })
    })
    expect(screen.queryByTestId('adapter-stub')).toBeNull()
  })
})
