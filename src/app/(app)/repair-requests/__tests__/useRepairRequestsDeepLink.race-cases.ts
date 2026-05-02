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

      mocks.callRpc.mockReturnValueOnce(equipmentGetDeferred.promise)

      const sp = createSearchParams({ action: 'create', equipmentId: '42' })
      renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

      await waitFor(() => {
        expect(mocks.callRpc).toHaveBeenCalledTimes(1)
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

    it('opens with prefill when targeted equipment_get resolves', async () => {
      mocks.callRpc.mockResolvedValueOnce(VALID_EQUIPMENT)

      const sp = createSearchParams({ action: 'create', equipmentId: '42' })
      renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

      await waitFor(() => {
        expect(mocks.openCreateSheet).toHaveBeenCalledWith(
          expect.objectContaining({ id: 42, ma_thiet_bi: 'TB042' })
        )
      })
      expect(mocks.callRpc).toHaveBeenCalledTimes(1)
    })

    it('requires equipment_get when navigating from a plain page load to create intent', async () => {
      const equipmentGetDeferred = createDeferred<typeof VALID_EQUIPMENT | null>()
      const baseOpts = createDefaultOptions()

      mocks.callRpc.mockReturnValueOnce(equipmentGetDeferred.promise)

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

      expect(result.current.hasLoadedEquipment).toBe(true)
      expect(mocks.callRpc).not.toHaveBeenCalled()

      act(() => {
        rerender({
          currentSearchParams: createSearchParams({ action: 'create', equipmentId: '42' }),
        })
      })

      await waitFor(() => {
        expect(mocks.callRpc).toHaveBeenCalledTimes(1)
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

    it('does not reopen the create sheet after the intent is consumed', async () => {
      mocks.callRpc.mockResolvedValueOnce(VALID_EQUIPMENT)

      const sp = createSearchParams({ action: 'create', equipmentId: '42' })
      const opts = createDefaultOptions(sp)
      const { rerender } = renderHook(() => useRepairRequestsDeepLink(opts))

      await waitFor(() => {
        expect(mocks.openCreateSheet).toHaveBeenCalledTimes(1)
        expect(mocks.openCreateSheet).toHaveBeenCalledWith(
          expect.objectContaining({ id: 42, ma_thiet_bi: 'TB042' })
        )
      })

      rerender()

      await waitFor(() => {
        expect(mocks.openCreateSheet).toHaveBeenCalledTimes(1)
      })
    })

    it('does not open a blank sheet after equipment_get reaches terminal missing state', async () => {
      const equipmentGetDeferred = createDeferred<null>()

      mocks.callRpc.mockReturnValueOnce(equipmentGetDeferred.promise)

      const sp = createSearchParams({ action: 'create', equipmentId: '999' })
      renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

      await waitFor(() => {
        expect(mocks.callRpc).toHaveBeenCalledTimes(1)
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
        expect(mocks.callRpc).toHaveBeenCalledTimes(1)
      })

      act(() => {
        rerender({
          currentSearchParams: createSearchParams({ action: 'create', equipmentId: '99' }),
        })
      })

      await waitFor(() => {
        expect(mocks.callRpc).toHaveBeenCalledTimes(2)
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
        expect(mocks.callRpc).toHaveBeenCalledTimes(2)
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
