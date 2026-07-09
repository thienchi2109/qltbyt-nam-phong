import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import "@testing-library/jest-dom"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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

function RepairRequestEditWorkflowHarness() {
  const request = React.useMemo(() => makeRepairRequest(), [])
  const [editingRequest, setEditingRequest] = React.useState<RepairRequestWithEquipment | null>(
    null
  )
  const [pageClicks, setPageClicks] = React.useState(0)
  const callbackMenuState = React.useRef<boolean[]>([])

  const options = React.useMemo<RepairRequestColumnOptions>(
    () => ({
      onGenerateSheet: vi.fn(),
      setEditingRequest: (selectedRequest) => {
        callbackMenuState.current.push(screen.queryByRole("menuitem", { name: "Sửa" }) !== null)
        setEditingRequest(selectedRequest)
      },
      setRequestToDelete: vi.fn(),
      handleApproveRequest: vi.fn(),
      handleCompletion: vi.fn(),
      setRequestToView: vi.fn(),
      user: makeUser(),
      isRegionalLeader: false,
    }),
    []
  )

  return (
    <div>
      <RepairRequestRowActions request={request} options={options} />
      <Sheet
        open={editingRequest !== null}
        onOpenChange={(open) => !open && setEditingRequest(null)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Sửa yêu cầu sửa chữa</SheetTitle>
            <SheetDescription>{editingRequest?.mo_ta_su_co}</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button type="button" onClick={() => setEditingRequest(null)}>
              Áp dụng
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <button type="button" onClick={() => setPageClicks((count) => count + 1)}>
        Nút nền {pageClicks}
      </button>
      <output aria-label="Trạng thái menu callback">
        {callbackMenuState.current.map(String).join(",")}
      </output>
    </div>
  )
}

describe("RepairRequestRowActions overlay workflow", () => {
  it("opens edit from the row menu, closes the sheet, and keeps the page interactive", async () => {
    const user = userEvent.setup()
    document.body.style.pointerEvents = ""
    render(<RepairRequestEditWorkflowHarness />)

    await user.click(screen.getByRole("button", { name: "Mở menu" }))
    await user.click(screen.getByRole("menuitem", { name: "Sửa" }))

    expect(await screen.findByRole("dialog", { name: "Sửa yêu cầu sửa chữa" })).toBeInTheDocument()
    expect(screen.getByLabelText("Trạng thái menu callback")).toHaveTextContent("false")
    await waitFor(() => expect(screen.queryByRole("menuitem", { name: "Sửa" })).toBeNull())

    await user.click(screen.getByRole("button", { name: "Áp dụng" }))

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Sửa yêu cầu sửa chữa" })).not.toBeInTheDocument()
    )
    expect(document.body.style.pointerEvents).not.toBe("none")

    await user.click(screen.getByRole("button", { name: "Nút nền 0" }))
    expect(screen.getByRole("button", { name: "Nút nền 1" })).toBeInTheDocument()
  })
})
