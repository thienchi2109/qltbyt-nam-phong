import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { TransfersDialogs } from "@/app/(app)/transfers/_components/TransfersDialogs"
import type { TransferListItem } from "@/types/transfers-data-grid"

const mocks = vi.hoisted(() => ({
  ReturnLocationDialog: vi.fn(() => <div data-testid="return-location-dialog" />),
}))

vi.mock("@/components/add-transfer-dialog", () => ({
  AddTransferDialog: () => null,
}))

vi.mock("@/components/edit-transfer-dialog", () => ({
  EditTransferDialog: () => null,
}))

vi.mock("@/components/handover-preview-dialog", () => ({
  HandoverPreviewDialog: () => null,
}))

vi.mock("@/components/transfer-detail-dialog", () => ({
  TransferDetailDialog: () => null,
}))

vi.mock("@/components/transfers/FilterModal", () => ({
  FilterModal: () => null,
}))

vi.mock("@/components/transfers/ReturnLocationDialog", () => ({
  ReturnLocationDialog: (props: unknown) => mocks.ReturnLocationDialog(props),
}))

function makeTransferListItem(
  overrides: Partial<TransferListItem> = {},
): TransferListItem {
  return {
    id: overrides.id ?? 7,
    ma_yeu_cau: overrides.ma_yeu_cau ?? "LC-0007",
    thiet_bi_id: overrides.thiet_bi_id ?? 99,
    loai_hinh: overrides.loai_hinh ?? "ben_ngoai",
    trang_thai: overrides.trang_thai ?? "da_ban_giao",
    nguoi_yeu_cau_id: overrides.nguoi_yeu_cau_id ?? 1,
    ly_do_luan_chuyen: overrides.ly_do_luan_chuyen ?? "Điều phối",
    khoa_phong_hien_tai: overrides.khoa_phong_hien_tai ?? "Khoa A",
    khoa_phong_nhan: overrides.khoa_phong_nhan ?? null,
    muc_dich: overrides.muc_dich ?? null,
    don_vi_nhan: overrides.don_vi_nhan ?? "Bệnh viện B",
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

describe("TransfersDialogs", () => {
  it("mounts ReturnLocationDialog when the dialog is open", () => {
    const returnTransfer = makeTransferListItem()
    const onConfirmReturn = vi.fn().mockResolvedValue(undefined)

    render(
      <TransfersDialogs
        isAddDialogOpen={false}
        onAddDialogOpenChange={vi.fn()}
        onAddSuccess={vi.fn()}
        isEditDialogOpen={false}
        onEditDialogOpenChange={vi.fn()}
        onEditSuccess={vi.fn()}
        editingTransfer={null}
        detailDialogOpen={false}
        onDetailDialogOpenChange={vi.fn()}
        detailTransfer={null}
        handoverDialogOpen={false}
        onHandoverDialogOpenChange={vi.fn()}
        handoverTransfer={null}
        deleteDialogOpen={false}
        onDeleteDialogOpenChange={vi.fn()}
        onConfirmDelete={vi.fn()}
        returnLocationDialogOpen
        onReturnLocationDialogOpenChange={vi.fn()}
        returnTransfer={returnTransfer}
        isReturning
        onConfirmReturn={onConfirmReturn}
        isFilterModalOpen={false}
        onFilterModalOpenChange={vi.fn()}
        filterValue={{ statuses: [], dateRange: null }}
        onFilterChange={vi.fn()}
        filterVariant="dialog"
      />,
    )

    expect(screen.getByTestId("return-location-dialog")).toBeInTheDocument()
    expect(mocks.ReturnLocationDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        isSubmitting: true,
        transfer: returnTransfer,
        onConfirm: onConfirmReturn,
      }),
    )
  })
})
