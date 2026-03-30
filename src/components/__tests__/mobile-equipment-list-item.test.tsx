import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

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

  it("renders a grouped action region and keeps action clicks from bubbling to the card", () => {
    const onShowDetails = vi.fn()

    render(
      <MobileEquipmentListItem
        equipment={equipment}
        onShowDetails={onShowDetails}
      />,
    )

    expect(
      screen.getByRole("group", { name: "Hành động cho Máy X-quang" }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Báo sửa chữa" }))

    expect(mocks.push).toHaveBeenCalledWith(
      "/repair-requests?action=create&equipmentId=42",
    )
    expect(onShowDetails).not.toHaveBeenCalled()
  })

  it('routes "Chi tiết sự cố" to the equipment-filtered repair requests list without opening create intent', () => {
    const onShowDetails = vi.fn()

    render(
      <MobileEquipmentListItem
        equipment={waitingRepairEquipment}
        onShowDetails={onShowDetails}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Chi tiết sự cố" }))

    expect(mocks.push).toHaveBeenCalledWith("/repair-requests?equipmentId=42")
    expect(mocks.push).not.toHaveBeenCalledWith(
      "/repair-requests?action=create&equipmentId=42",
    )
    expect(onShowDetails).not.toHaveBeenCalled()
  })
})
