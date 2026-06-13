import * as React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { RepairRequestsMobileList } from "../_components/RepairRequestsMobileList"
import type { RepairRequestColumnOptions } from "../_components/RepairRequestsColumns"
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

describe("RepairRequestsMobileList accessibility", () => {
  it("opens a repair request card with keyboard activation", async () => {
    const user = userEvent.setup()
    const request = makeRepairRequest()
    const setRequestToView = vi.fn()

    render(
      <RepairRequestsMobileList
        requests={[request]}
        isLoading={false}
        setRequestToView={setRequestToView}
        columnOptions={makeColumnOptions()}
      />,
    )

    const card = screen.getByRole("button", { name: /Máy siêu âm/ })
    card.focus()

    await user.keyboard("{Enter}")
    expect(setRequestToView).toHaveBeenCalledWith(request)

    await user.keyboard(" ")
    expect(setRequestToView).toHaveBeenCalledTimes(2)
  })

  it("does not open a repair request card from action controls", async () => {
    const user = userEvent.setup()
    const request = makeRepairRequest()
    const setRequestToView = vi.fn()
    const columnOptions = makeColumnOptions()

    render(
      <RepairRequestsMobileList
        requests={[request]}
        isLoading={false}
        setRequestToView={setRequestToView}
        columnOptions={columnOptions}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Mở menu" }))
    await user.click(screen.getByRole("menuitem", { name: "Xem phiếu yêu cầu" }))

    expect(columnOptions.onGenerateSheet).toHaveBeenCalledWith(request)
    expect(setRequestToView).not.toHaveBeenCalled()
  })

  it("shows a state-based primary action for pending requests without opening the card", async () => {
    const user = userEvent.setup()
    const request = makeRepairRequest()
    const setRequestToView = vi.fn()
    const columnOptions = makeColumnOptions()

    render(
      <RepairRequestsMobileList
        requests={[request]}
        isLoading={false}
        setRequestToView={setRequestToView}
        columnOptions={columnOptions}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Duyệt" }))

    expect(columnOptions.handleApproveRequest).toHaveBeenCalledWith(request)
    expect(setRequestToView).not.toHaveBeenCalled()
  })

  it("shows complete as the primary action for approved requests", async () => {
    const user = userEvent.setup()
    const request = {
      ...makeRepairRequest(),
      trang_thai: "Đã duyệt",
    }
    const columnOptions = makeColumnOptions()

    render(
      <RepairRequestsMobileList
        requests={[request]}
        isLoading={false}
        setRequestToView={vi.fn()}
        columnOptions={columnOptions}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Hoàn thành" }))

    expect(columnOptions.handleCompletion).toHaveBeenCalledWith(request, "Hoàn thành")
  })

  it("hides primary and overflow actions for regional leaders", () => {
    const request = makeRepairRequest()
    const columnOptions = {
      ...makeColumnOptions(),
      isRegionalLeader: true,
    }

    render(
      <RepairRequestsMobileList
        requests={[request]}
        isLoading={false}
        setRequestToView={vi.fn()}
        columnOptions={columnOptions}
      />,
    )

    expect(screen.queryByRole("button", { name: "Duyệt" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Mở menu" })).not.toBeInTheDocument()
  })

  it("keeps block card content outside the activation button", () => {
    const request = makeRepairRequest()

    render(
      <RepairRequestsMobileList
        requests={[request]}
        isLoading={false}
        setRequestToView={vi.fn()}
        columnOptions={makeColumnOptions()}
      />,
    )

    const activationButton = screen.getByRole("button", { name: /Máy siêu âm/ })

    expect(within(activationButton).queryByText("Người yêu cầu")).not.toBeInTheDocument()
    expect(screen.getByText("Người yêu cầu").closest("button")).not.toBe(activationButton)
  })
})
