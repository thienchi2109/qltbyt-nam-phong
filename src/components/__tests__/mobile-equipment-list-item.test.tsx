import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LinkedRequestProvider } from "@/components/equipment-linked-request"
import { readyStatusCatalog } from "@/hooks/__tests__/equipment-status-catalog-fixtures"
import { useReactTable, getCoreRowModel } from "@tanstack/react-table"
import type { Equipment } from "@/types/database"
import { EquipmentContent } from "@/app/(app)/equipment/equipment-content"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  mobileUsageClick: vi.fn(),
  mobileUsageProps: vi.fn(),
  catalog: vi.fn(),
}))
vi.mock("@/hooks/use-equipment-status-catalog", () => ({
  useEquipmentStatusCatalog: () => mocks.catalog(),
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
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div {...props}>{children}</div>
  ),
}))

vi.mock("../mobile-usage-actions", () => ({
  MobileUsageActions: ({
    className,
    startDisabled,
    ...props
  }: {
    className?: string
    startDisabled?: boolean
  }) => {
    mocks.mobileUsageProps({ startDisabled, ...props })
    return (
      <button
        type="button"
        className={className}
        disabled={startDisabled}
        onClick={mocks.mobileUsageClick}
      >
        Sử dụng
      </button>
    )
  },
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

function renderStatus(status: string, catalog = readyStatusCatalog) {
  return render(
    <LinkedRequestProvider>
      <MobileEquipmentListItem
        equipment={{ ...equipment, tinh_trang_hien_tai: status }}
        onShowDetails={vi.fn()}
        {...{ statusCatalog: catalog }}
      />
    </LinkedRequestProvider>
  )
}

function OwnerHarness() {
  const data = [{ ...equipment, tinh_trang_hien_tai: "Thanh lý nội bộ" }] as Equipment[]
  const table = useReactTable({ data, columns: [], getCoreRowModel: getCoreRowModel() })
  return (
    <LinkedRequestProvider>
      <EquipmentContent
        isGlobal={false}
        isRegionalLeader={false}
        shouldFetchEquipment
        isLoading={false}
        isFetching={false}
        isCardView
        table={table}
        columns={[]}
        onShowDetails={vi.fn()}
      />
    </LinkedRequestProvider>
  )
}

describe("MobileEquipmentListItem", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("React", React)
    mocks.catalog.mockReturnValue(readyStatusCatalog)
  })

  it("wires one owner catalog read to real mobile rows and guards their repair action", () => {
    render(<OwnerHarness />)
    const repair = screen.queryByRole("button", { name: "Báo sửa chữa" })
    expect(repair === null || repair.hasAttribute("disabled")).toBe(true)
    expect(mocks.catalog).toHaveBeenCalledTimes(1)
    expect(mocks.mobileUsageProps).toHaveBeenCalledWith(
      expect.objectContaining({ startDisabled: true })
    )
  })

  it.each([
    ["Hoạt động", "text-green-700", "Báo sửa chữa"],
    ["Chờ sửa chữa", "text-red-700", "Chi tiết sự cố"],
    ["Chờ bảo trì", "text-amber-700", "Xem chi tiết"],
    ["Chờ hiệu chuẩn/kiểm định", "text-amber-700", "Xem chi tiết"],
    ["Ngưng sử dụng", "text-gray-500", "Xem chi tiết"],
    ["Chưa có nhu cầu sử dụng", "text-gray-500", "Xem chi tiết"],
  ])("retains %s color and actions", (status, color, action) => {
    renderStatus(status)
    expect(screen.getByText(status)).toHaveClass(color)
    expect(screen.getByRole("button", { name: action })).toBeEnabled()
    const oldDetailsOnly = status === "Ngưng sử dụng" || status === "Chưa có nhu cầu sử dụng"
    expect(screen.queryByRole("button", { name: "Sử dụng" }) !== null).toBe(!oldDetailsOnly)
  })

  it("uses the dark gray white badge for liquidation and denies new operations", () => {
    renderStatus("Thanh lý nội bộ")
    expect(screen.getByText("Thanh lý nội bộ")).toHaveClass("text-white")
    expect(screen.getByText("Thanh lý nội bộ").parentElement).toHaveClass("bg-gray-800")
    const repair = screen.queryByRole("button", { name: "Báo sửa chữa" })
    expect(repair === null || repair.hasAttribute("disabled")).toBe(true)
    expect(mocks.mobileUsageProps).toHaveBeenCalledWith(
      expect.objectContaining({ startDisabled: true })
    )
  })

  it("does not turn terminal-only or inactive metadata into a deny", () => {
    const data = [
      {
        ...readyStatusCatalog.data[0],
        status_value: "Kết thúc theo dõi",
        is_terminal: true,
        is_active: false,
      },
    ]
    renderStatus(data[0].status_value, {
      ...readyStatusCatalog,
      data,
      activeValues: [],
      canWrite: false,
    })
    expect(screen.getByRole("button", { name: "Báo sửa chữa" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Sử dụng" })).toBeEnabled()
  })

  it.each(["paused", "fetching", "error", "pending"])(
    "denies new operations during %s and retries once",
    (state) => {
      const refetch = vi.fn()
      renderStatus("Hoạt động", {
        ...readyStatusCatalog,
        canWrite: false,
        isSuccess: state !== "error" && state !== "pending",
        fetchStatus: state === "error" ? "idle" : state,
        refetch,
      })
      const repair = screen.getByRole("button", { name: "Báo sửa chữa" })
      expect(repair).toBeDisabled()
      fireEvent.click(repair)
      expect(mocks.push).not.toHaveBeenCalled()
      expect(screen.getByRole("button", { name: "Sử dụng" })).toBeDisabled()
      fireEvent.click(screen.getByRole("button", { name: "Thử lại" }))
      expect(refetch).toHaveBeenCalledOnce()
    }
  )

  it("renders a grouped action region and keeps action clicks from bubbling to the card", async () => {
    const user = userEvent.setup()
    const onShowDetails = vi.fn()

    render(
      <LinkedRequestProvider>
        <MobileEquipmentListItem
          equipment={equipment}
          {...{ statusCatalog: readyStatusCatalog }}
          onShowDetails={onShowDetails}
        />
      </LinkedRequestProvider>
    )

    expect(screen.getByRole("group", { name: "Hành động cho Máy X-quang" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Báo sửa chữa" }))

    expect(mocks.push).toHaveBeenCalledWith("/repair-requests?action=create&equipmentId=42")
    expect(onShowDetails).not.toHaveBeenCalled()
  })

  it("opens equipment details from the compact card activation target", async () => {
    const user = userEvent.setup()
    const onShowDetails = vi.fn()

    render(
      <LinkedRequestProvider>
        <MobileEquipmentListItem
          equipment={equipment}
          {...{ statusCatalog: readyStatusCatalog }}
          onShowDetails={onShowDetails}
        />
      </LinkedRequestProvider>
    )

    await user.click(screen.getByRole("button", { name: "Thiết bị: Máy X-quang" }))

    expect(onShowDetails).toHaveBeenCalledWith(equipment)
    expect(screen.getByText("TB-042")).toBeInTheDocument()
    expect(screen.getByText("Máy X-quang")).toBeInTheDocument()
    expect(screen.getByText(/CDHA/)).toBeInTheDocument()
  })

  it('routes "Chi tiết sự cố" to the equipment-filtered repair requests list without opening create intent', async () => {
    const user = userEvent.setup()
    const onShowDetails = vi.fn()

    render(
      <LinkedRequestProvider>
        <MobileEquipmentListItem
          equipment={waitingRepairEquipment}
          {...{ statusCatalog: readyStatusCatalog }}
          onShowDetails={onShowDetails}
        />
      </LinkedRequestProvider>
    )

    await user.click(screen.getByRole("button", { name: "Chi tiết sự cố" }))

    expect(mocks.push).toHaveBeenCalledWith("/repair-requests?equipmentId=42")
    expect(mocks.push).not.toHaveBeenCalledWith("/repair-requests?action=create&equipmentId=42")
    expect(onShowDetails).not.toHaveBeenCalled()
  })

  it("opens linked repair from the wrench icon without opening the mobile card", async () => {
    const user = userEvent.setup()
    const onShowDetails = vi.fn()

    render(
      <LinkedRequestProvider>
        <MobileEquipmentListItem
          equipment={{ ...waitingRepairEquipment, active_repair_request_id: 9001 }}
          {...{ statusCatalog: readyStatusCatalog }}
          onShowDetails={onShowDetails}
        />
      </LinkedRequestProvider>
    )

    await user.click(
      screen.getByRole("button", {
        name: "Xem yêu cầu sửa chữa hiện tại của thiết bị TB-042",
      })
    )

    expect(onShowDetails).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
