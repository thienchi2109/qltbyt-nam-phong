import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { RepairRequestsMobileList } from "../_components/RepairRequestsMobileList"
import type { RepairRequestWithEquipment } from "../types"

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
        renderActions={() => null}
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
    const onAction = vi.fn()

    render(
      <RepairRequestsMobileList
        requests={[request]}
        isLoading={false}
        setRequestToView={setRequestToView}
        renderActions={() => <button type="button" onClick={onAction}>Action</button>}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Action" }))

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(setRequestToView).not.toHaveBeenCalled()
  })
})
