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
  openViewDialog: vi.fn(),
  applyAssistantDraft: vi.fn(),
  routerReplace: vi.fn(),
  searchParamsGet: vi.fn() as ReturnType<typeof vi.fn>,
  searchParamsToString: vi.fn().mockReturnValue(''),
  queryClientGetQueryData: vi.fn(),
  queryClientRemoveQueries: vi.fn(),
  useRepairRequestsContext: vi.fn(),
}))

vi.mock('@/lib/rpc-client', () => ({
  callRpc: mocks.callRpc,
}))

vi.mock('../_hooks/useRepairRequestsContext', () => ({
  useRepairRequestsContext: () => mocks.useRepairRequestsContext(),
}))

// ── Import AFTER mocks ────────────────────────────────────────────
import type { UiFilters } from '@/lib/rr-prefs'
import { registerUseRepairRequestsDeepLinkRaceCases } from './useRepairRequestsDeepLink.race-cases'
import { registerUseRepairRequestsDeepLinkRetryCases } from './useRepairRequestsDeepLink.retry-cases'
import { useRepairRequestsDeepLink } from '../_hooks/useRepairRequestsDeepLink'

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
    mocks.useRepairRequestsContext.mockReturnValue({
      dialogState: { requestToView: null },
      openViewDialog: mocks.openViewDialog,
    })
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

  it('does not open the create sheet when action=create has an unresolved equipmentId', async () => {
    mocks.callRpc
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)

    const sp = createSearchParams({ action: 'create', equipmentId: '999' })

    renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

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

  it('does not open the create sheet when equipment_get denies access', async () => {
    mocks.callRpc
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce({ message: 'Equipment not found or access denied' })

    const sp = createSearchParams({ action: 'create', equipmentId: '999' })

    renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: 'Lỗi',
          description: expect.stringContaining('Equipment not found or access denied'),
        })
      )
    })
    expect(mocks.openCreateSheet).not.toHaveBeenCalled()
    expect(mocks.routerReplace).toHaveBeenCalledWith('/repair-requests', { scroll: false })
  })

  it('does not treat an invalid equipmentId as a blank create intent', async () => {
    const sp = createSearchParams({ action: 'create', equipmentId: 'abc' })

    renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

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
    expect(mocks.callRpc).toHaveBeenCalledTimes(1)
    expect(mocks.routerReplace).toHaveBeenCalledWith('/repair-requests', { scroll: false })
  })

  it('opens the detail sheet for action=view and a valid requestId without cleaning the URL on open', async () => {
    mocks.callRpc
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 77,
        thiet_bi_id: 42,
        ngay_yeu_cau: '2026-04-28',
        trang_thai: 'Chờ xử lý',
        mo_ta_su_co: 'Mất nguồn',
        hang_muc_sua_chua: null,
        ngay_mong_muon_hoan_thanh: null,
        nguoi_yeu_cau: 'Nguyen Van A',
        ngay_duyet: null,
        ngay_hoan_thanh: null,
        nguoi_duyet: null,
        nguoi_xac_nhan: null,
        chi_phi_sua_chua: null,
        don_vi_thuc_hien: null,
        ten_don_vi_thue: null,
        ket_qua_sua_chua: null,
        ly_do_khong_hoan_thanh: null,
      })
      .mockResolvedValueOnce({
        id: 42,
        ma_thiet_bi: 'TB042',
        ten_thiet_bi: 'Máy B',
        model: 'Model X',
        serial: 'SER-42',
        khoa_phong_quan_ly: 'Khoa 2',
        don_vi: 9,
      })

    const sp = createSearchParams({ action: 'view', requestId: '77', foo: 'bar' })

    renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

    await waitFor(() => {
      expect(mocks.openViewDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 77,
          thiet_bi_id: 42,
          thiet_bi: expect.objectContaining({
            ma_thiet_bi: 'TB042',
            model: 'Model X',
            serial: 'SER-42',
            khoa_phong_quan_ly: 'Khoa 2',
            facility_id: 9,
          }),
        }),
      )
    })
    expect(mocks.routerReplace).not.toHaveBeenCalled()
  })

  it('toasts and cleans only action/requestId when action=view has an invalid requestId', async () => {
    const sp = createSearchParams({ action: 'view', requestId: 'abc', foo: 'bar' })

    renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: 'Lỗi',
          description: expect.stringContaining('Không thể mở chi tiết yêu cầu sửa chữa'),
        }),
      )
    })
    expect(mocks.openViewDialog).not.toHaveBeenCalled()
    expect(mocks.routerReplace).toHaveBeenCalledWith('/repair-requests?foo=bar', { scroll: false })
  })

  it('toasts and cleans only action/requestId when action=view cannot resolve the request', async () => {
    mocks.callRpc
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Yêu cầu sửa chữa không tồn tại hoặc bạn không có quyền truy cập'))

    const sp = createSearchParams({ action: 'view', requestId: '999', foo: 'bar' })

    renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: 'Lỗi',
          description: expect.stringContaining('Không thể mở chi tiết yêu cầu sửa chữa'),
        }),
      )
    })
    expect(mocks.openViewDialog).not.toHaveBeenCalled()
    expect(mocks.routerReplace).toHaveBeenCalledWith('/repair-requests?foo=bar', { scroll: false })
  })

  it('opens the detail sheet with thiet_bi null when equipment_get is denied after request resolution', async () => {
    mocks.callRpc
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 77,
        thiet_bi_id: 42,
        ngay_yeu_cau: '2026-04-28',
        trang_thai: 'Chờ xử lý',
        mo_ta_su_co: 'Mất nguồn',
        hang_muc_sua_chua: null,
        ngay_mong_muon_hoan_thanh: null,
        nguoi_yeu_cau: 'Nguyen Van A',
        ngay_duyet: null,
        ngay_hoan_thanh: null,
        nguoi_duyet: null,
        nguoi_xac_nhan: null,
        chi_phi_sua_chua: null,
        don_vi_thuc_hien: null,
        ten_don_vi_thue: null,
        ket_qua_sua_chua: null,
        ly_do_khong_hoan_thanh: null,
      })
      .mockRejectedValueOnce(new Error('Equipment not found or access denied'))

    const sp = createSearchParams({ action: 'view', requestId: '77', foo: 'bar' })

    renderHook(() => useRepairRequestsDeepLink(createDefaultOptions(sp)))

    await waitFor(() => {
      expect(mocks.openViewDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 77,
          thiet_bi_id: 42,
          thiet_bi: null,
        }),
      )
    })
    expect(mocks.toast).not.toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('Không thể mở chi tiết yêu cầu sửa chữa'),
      }),
    )
    expect(mocks.routerReplace).not.toHaveBeenCalled()
  })

  it('cleans only action/requestId after the URL-driven detail sheet closes', async () => {
    mocks.callRpc
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 77,
        thiet_bi_id: 42,
        ngay_yeu_cau: '2026-04-28',
        trang_thai: 'Chờ xử lý',
        mo_ta_su_co: 'Mất nguồn',
        hang_muc_sua_chua: null,
        ngay_mong_muon_hoan_thanh: null,
        nguoi_yeu_cau: 'Nguyen Van A',
        ngay_duyet: null,
        ngay_hoan_thanh: null,
        nguoi_duyet: null,
        nguoi_xac_nhan: null,
        chi_phi_sua_chua: null,
        don_vi_thuc_hien: null,
        ten_don_vi_thue: null,
        ket_qua_sua_chua: null,
        ly_do_khong_hoan_thanh: null,
      })
      .mockResolvedValueOnce({
        id: 42,
        ma_thiet_bi: 'TB042',
        ten_thiet_bi: 'Máy B',
        model: 'Model X',
        serial: 'SER-42',
        khoa_phong_quan_ly: 'Khoa 2',
        don_vi: 9,
      })

    const baseOpts = createDefaultOptions()
    const requestToView = {
      id: 77,
      thiet_bi_id: 42,
      ngay_yeu_cau: '2026-04-28',
      trang_thai: 'Chờ xử lý',
      mo_ta_su_co: 'Mất nguồn',
      hang_muc_sua_chua: null,
      ngay_mong_muon_hoan_thanh: null,
      nguoi_yeu_cau: 'Nguyen Van A',
      ngay_duyet: null,
      ngay_hoan_thanh: null,
      nguoi_duyet: null,
      nguoi_xac_nhan: null,
      chi_phi_sua_chua: null,
      don_vi_thuc_hien: null,
      ten_don_vi_thue: null,
      ket_qua_sua_chua: null,
      ly_do_khong_hoan_thanh: null,
      thiet_bi: {
        ma_thiet_bi: 'TB042',
        ten_thiet_bi: 'Máy B',
        model: 'Model X',
        serial: 'SER-42',
        khoa_phong_quan_ly: 'Khoa 2',
        facility_name: null,
        facility_id: 9,
      },
    }

    const { rerender } = renderHook(
      ({ currentSearchParams }) => useRepairRequestsDeepLink({
        ...baseOpts,
        searchParams: currentSearchParams,
      }),
      {
        initialProps: {
          currentSearchParams: createSearchParams({ action: 'view', requestId: '77', foo: 'bar' }),
        },
      },
    )

    await waitFor(() => {
      expect(mocks.openViewDialog).toHaveBeenCalled()
    })
    expect(mocks.routerReplace).not.toHaveBeenCalled()

    mocks.useRepairRequestsContext.mockReturnValue({
      dialogState: { requestToView },
      openViewDialog: mocks.openViewDialog,
    })

    rerender({ currentSearchParams: createSearchParams({ action: 'view', requestId: '77', foo: 'bar' }) })

    mocks.useRepairRequestsContext.mockReturnValue({
      dialogState: { requestToView: null },
      openViewDialog: mocks.openViewDialog,
    })

    rerender({ currentSearchParams: createSearchParams({ action: 'view', requestId: '77', foo: 'bar' }) })

    await waitFor(() => {
      expect(mocks.routerReplace).toHaveBeenCalledWith('/repair-requests?foo=bar', { scroll: false })
    })
  })

  it('reuses the shared create-action constant instead of hardcoding the action value', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts'),
      'utf8',
    )
    const viewSource = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLinkView.ts'),
      'utf8',
    )

    expect(source).toContain('REPAIR_REQUEST_CREATE_ACTION')
    expect(source).not.toContain("searchParams.get('action') !== 'create'")
    expect(viewSource).toContain('REPAIR_REQUEST_VIEW_ACTION')
    expect(viewSource).not.toContain("searchParams.get('action') === 'view'")
  })

  registerUseRepairRequestsDeepLinkRaceCases({
    useRepairRequestsDeepLink,
    mocks,
    createDefaultOptions,
    createSearchParams,
  })

  registerUseRepairRequestsDeepLinkRetryCases({
    useRepairRequestsDeepLink,
    mocks,
    createDefaultOptions,
    createSearchParams,
  })
})
