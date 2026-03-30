/**
 * TDD Cycle 2 — RED phase
 * Tests for useRepairRequestsDeepLink hook.
 *
 * Verifies:
 * - Equipment list fetch on mount
 * - Deep-link: ?equipmentId=X triggers equipment_get RPC
 * - Deep-link: ?status=X preselects status filter
 * - Deep-link: ?action=create opens create sheet
 * - Deep-link: ?action=create&equipmentId=X opens sheet with pre-selected equipment
 * - URL params cleaned up after processing
 * - assistant-draft handoff from query cache
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ── Hoisted mocks ─────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
  toast: vi.fn(),
  openCreateSheet: vi.fn(),
  applyAssistantDraft: vi.fn(),
  routerReplace: vi.fn(),
  searchParamsGet: vi.fn() as ReturnType<typeof vi.fn>,
  searchParamsToString: vi.fn().mockReturnValue(''),
  queryClientGetQueryData: vi.fn(),
  queryClientRemoveQueries: vi.fn(),
}))

vi.mock('@/lib/rpc-client', () => ({
  callRpc: mocks.callRpc,
}))

// ── Import AFTER mocks ────────────────────────────────────────────
import { useRepairRequestsDeepLink } from '../_hooks/useRepairRequestsDeepLink'
import type { UiFilters } from '@/lib/rr-prefs'

// ── Helpers ───────────────────────────────────────────────────────
function createSearchParams(params: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams(params)
}

function createDefaultOptions(searchParams?: URLSearchParams) {
  const sp = searchParams || createSearchParams()
  const router = { replace: mocks.routerReplace }
  const queryClient = {
    getQueryData: mocks.queryClientGetQueryData,
    removeQueries: mocks.queryClientRemoveQueries,
  }

  return {
    searchParams: sp,
    router,
    pathname: '/repair-requests',
    toast: mocks.toast,
    uiFilters: { status: [], dateRange: null } as UiFilters,
    setUiFiltersState: vi.fn(),
    setUiFilters: vi.fn(),
    openCreateSheet: mocks.openCreateSheet,
    applyAssistantDraft: mocks.applyAssistantDraft,
    queryClient,
  }
}

// ── Tests ─────────────────────────────────────────────────────────
describe('useRepairRequestsDeepLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.callRpc.mockResolvedValue([])
    mocks.queryClientGetQueryData.mockReturnValue(undefined)
  })

  afterEach(() => {
    // Clean up localStorage written by real setUiFilters from @/lib/rr-prefs
    localStorage.removeItem('rr_filter_state')
  })

  it('returns expected shape', () => {
    const { result } = renderHook(() =>
      useRepairRequestsDeepLink(createDefaultOptions())
    )

    expect(result.current).toMatchObject({
      allEquipment: expect.any(Array),
      hasLoadedEquipment: expect.any(Boolean),
      isEquipmentFetchPending: expect.any(Boolean),
    })
  })

  it('fetches equipment list on mount', async () => {
    mocks.callRpc.mockResolvedValueOnce([
      { id: 1, ma_thiet_bi: 'TB001', ten_thiet_bi: 'Máy A', khoa_phong_quan_ly: 'Khoa 1' },
    ])

    const { result } = renderHook(() =>
      useRepairRequestsDeepLink(createDefaultOptions())
    )

    await waitFor(() => {
      expect(result.current.hasLoadedEquipment).toBe(true)
    })
    expect(result.current.allEquipment).toHaveLength(1)
    expect(result.current.allEquipment[0].ma_thiet_bi).toBe('TB001')
  })

  it('toasts error when equipment list fetch fails', async () => {
    mocks.callRpc.mockRejectedValueOnce({ message: 'Network error' })

    const { result } = renderHook(() =>
      useRepairRequestsDeepLink(createDefaultOptions())
    )

    await waitFor(() => {
      expect(result.current.hasLoadedEquipment).toBe(true)
    })
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'Không thể tải danh sách thiết bị. Network error',
      })
    )
  })

  it('fetches equipment by ID for deep-link preselect', async () => {
    mocks.callRpc
      .mockResolvedValueOnce([]) // equipment_list
      .mockResolvedValueOnce({   // equipment_get
        id: 42, ma_thiet_bi: 'TB042', ten_thiet_bi: 'Máy B', khoa_phong_quan_ly: 'Khoa 2',
      })

    const sp = createSearchParams({ equipmentId: '42' })
    const { result } = renderHook(() =>
      useRepairRequestsDeepLink(createDefaultOptions(sp))
    )

    await waitFor(() => {
      expect(result.current.allEquipment.some(eq => eq.id === 42)).toBe(true)
    })
  })

  it('preselects status filter from URL param', () => {
    const sp = createSearchParams({ status: 'Chờ xử lý' })
    const opts = createDefaultOptions(sp)

    renderHook(() => useRepairRequestsDeepLink(opts))

    expect(opts.setUiFiltersState).toHaveBeenCalledWith(
      expect.objectContaining({ status: ['Chờ xử lý'] })
    )
  })

  it('re-applies status deep-link after status param is cleared', async () => {
    const setUiFiltersState = vi.fn()
    const baseOpts = createDefaultOptions()

    const { rerender } = renderHook(
      ({ currentSearchParams }) => useRepairRequestsDeepLink({
        ...baseOpts,
        searchParams: currentSearchParams,
        setUiFiltersState,
      }),
      {
        initialProps: {
          currentSearchParams: createSearchParams({ status: 'Chờ xử lý' }),
        },
      }
    )

    await waitFor(() => {
      expect(setUiFiltersState).toHaveBeenCalledTimes(1)
    })

    act(() => {
      rerender({ currentSearchParams: createSearchParams() })
    })

    act(() => {
      rerender({ currentSearchParams: createSearchParams({ status: 'Chờ xử lý' }) })
    })

    await waitFor(() => {
      expect(setUiFiltersState).toHaveBeenCalledTimes(2)
    })
  })

  it('opens the create sheet and cleans the URL for action=create without equipmentId', async () => {
    const sp = createSearchParams({ action: 'create' })

    renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

    await waitFor(() => {
      expect(mocks.openCreateSheet).toHaveBeenCalledWith()
    })
    expect(mocks.routerReplace).toHaveBeenCalledWith('/repair-requests', { scroll: false })
  })

  it('opens the create sheet with the resolved equipment for action=create and valid equipmentId', async () => {
    mocks.callRpc
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 42,
        ma_thiet_bi: 'TB042',
        ten_thiet_bi: 'Máy B',
        khoa_phong_quan_ly: 'Khoa 2',
      })

    const sp = createSearchParams({ action: 'create', equipmentId: '42' })

    renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

    await waitFor(() => {
      expect(mocks.openCreateSheet).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 42,
          ma_thiet_bi: 'TB042',
          ten_thiet_bi: 'Máy B',
        })
      )
    })
    expect(mocks.routerReplace).toHaveBeenCalledWith('/repair-requests', { scroll: false })
  })

  it('degrades gracefully when action=create has an unresolved equipmentId', async () => {
    mocks.callRpc
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)

    const sp = createSearchParams({ action: 'create', equipmentId: '999' })

    renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

    await waitFor(() => {
      expect(mocks.openCreateSheet).toHaveBeenCalledWith()
    })
    expect(mocks.openCreateSheet).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 999 })
    )
    expect(mocks.routerReplace).toHaveBeenCalledWith('/repair-requests', { scroll: false })
  })

  it('reuses the shared create-action constant instead of hardcoding the action value', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts'),
      'utf8',
    )

    expect(source).toContain('REPAIR_REQUEST_CREATE_ACTION')
    expect(source).not.toContain("searchParams.get('action') !== 'create'")
  })
})
