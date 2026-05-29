import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
  RepairRequestRowActions,
  type RepairRequestColumnOptions,
} from "../_components/RepairRequestsColumns"
import type { AuthUser, RepairRequestWithEquipment } from "../types"

function makeRepairRequest(): RepairRequestWithEquipment {
  return {
    id: 42,
    thiet_bi_id: 7,
    ngay_yeu_cau: "2026-05-01T00:00:00.000Z",
    trang_thai: "Chờ xử lý",
    mo_ta_su_co: "Máy không hoạt động",
    hang_muc_sua_chua: null,
    ngay_mong_muon_hoan_thanh: null,
    nguoi_yeu_cau: "Nguyễn Văn A",
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
      ten_thiet_bi: "Máy siêu âm",
      ma_thiet_bi: "TB-A11Y",
      model: null,
      serial: null,
      khoa_phong_quan_ly: "Khoa Khám bệnh",
      facility_name: "Bệnh viện A",
      facility_id: 1,
    },
  }
}

function makeUser(): AuthUser {
  return {
    id: "1",
    username: "manager",
    role: "to_qltb",
    name: "Manager",
    email: null,
    image: null,
  }
}

function makeColumnOptions(): RepairRequestColumnOptions {
  return {
    onGenerateSheet: vi.fn(),
    setEditingRequest: vi.fn(),
    setRequestToDelete: vi.fn(),
    handleApproveRequest: vi.fn(),
    handleCompletion: vi.fn(),
    setRequestToView: vi.fn(),
    user: makeUser(),
    isRegionalLeader: false,
  }
}

describe("RepairRequestRowActions", () => {
  it("calls the row-specific action callbacks for the selected request", async () => {
    const user = userEvent.setup()
    const request = makeRepairRequest()
    const options = makeColumnOptions()

    render(<RepairRequestRowActions request={request} options={options} />)

    await user.click(screen.getByRole("button", { name: "Mở menu" }))
    await user.click(screen.getByRole("menuitem", { name: "Xem phiếu yêu cầu" }))
    expect(options.onGenerateSheet).toHaveBeenCalledWith(request)

    await user.click(screen.getByRole("button", { name: "Mở menu" }))
    await user.click(screen.getByRole("menuitem", { name: "Sửa" }))
    expect(options.setEditingRequest).toHaveBeenCalledWith(request)
  })

  it("hides actions for read-only regional leaders", () => {
    render(
      <RepairRequestRowActions
        request={makeRepairRequest()}
        options={{ ...makeColumnOptions(), isRegionalLeader: true }}
      />,
    )

    expect(screen.queryByRole("button", { name: "Mở menu" })).not.toBeInTheDocument()
  })
})
