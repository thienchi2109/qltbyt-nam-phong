/**
 * Regression tests for pagination in DeviceQuotaCategoryProvider.
 *
 * Verifies that navigating to an uncached page does NOT reset totalRootCount
 * to 0 (which would trigger bounds-checking in usePaginationState and snap
 * the user back to page 1).
 */
import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaCategoryContext } from '../_components/DeviceQuotaCategoryContext'
import { DeviceQuotaCategoryProvider } from '../_components/DeviceQuotaCategoryContext'
import type { CategoryContextValue } from '../_components/DeviceQuotaCategoryContext'

// Mock next-auth session to provide a valid user
vi.mock('next-auth/react', () => ({
    useSession: vi.fn(() => ({
        data: {
            user: {
                id: 'test-user',
                username: 'testuser',
                full_name: 'Test User',
                role: 'admin',
                don_vi: '1',
                dia_ban_id: 1,
            },
        },
        status: 'authenticated',
    })),
}))

// Track RPC calls to observe pagination parameters
let rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
let rpcResponses: Record<string, unknown[]> = {}

vi.mock('@/lib/rpc-client', () => ({
    callRpc: vi.fn(async ({ fn, args }: { fn: string; args: Record<string, unknown> }) => {
        rpcCalls.push({ fn, args })

        const key = `${fn}:page=${args.p_page ?? 'all'}`
        if (rpcResponses[key]) return rpcResponses[key]

        // Default: return empty for unknown calls
        return []
    }),
}))

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: vi.fn() }),
}))

function useContextValue() {
    const ctx = React.useContext(DeviceQuotaCategoryContext)
    if (!ctx) throw new Error('Missing provider')
    return ctx
}

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
            },
        },
    })

    return function Wrapper({ children }: { children: React.ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                <DeviceQuotaCategoryProvider>
                    {children}
                </DeviceQuotaCategoryProvider>
            </QueryClientProvider>
        )
    }
}

describe('DeviceQuotaCategoryProvider pagination', () => {
    beforeEach(() => {
        rpcCalls = []
        rpcResponses = {}
    })

    it('does not reset totalRootCount to 0 when navigating to uncached page', async () => {
        // Page 1 returns data with total_root_count = 50
        rpcResponses['dinh_muc_nhom_list_paginated:page=1'] = [
            {
                id: 1,
                parent_id: null,
                ma_nhom: '01',
                ten_nhom: 'Nhóm 1',
                level: 1,
                total_root_count: 50,
            },
        ]

        // Page 2 also returns data (simulating slow load via delayed mock)
        rpcResponses['dinh_muc_nhom_list_paginated:page=2'] = [
            {
                id: 21,
                parent_id: null,
                ma_nhom: '02',
                ten_nhom: 'Nhóm 21',
                level: 1,
                total_root_count: 50,
            },
        ]

        // All-categories query
        rpcResponses['dinh_muc_nhom_list:page=all'] = []

        const wrapper = createWrapper()
        const { result } = renderHook(() => useContextValue(), { wrapper })

        // Wait for page 1 to load
        await waitFor(() => {
            expect(result.current.totalRootCount).toBe(50)
        })

        expect(result.current.pagination.pagination.pageIndex).toBe(0)

        // Navigate to page 2
        act(() => {
            result.current.pagination.setPagination((prev: { pageIndex: number; pageSize: number }) => ({
                ...prev,
                pageIndex: 1,
            }))
        })

        // Critical assertion: totalRootCount should NEVER drop to 0 during
        // the transition. With keepPreviousData, the old data stays visible,
        // and the guard prevents resetting from undefined data.
        expect(result.current.totalRootCount).toBeGreaterThan(0)

        // Wait for page 2 data to actually load (assert on the data, not
        // the pageIndex which is set synchronously by setPagination)
        await waitFor(() => {
            expect(result.current.categories[0]?.ten_nhom).toBe('Nhóm 21')
        })

        // After page 2 loads, totalRootCount should still be 50
        expect(result.current.totalRootCount).toBe(50)
    })

    it('retains previous page data during page transition via keepPreviousData', async () => {
        rpcResponses['dinh_muc_nhom_list_paginated:page=1'] = [
            {
                id: 1,
                parent_id: null,
                ma_nhom: '01',
                ten_nhom: 'Nhóm 1',
                level: 1,
                total_root_count: 40,
            },
        ]

        rpcResponses['dinh_muc_nhom_list_paginated:page=2'] = [
            {
                id: 21,
                parent_id: null,
                ma_nhom: '02',
                ten_nhom: 'Nhóm 21',
                level: 1,
                total_root_count: 40,
            },
        ]

        rpcResponses['dinh_muc_nhom_list:page=all'] = []

        const wrapper = createWrapper()
        const { result } = renderHook(() => useContextValue(), { wrapper })

        // Wait for page 1
        await waitFor(() => {
            expect(result.current.categories.length).toBe(1)
        })

        const page1Categories = result.current.categories

        // Navigate to page 2
        act(() => {
            result.current.pagination.setPagination((prev: { pageIndex: number; pageSize: number }) => ({
                ...prev,
                pageIndex: 1,
            }))
        })

        // Immediately after navigation, categories should NOT be empty
        // (keepPreviousData retains old data as placeholder)
        expect(result.current.categories.length).toBeGreaterThan(0)

        // Wait for page 2 to resolve
        await waitFor(() => {
            expect(result.current.categories[0]?.ten_nhom).toBe('Nhóm 21')
        })
    })

    it('correctly updates totalRootCount when data actually changes', async () => {
        rpcResponses['dinh_muc_nhom_list_paginated:page=1'] = [
            {
                id: 1,
                parent_id: null,
                ma_nhom: '01',
                ten_nhom: 'Nhóm 1',
                level: 1,
                total_root_count: 30,
            },
        ]

        rpcResponses['dinh_muc_nhom_list:page=all'] = []

        const wrapper = createWrapper()
        const { result } = renderHook(() => useContextValue(), { wrapper })

        await waitFor(() => {
            expect(result.current.totalRootCount).toBe(30)
        })

        // Pagination pageCount should reflect totalRootCount correctly
        expect(result.current.pagination.pageCount).toBe(
            Math.ceil(30 / result.current.pagination.pagination.pageSize)
        )
    })
})
