import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import DeviceQuotaCategoriesPage from '../page'
import { callRpc } from '@/lib/rpc-client'

const mockUseSession = vi.fn()
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/rpc-client', () => ({
  callRpc: vi.fn(),
}))

const mockCallRpc = vi.mocked(callRpc)

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('DeviceQuotaCategoriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders toolbar and empty tree when authorized', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: 'admin', don_vi: '1' } },
      status: 'authenticated',
    })

    mockCallRpc.mockResolvedValue([])

    render(<DeviceQuotaCategoriesPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tạo danh mục' })).toBeInTheDocument()
    })

    expect(screen.getByText('Chưa có danh mục nào')).toBeInTheDocument()
  })
})
