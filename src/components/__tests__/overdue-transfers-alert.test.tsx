import * as React from "react"
import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

import { OverdueTransfersAlert } from "../overdue-transfers-alert"

const overdueSummary = {
  total: 2,
  overdue: 1,
  due_today: 0,
  due_soon: 1,
  items: [
    {
      id: 88,
      ma_yeu_cau: "LC-0088",
      thiet_bi_id: 22,
      loai_hinh: "ben_ngoai",
      trang_thai: "da_ban_giao",
      nguoi_yeu_cau_id: 1,
      ly_do_luan_chuyen: "Cho mượn ngoài viện",
      khoa_phong_hien_tai: null,
      khoa_phong_nhan: null,
      muc_dich: "cho_muon",
      don_vi_nhan: "Bệnh viện B",
      dia_chi_don_vi: null,
      nguoi_lien_he: null,
      so_dien_thoai: null,
      ngay_du_kien_tra: "2026-05-01T00:00:00.000Z",
      ngay_ban_giao: null,
      ngay_hoan_tra: null,
      ngay_hoan_thanh: null,
      nguoi_duyet_id: null,
      ngay_duyet: null,
      ghi_chu_duyet: null,
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-01T00:00:00.000Z",
      created_by: 1,
      updated_by: 1,
      thiet_bi: {
        ten_thiet_bi: "Máy thở",
        ma_thiet_bi: "MT-001",
        model: null,
        serial: null,
        khoa_phong_quan_ly: null,
        facility_name: "Cơ sở A",
        facility_id: 7,
        is_deleted: false,
      },
      days_difference: -5,
    },
    {
      id: 89,
      ma_yeu_cau: "LC-0089",
      thiet_bi_id: 23,
      loai_hinh: "ben_ngoai",
      trang_thai: "dang_luan_chuyen",
      nguoi_yeu_cau_id: 2,
      ly_do_luan_chuyen: "Cho mượn ngoài viện",
      khoa_phong_hien_tai: null,
      khoa_phong_nhan: null,
      muc_dich: "cho_muon",
      don_vi_nhan: "Bệnh viện C",
      dia_chi_don_vi: null,
      nguoi_lien_he: null,
      so_dien_thoai: null,
      ngay_du_kien_tra: "2026-05-10T00:00:00.000Z",
      ngay_ban_giao: null,
      ngay_hoan_tra: null,
      ngay_hoan_thanh: null,
      nguoi_duyet_id: null,
      ngay_duyet: null,
      ghi_chu_duyet: null,
      created_at: "2026-04-02T00:00:00.000Z",
      updated_at: "2026-04-02T00:00:00.000Z",
      created_by: 2,
      updated_by: 2,
      thiet_bi: {
        ten_thiet_bi: "Bơm tiêm điện",
        ma_thiet_bi: "BTD-001",
        model: null,
        serial: null,
        khoa_phong_quan_ly: null,
        facility_name: "Cơ sở A",
        facility_id: 7,
        is_deleted: false,
      },
      days_difference: 4,
    },
  ],
}

describe("OverdueTransfersAlert", () => {
  beforeEach(() => {
    mocks.callRpc.mockReset()
    mocks.callRpc.mockResolvedValue([])
  })

  it("renders the page-scoped summary without calling the legacy pending-returns RPC", () => {
    render(<OverdueTransfersAlert overdueSummary={overdueSummary} isLoading={false} />)

    expect(mocks.callRpc).not.toHaveBeenCalled()
    expect(screen.getByText("1 thiết bị quá hạn")).toBeInTheDocument()
    expect(screen.getByText("1 thiết bị sắp tới hạn")).toBeInTheDocument()
  })

  it("uses server-computed day differences when viewing summary items", () => {
    const onViewTransfer = vi.fn()

    render(
      <OverdueTransfersAlert
        overdueSummary={overdueSummary}
        isLoading={false}
        onViewTransfer={onViewTransfer}
      />,
    )

    expect(screen.getByText(/Quá hạn 5 ngày/)).toBeInTheDocument()
    expect(screen.getByText(/Còn 4 ngày/)).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole("button", { name: /Xem/i })[0])
    expect(onViewTransfer).toHaveBeenCalledWith(overdueSummary.items[0])
  })
})
