import { describe, it, expect } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { useRepairRequestsDeepLink as useRepairRequestsDeepLinkType } from '../_hooks/useRepairRequestsDeepLink'

interface DeepLinkRetryCaseDeps {
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

export function registerUseRepairRequestsDeepLinkRetryCases(deps: DeepLinkRetryCaseDeps) {
  const { useRepairRequestsDeepLink, mocks, createDefaultOptions, createSearchParams } = deps

  describe('retry and plain create timing', () => {
    it('resets same-id missing resolution to pending before retrying create intent', async () => {
      const retryEquipmentDeferred = createDeferred<typeof VALID_EQUIPMENT | null>()
      const baseOpts = createDefaultOptions()

      mocks.callRpc
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(null)
        .mockReturnValueOnce(retryEquipmentDeferred.promise)

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
        expect(mocks.toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            title: 'Lỗi',
            description: expect.stringContaining('Không thể mở phiếu sửa chữa'),
          })
        )
      })
      expect(mocks.openCreateSheet).not.toHaveBeenCalled()

      mocks.openCreateSheet.mockClear()
      mocks.toast.mockClear()
      mocks.routerReplace.mockClear()

      act(() => {
        rerender({ currentSearchParams: createSearchParams() })
      })

      act(() => {
        rerender({
          currentSearchParams: createSearchParams({ action: 'create', equipmentId: '42' }),
        })
      })

      await waitFor(() => {
        expect(mocks.callRpc).toHaveBeenCalledTimes(3)
      })

      expect(mocks.openCreateSheet).not.toHaveBeenCalled()
      expect(mocks.routerReplace).not.toHaveBeenCalled()

      await act(async () => {
        retryEquipmentDeferred.resolve(VALID_EQUIPMENT)
      })

      await waitFor(() => {
        expect(mocks.openCreateSheet).toHaveBeenCalledWith(
          expect.objectContaining({ id: 42, ma_thiet_bi: 'TB042' })
        )
      })
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
}
