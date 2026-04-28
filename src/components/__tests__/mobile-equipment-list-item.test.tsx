import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LinkedRequestProvider } from "@/components/equipment-linked-request"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  mobileUsageClick: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => <div {...props}>{children}</div>,
}))

vi.mock("../mobile-usage-actions", () => ({
  MobileUsageActions: ({
    className,
  }: {
    className?: string
  }) => (
    <button
      type="button"
      className={className}
      onClick={mocks.mobileUsageClick}
    >
      Sử dụng
    </button>
  ),
}))

import { MobileEquipmentListItem } from "../mobile-equipment-list-item"

const equipment = {
  id: 42,
  ma_thiet_bi: "TB-042",
  ten_thiet_bi: "Máy X-quang",
  khoa_phong_quan_ly: "CDHA",
  vi_tri_lap_dat: "Tầng 2",
  tinh_trang_hien_tai: "Hoạt động",
} as const

const waitingRepairEquipment = {
  ...equipment,
  tinh_trang_hien_tai: "Chờ sửa chữa",
} as const

describe("MobileEquipmentListItem", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("React", React)
  })

  it("renders a grouped action region and keeps action clicks from bubbling to the card", async () => {
    const user = userEvent.setup()
    const onShowDetails = vi.fn()

    render(
      <LinkedRequestProvider>
        <MobileEquipmentListItem
          equipment={equipment}
          onShowDetails={onShowDetails}
        />
      </LinkedRequestProvider>,
    )

    expect(
      screen.getByRole("group", { name: "Hành động cho Máy X-quang" }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Báo sửa chữa" }))

    expect(mocks.push).toHaveBeenCalledWith(
      "/repair-requests?action=create&equipmentId=42",
    )
    expect(onShowDetails).not.toHaveBeenCalled()
  })

  it('routes "Chi tiết sự cố" to the equipment-filtered repair requests list without opening create intent', async () => {
    const user = userEvent.setup()
    const onShowDetails = vi.fn()

    render(
      <LinkedRequestProvider>
        <MobileEquipmentListItem
          equipment={waitingRepairEquipment}
          onShowDetails={onShowDetails}
        />
      </LinkedRequestProvider>,
    )

    await user.click(screen.getByRole("button", { name: "Chi tiết sự cố" }))

    expect(mocks.push).toHaveBeenCalledWith("/repair-requests?equipmentId=42")
    expect(mocks.push).not.toHaveBeenCalledWith(
      "/repair-requests?action=create&equipmentId=42",
    )
    expect(onShowDetails).not.toHaveBeenCalled()
  })

  it("opens linked repair from the wrench icon without opening the mobile card", async () => {
    const user = userEvent.setup()
    const onShowDetails = vi.fn()

    render(
      <LinkedRequestProvider>
        <MobileEquipmentListItem
          equipment={{ ...waitingRepairEquipment, active_repair_request_id: 9001 }}
          onShowDetails={onShowDetails}
        />
      </LinkedRequestProvider>,
    )

    await user.click(screen.getByRole("button", {
      name: "Xem yêu cầu sửa chữa hiện tại của thiết bị TB-042",
    }))

    expect(onShowDetails).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
