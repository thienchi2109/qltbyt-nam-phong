import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { RepairRequestsDetailContent } from "../_components/RepairRequestsDetailContent"
import type { RepairRequestWithEquipment } from "../types"

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

vi.mock("../_components/RepairRequestsProcessStepper", () => ({
  RepairRequestsProcessStepper: ({ status }: { status: string }) => <div>{status}</div>,
}))

const baseRequest = {
  id: 10,
  thiet_bi_id: 5,
  ngay_yeu_cau: "2026-01-01T00:00:00.000Z",
  trang_thai: "Hoàn thành",
  mo_ta_su_co: "Lỗi nguồn",
  hang_muc_sua_chua: "Nguồn",
  ngay_mong_muon_hoan_thanh: null,
  nguoi_yeu_cau: "Nguyễn Văn A",
  ngay_duyet: "2026-01-02T00:00:00.000Z",
  ngay_hoan_thanh: "2026-01-03T00:00:00.000Z",
  nguoi_duyet: "Nguyễn Văn B",
  nguoi_xac_nhan: "Nguyễn Văn C",
  don_vi_thuc_hien: "noi_bo",
  ten_don_vi_thue: null,
  ket_qua_sua_chua: "Đã thay nguồn",
  ly_do_khong_hoan_thanh: null,
  thiet_bi: {
    ten_thiet_bi: "Máy Monitor",
    ma_thiet_bi: "TB-10",
    model: "M-10",
    serial: "SN-10",
    khoa_phong_quan_ly: "Khoa A",
    facility_name: "BV A",
    facility_id: 1,
  },
}

describe("RepairRequestsDetailContent", () => {
  it("displays zero repair cost as a valid recorded value", () => {
    render(
      <RepairRequestsDetailContent
        request={{ ...baseRequest, chi_phi_sua_chua: 0 } as RepairRequestWithEquipment}
      />
    )

    expect(screen.getByText("Tổng chi phí sửa chữa")).toBeInTheDocument()
    expect(screen.getByText("0 đ")).toBeInTheDocument()
  })

  it("displays a missing repair cost as not recorded", () => {
    render(
      <RepairRequestsDetailContent
        request={{ ...baseRequest, chi_phi_sua_chua: null } as RepairRequestWithEquipment}
      />
    )

    expect(screen.getByText("Tổng chi phí sửa chữa")).toBeInTheDocument()
    expect(screen.getByText("Chưa ghi nhận")).toBeInTheDocument()
  })

  it("hides the repair cost row for không hoàn thành requests", () => {
    render(
      <RepairRequestsDetailContent
        request={{
          ...baseRequest,
          trang_thai: "Không HT",
          ket_qua_sua_chua: null,
          ly_do_khong_hoan_thanh: "Không tìm được linh kiện thay thế",
          chi_phi_sua_chua: 500000,
        } as RepairRequestWithEquipment}
      />
    )

    expect(screen.queryByText("Tổng chi phí sửa chữa")).not.toBeInTheDocument()
    expect(screen.getByText("Lý do không hoàn thành")).toBeInTheDocument()
  })
})
