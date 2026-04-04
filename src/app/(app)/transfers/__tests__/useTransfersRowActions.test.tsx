import * as React from "react"
import { act, render, renderHook, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TransferRequest } from "@/types/database"
import type { TransferListItem } from "@/types/transfers-data-grid"

const rowActionsMock = vi.hoisted(() => ({
  TransferRowActions: vi.fn(() => <div data-testid="transfer-row-actions" />),
}))

vi.mock("@/components/transfers/TransferRowActions", () => ({
  TransferRowActions: (props: unknown) => rowActionsMock.TransferRowActions(props),
}))

import { useTransfersRowActions } from "@/app/(app)/transfers/_components/useTransfersRowActions"

function makeTransferListItem(
  overrides: Partial<TransferListItem> = {},
): TransferListItem {
  return {
    id: overrides.id ?? 7,
    ma_yeu_cau: overrides.ma_yeu_cau ?? "LC-0007",
    thiet_bi_id: overrides.thiet_bi_id ?? 99,
    loai_hinh: overrides.loai_hinh ?? "noi_bo",
    trang_thai: overrides.trang_thai ?? "cho_duyet",
    nguoi_yeu_cau_id: overrides.nguoi_yeu_cau_id ?? 1,
    ly_do_luan_chuyen: overrides.ly_do_luan_chuyen ?? "Điều phối",
    khoa_phong_hien_tai: overrides.khoa_phong_hien_tai ?? "Khoa A",
    khoa_phong_nhan: overrides.khoa_phong_nhan ?? "Khoa B",
    muc_dich: overrides.muc_dich ?? null,
    don_vi_nhan: overrides.don_vi_nhan ?? null,
    dia_chi_don_vi: overrides.dia_chi_don_vi ?? null,
    nguoi_lien_he: overrides.nguoi_lien_he ?? null,
    so_dien_thoai: overrides.so_dien_thoai ?? null,
    ngay_du_kien_tra: overrides.ngay_du_kien_tra ?? null,
    ngay_ban_giao: overrides.ngay_ban_giao ?? null,
    ngay_hoan_tra: overrides.ngay_hoan_tra ?? null,
    ngay_hoan_thanh: overrides.ngay_hoan_thanh ?? null,
    nguoi_duyet_id: overrides.nguoi_duyet_id ?? null,
    ngay_duyet: overrides.ngay_duyet ?? null,
    ghi_chu_duyet: overrides.ghi_chu_duyet ?? null,
    created_at: overrides.created_at ?? "2026-04-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-01T00:00:00.000Z",
    created_by: overrides.created_by ?? 1,
    updated_by: overrides.updated_by ?? 1,
    thiet_bi: overrides.thiet_bi ?? {
      ten_thiet_bi: "Máy siêu âm",
      ma_thiet_bi: "TB-99",
      model: "Model X",
      serial: "SER-99",
      khoa_phong_quan_ly: "Khoa A",
      facility_name: "Bệnh viện A",
      facility_id: 1,
    },
  }
}

function makeTransferRequest(
  overrides: Partial<TransferRequest> = {},
): TransferRequest {
  return {
    id: overrides.id ?? 7,
    ma_yeu_cau: overrides.ma_yeu_cau ?? "LC-0007",
    thiet_bi_id: overrides.thiet_bi_id ?? 99,
    loai_hinh: overrides.loai_hinh ?? "noi_bo",
    trang_thai: overrides.trang_thai ?? "cho_duyet",
    nguoi_yeu_cau_id: overrides.nguoi_yeu_cau_id ?? 1,
    ly_do_luan_chuyen: overrides.ly_do_luan_chuyen ?? "Điều phối",
    khoa_phong_hien_tai: overrides.khoa_phong_hien_tai ?? "Khoa A",
    khoa_phong_nhan: overrides.khoa_phong_nhan ?? "Khoa B",
    muc_dich: overrides.muc_dich,
    don_vi_nhan: overrides.don_vi_nhan,
    dia_chi_don_vi: overrides.dia_chi_don_vi,
    nguoi_lien_he: overrides.nguoi_lien_he,
    so_dien_thoai: overrides.so_dien_thoai,
    ngay_du_kien_tra: overrides.ngay_du_kien_tra,
    ngay_ban_giao: overrides.ngay_ban_giao,
    ngay_hoan_tra: overrides.ngay_hoan_tra,
    ngay_hoan_thanh: overrides.ngay_hoan_thanh,
    nguoi_duyet_id: overrides.nguoi_duyet_id,
    ngay_duyet: overrides.ngay_duyet,
    ghi_chu_duyet: overrides.ghi_chu_duyet,
    created_at: overrides.created_at ?? "2026-04-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-01T00:00:00.000Z",
    created_by: overrides.created_by ?? 1,
    updated_by: overrides.updated_by ?? 1,
    thiet_bi: overrides.thiet_bi ?? null,
  }
}

