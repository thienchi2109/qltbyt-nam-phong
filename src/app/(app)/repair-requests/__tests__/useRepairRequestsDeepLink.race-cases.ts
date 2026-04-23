import { describe, it, expect } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { useRepairRequestsDeepLink as useRepairRequestsDeepLinkType } from '../_hooks/useRepairRequestsDeepLink'

interface DeepLinkRaceCaseDeps {
  useRepairRequestsDeepLink: typeof useRepairRequestsDeepLinkType
  mocks: {
    callRpc: ReturnType<typeof import('vitest').vi.fn>
    openCreateSheet: ReturnType<typeof import('vitest').vi.fn>
    routerReplace: ReturnType<typeof import('vitest').vi.fn>
    toast: ReturnType<typeof import('vitest').vi.fn>
  }
  createDefaultOptions: (searchParams?: URLSearchParams) => Parameters<typeof useRepairRequestsDeepLinkType>[0]
  createSearchParams: (params?: Record<string, string>) => URLSearchParams
}

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

export function registerUseRepairRequestsDeepLinkRaceCases(deps: DeepLinkRaceCaseDeps) {
  const { useRepairRequestsDeepLink, mocks, createDefaultOptions, createSearchParams } = deps

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

    it('requires equipment_get even when targeted equipment is already cached from the list', async () => {
      const equipmentGetDeferred = createDeferred<typeof VALID_EQUIPMENT | null>()
      const baseOpts = createDefaultOptions()

      mocks.callRpc
        .mockResolvedValueOnce([VALID_EQUIPMENT])
        .mockReturnValueOnce(equipmentGetDeferred.promise)

      const { result, rerender } = renderHook(
        ({ currentSearchParams }) => useRepairRequestsDeepLink({
          ...baseOpts,
          searchParams: currentSearchParams,
        }),
        {
          initialProps: {
            currentSearchParams: createSearchParams(),
          },
        },
      )

      await waitFor(() => {
        expect(result.current.hasLoadedEquipment).toBe(true)
      })
      expect(mocks.callRpc).toHaveBeenCalledTimes(1)

      act(() => {
        rerender({
          currentSearchParams: createSearchParams({ action: 'create', equipmentId: '42' }),
        })
      })

      await waitFor(() => {
        expect(mocks.callRpc).toHaveBeenCalledTimes(2)
      })
      expect(mocks.openCreateSheet).not.toHaveBeenCalled()

      await act(async () => {
        equipmentGetDeferred.resolve(VALID_EQUIPMENT)
      })

      await waitFor(() => {
        expect(mocks.openCreateSheet).toHaveBeenCalledWith(
          expect.objectContaining({ id: 42, ma_thiet_bi: 'TB042' })
        )
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

    it('does not open a blank sheet after equipment_get reaches terminal missing state', async () => {
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

      await waitFor(() => {
        expect(mocks.toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            title: 'Lỗi',
            description: expect.stringContaining('Không thể mở phiếu sửa chữa'),
          })
        )
      })
      expect(mocks.openCreateSheet).not.toHaveBeenCalled()
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
        await Promise.resolve()
      })

      expect(mocks.openCreateSheet).not.toHaveBeenCalled()
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

    it('keeps isEquipmentFetchPending true while a newer equipment fetch is still in flight', async () => {
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

      const { result, rerender } = renderHook(
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
        expect(result.current.isEquipmentFetchPending).toBe(true)
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
        await Promise.resolve()
      })

      expect(result.current.isEquipmentFetchPending).toBe(true)

      await act(async () => {
        secondEquipmentDeferred.resolve(nextEquipment)
      })

      await waitFor(() => {
        expect(result.current.isEquipmentFetchPending).toBe(false)
      })
    })

  })
}
