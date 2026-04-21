import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import DeviceQuotaCategoriesPage from '../page'
import { callRpc } from '@/lib/rpc-client'

// Mock window.matchMedia for Dialog component
beforeAll(() => {
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
})

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

  it('shows the restricted access state for authenticated users without category management permission', () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: 'user', don_vi: '1' } },
      status: 'authenticated',
    })

    render(<DeviceQuotaCategoriesPage />, { wrapper: createWrapper() })

    expect(screen.getByText('Truy cập bị hạn chế')).toBeInTheDocument()
    expect(
      screen.getByText(/chỉ dành cho quản trị viên hoặc bộ phận quản lý thiết bị/i)
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạo danh mục' })).not.toBeInTheDocument()
    expect(mockCallRpc).not.toHaveBeenCalled()
  })

  it('renders toolbar and empty tree when authorized', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: 'admin', don_vi: '1' } },
      status: 'authenticated',
    })

    mockCallRpc.mockResolvedValue([])

    render(<DeviceQuotaCategoriesPage />, { wrapper: createWrapper() })

    // Wait for toolbar button to appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tạo danh mục' })).toBeInTheDocument()
    })

    // Wait for empty state to appear after loading completes
    await waitFor(() => {
      expect(screen.getByText('Chưa có danh mục nào')).toBeInTheDocument()
    })
  })

  it('includes descendants of matching categories on the categories page', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: 'admin', don_vi: '1' } },
      status: 'authenticated',
    })

    mockCallRpc.mockResolvedValue([
      {
        id: 1,
        parent_id: null,
        ma_nhom: 'G1',
        ten_nhom: 'Nhóm 1',
        phan_loai: 'A',
        don_vi_tinh: null,
        thu_tu_hien_thi: 1,
        level: 1,
        so_luong_hien_co: 0,
        so_luong_toi_da: null,
        so_luong_toi_thieu: null,
        mo_ta: null,
      },
      {
        id: 2,
        parent_id: 1,
        ma_nhom: 'G1.1',
        ten_nhom: 'Nhóm 1.1',
        phan_loai: 'A',
        don_vi_tinh: null,
        thu_tu_hien_thi: 2,
        level: 2,
        so_luong_hien_co: 0,
        so_luong_toi_da: null,
        so_luong_toi_thieu: null,
        mo_ta: null,
      },
      {
        id: 3,
        parent_id: 1,
        ma_nhom: 'G1.2',
        ten_nhom: 'Nhóm 1.2',
        phan_loai: 'B',
        don_vi_tinh: null,
        thu_tu_hien_thi: 3,
        level: 2,
        so_luong_hien_co: 0,
        so_luong_toi_da: null,
        so_luong_toi_thieu: null,
        mo_ta: null,
      },
      {
        id: 4,
        parent_id: 2,
        ma_nhom: 'G1.1.1',
        ten_nhom: 'Child A',
        phan_loai: 'A',
        don_vi_tinh: null,
        thu_tu_hien_thi: 4,
        level: 3,
        so_luong_hien_co: 0,
        so_luong_toi_da: null,
        so_luong_toi_thieu: null,
        mo_ta: null,
      },
    ])

    render(<DeviceQuotaCategoriesPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Child A')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('Tìm theo mã, tên nhóm...'), {
      target: { value: 'Nhóm 1' },
    })

    await waitFor(() => {
      expect(screen.getByText('Nhóm 1')).toBeInTheDocument()
      expect(screen.getByText('Nhóm 1.1')).toBeInTheDocument()
      expect(screen.getByText('Nhóm 1.2')).toBeInTheDocument()
      expect(screen.getByText('Child A')).toBeInTheDocument()
    })
  })
})