describe("useTransfersRowActions", () => {
  const item = makeTransferListItem()
  const mappedTransfer = makeTransferRequest({
    thiet_bi: {
      id: 99,
      ten_thiet_bi: "Máy siêu âm",
      ma_thiet_bi: "TB-99",
      model: "Model X",
      serial: "SER-99",
      serial_number: "SER-99",
      khoa_phong_quan_ly: "Khoa A",
      don_vi: 1,
      facility_name: "Bệnh viện A",
      facility_id: 1,
      tinh_trang: null,
    },
  })

  let confirmDelete: ReturnType<typeof vi.fn>
  let mapToTransferRequest: ReturnType<typeof vi.fn>
  let toast: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    confirmDelete = vi.fn().mockResolvedValue(undefined)
    mapToTransferRequest = vi.fn(() => mappedTransfer)
    toast = vi.fn()
  })

  function renderRowActionsHook() {
    return renderHook(() =>
      useTransfersRowActions({
        userRole: "global",
        userKhoaPhong: "Khoa A",
        toast,
        approveTransfer: vi.fn(),
        startTransfer: vi.fn(),
        handoverToExternal: vi.fn(),
        returnFromExternal: vi.fn(),
        completeTransfer: vi.fn(),
        confirmDelete,
        canEditTransfer: vi.fn(() => true),
        canDeleteTransfer: vi.fn(() => true),
        mapToTransferRequest,
        isTransferCoreRole: true,
      }),
    )
  }

  it("maps the transfer and opens the edit dialog", () => {
    const { result } = renderRowActionsHook()

    act(() => {
      result.current.handleEditTransfer(item)
    })

    expect(mapToTransferRequest).toHaveBeenCalledWith(item)
    expect(result.current.editingTransfer).toEqual(mappedTransfer)
    expect(result.current.isEditDialogOpen).toBe(true)
  })

  it("maps the transfer and opens the detail dialog", () => {
    const { result } = renderRowActionsHook()

    act(() => {
      result.current.handleViewDetail(item)
    })

    expect(mapToTransferRequest).toHaveBeenCalledWith(item)
    expect(result.current.detailTransfer).toEqual(mappedTransfer)
    expect(result.current.isDetailDialogOpen).toBe(true)
  })

  it("confirms delete and clears dialog state", async () => {
    const { result } = renderRowActionsHook()

    act(() => {
      result.current.handleOpenDeleteDialog(item)
    })

    expect(result.current.deletingTransfer).toEqual(item)
    expect(result.current.isDeleteDialogOpen).toBe(true)

    await act(async () => {
      await result.current.handleConfirmDelete()
    })

    expect(confirmDelete).toHaveBeenCalledWith(item)
    expect(result.current.deletingTransfer).toBeNull()
    expect(result.current.isDeleteDialogOpen).toBe(false)
  })

  it("toasts an error when generating a handover sheet without equipment", () => {
    mapToTransferRequest.mockReturnValueOnce(makeTransferRequest({ thiet_bi: null }))

    const { result } = renderRowActionsHook()

    act(() => {
      result.current.handleGenerateHandoverSheet(item)
    })

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Lỗi",
      }),
    )
    expect(result.current.isHandoverDialogOpen).toBe(false)
    expect(result.current.handoverTransfer).toBeNull()
  })

  it("opens the handover dialog when the mapped transfer is valid", () => {
    const { result } = renderRowActionsHook()

    act(() => {
      result.current.handleGenerateHandoverSheet(item)
    })

    expect(result.current.handoverTransfer).toEqual(mappedTransfer)
    expect(result.current.isHandoverDialogOpen).toBe(true)
  })

  it("renders TransferRowActions with permissions and handlers", () => {
    const { result } = renderRowActionsHook()
    const RowActions = result.current.RowActions

    render(<RowActions item={item} />)

    expect(screen.getByTestId("transfer-row-actions")).toBeInTheDocument()
    expect(rowActionsMock.TransferRowActions).toHaveBeenCalledWith(
      expect.objectContaining({
        item,
        canEdit: true,
        canDelete: true,
        isTransferCoreRole: true,
        userRole: "global",
        userKhoaPhong: "Khoa A",
        onEdit: result.current.handleEditTransfer,
        onDelete: result.current.handleOpenDeleteDialog,
      }),
    )
  })
})
