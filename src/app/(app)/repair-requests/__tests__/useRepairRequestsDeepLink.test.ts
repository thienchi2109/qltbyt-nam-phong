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

  // ── Race condition tests ────────────────────────────────────────
  // These use deferred promises to control timing between equipment_list
  // and equipment_get, exposing the race in the current implementation.

  function createDeferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }

  const VALID_EQUIPMENT = {
    id: 42,
    ma_thiet_bi: 'TB042',
    ten_thiet_bi: 'Máy B',
    khoa_phong_quan_ly: 'Khoa 2',
  }

  describe('race: equipment resolution timing', () => {
    it('waits for targeted equipment_get before opening sheet when list settles first', async () => {
      const equipmentGetDeferred = createDeferred<typeof VALID_EQUIPMENT | null>()

      mocks.callRpc
        .mockResolvedValueOnce([])              // equipment_list: resolves immediately
        .mockReturnValueOnce(equipmentGetDeferred.promise) // equipment_get: deferred

      const sp = createSearchParams({ action: 'create', equipmentId: '42' })
      renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

      // Wait for list to settle
      await waitFor(() => {
        expect(mocks.callRpc).toHaveBeenCalledTimes(2)
      })

      // Sheet must NOT have opened yet while equipment_get is still pending
      expect(mocks.openCreateSheet).not.toHaveBeenCalled()

      // Now resolve equipment_get
      await act(async () => {
        equipmentGetDeferred.resolve(VALID_EQUIPMENT)
      })

      // Sheet should now open WITH equipment
      await waitFor(() => {
        expect(mocks.openCreateSheet).toHaveBeenCalledWith(
          expect.objectContaining({ id: 42, ma_thiet_bi: 'TB042' })
        )
      })
      expect(mocks.routerReplace).toHaveBeenCalledWith('/repair-requests', { scroll: false })
    })

    it('opens with prefill when targeted equipment_get resolves before list is useful', async () => {
      const listDeferred = createDeferred<Array<typeof VALID_EQUIPMENT>>()

      mocks.callRpc
        .mockReturnValueOnce(listDeferred.promise)        // equipment_list: deferred (slow)
        .mockResolvedValueOnce(VALID_EQUIPMENT)            // equipment_get: resolves immediately

      const sp = createSearchParams({ action: 'create', equipmentId: '42' })
      renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

      // equipment_get resolves quickly; sheet should open with prefill
      await waitFor(() => {
        expect(mocks.openCreateSheet).toHaveBeenCalledWith(
          expect.objectContaining({ id: 42, ma_thiet_bi: 'TB042' })
        )
      })

      // Cleanup: resolve the list to avoid dangling promise
      await act(async () => {
        listDeferred.resolve([])
      })
    })

    it('does not reopen the create sheet when the initial list settles after the intent is consumed', async () => {
      const listDeferred = createDeferred<Array<typeof VALID_EQUIPMENT>>()

      mocks.callRpc
        .mockReturnValueOnce(listDeferred.promise)
        .mockResolvedValueOnce(VALID_EQUIPMENT)

      const sp = createSearchParams({ action: 'create', equipmentId: '42' })
      const opts = createDefaultOptions(sp)
      renderHook(() => useRepairRequestsDeepLink(opts))

      await waitFor(() => {
        expect(mocks.openCreateSheet).toHaveBeenCalledTimes(1)
        expect(mocks.openCreateSheet).toHaveBeenCalledWith(
          expect.objectContaining({ id: 42, ma_thiet_bi: 'TB042' })
        )
      })

      await act(async () => {
        listDeferred.resolve([VALID_EQUIPMENT])
      })

      await waitFor(() => {
        expect(mocks.openCreateSheet).toHaveBeenCalledTimes(1)
      })
    })

    it('opens blank sheet only after equipment_get reaches terminal missing state', async () => {
      const equipmentGetDeferred = createDeferred<null>()

      mocks.callRpc
        .mockResolvedValueOnce([])                          // equipment_list: immediate
        .mockReturnValueOnce(equipmentGetDeferred.promise)  // equipment_get: deferred

      const sp = createSearchParams({ action: 'create', equipmentId: '999' })
      renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

      // Wait for list
      await waitFor(() => {
        expect(mocks.callRpc).toHaveBeenCalledTimes(2)
      })

      // Sheet must NOT open while equipment_get is pending
      expect(mocks.openCreateSheet).not.toHaveBeenCalled()

      // Resolve as missing
      await act(async () => {
        equipmentGetDeferred.resolve(null)
      })

      // Now sheet should open blank (graceful degradation)
      await waitFor(() => {
        expect(mocks.openCreateSheet).toHaveBeenCalledWith()
      })
      expect(mocks.routerReplace).toHaveBeenCalledWith('/repair-requests', { scroll: false })
    })

    it('waits for the latest equipmentId when the URL changes mid-flight', async () => {
      const firstEquipmentDeferred = createDeferred<typeof VALID_EQUIPMENT | null>()
      const secondEquipmentDeferred = createDeferred<{
        id: 99
        ma_thiet_bi: string
        ten_thiet_bi: string
        khoa_phong_quan_ly: string
      } | null>()
      const nextEquipment = {
        id: 99 as const,
        ma_thiet_bi: 'TB099',
        ten_thiet_bi: 'Máy C',
        khoa_phong_quan_ly: 'Khoa 3',
      }
      const baseOpts = createDefaultOptions()

      mocks.callRpc
        .mockResolvedValueOnce([])
        .mockReturnValueOnce(firstEquipmentDeferred.promise)
        .mockReturnValueOnce(secondEquipmentDeferred.promise)

      const { rerender } = renderHook(
        ({ currentSearchParams }) => useRepairRequestsDeepLink({
          ...baseOpts,
          searchParams: currentSearchParams,
        }),
        {
          initialProps: {
            currentSearchParams: createSearchParams({ action: 'create', equipmentId: '42' }),
          },
        },
      )

      await waitFor(() => {
        expect(mocks.callRpc).toHaveBeenCalledTimes(2)
      })

      act(() => {
        rerender({
          currentSearchParams: createSearchParams({ action: 'create', equipmentId: '99' }),
        })
      })

      await waitFor(() => {
        expect(mocks.callRpc).toHaveBeenCalledTimes(3)
      })

      await act(async () => {
        firstEquipmentDeferred.resolve(VALID_EQUIPMENT)
      })

      await waitFor(() => {
        expect(mocks.openCreateSheet).not.toHaveBeenCalled()
      })
      expect(mocks.routerReplace).not.toHaveBeenCalled()

      await act(async () => {
        secondEquipmentDeferred.resolve(nextEquipment)
      })

      await waitFor(() => {
        expect(mocks.openCreateSheet).toHaveBeenCalledWith(
          expect.objectContaining({ id: 99, ma_thiet_bi: 'TB099' })
        )
      })
      expect(mocks.openCreateSheet).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: 42 })
      )
      expect(mocks.routerReplace).toHaveBeenCalledWith('/repair-requests', { scroll: false })
    })

    it('does not delay action=create without equipmentId due to resolution gating', async () => {
      mocks.callRpc.mockResolvedValueOnce([]) // equipment_list

      const sp = createSearchParams({ action: 'create' })
      renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

      // Should open immediately — no equipment resolution gating
      await waitFor(() => {
        expect(mocks.openCreateSheet).toHaveBeenCalledWith()
      })

      // Only 1 RPC call (equipment_list), no equipment_get
      expect(mocks.callRpc).toHaveBeenCalledTimes(1)
      expect(mocks.routerReplace).toHaveBeenCalledWith('/repair-requests', { scroll: false })
    })
  })
})
