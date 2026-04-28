import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LinkedRequestProvider, LinkedRequestSheetHost } from "@/components/equipment-linked-request"
import { createEquipmentColumns } from "@/components/equipment/equipment-table-columns"
import { MobileEquipmentListItem } from "@/components/mobile-equipment-list-item"
import type { Equipment } from "@/types/database"
import { EquipmentContent } from "../equipment-content"

const mockCallRpc = vi.fn()
const mockToast = vi.fn()

vi.mock("@/lib/rpc-client", () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))

vi.mock("@/hooks/use-toast", () => ({
  toast: (args: unknown) => mockToast(args),
}))

vi.mock("@/components/ui/tooltip", async () => {
  const { tooltipMockModule } = await import("@/test-utils/tooltip-mock")
  return tooltipMockModule
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => <div {...props}>{children}</div>,
}))

vi.mock("@/components/mobile-usage-actions", () => ({
  MobileUsageActions: () => <button type="button">Sử dụng</button>,
}))

vi.mock("next/dynamic", () => ({
  default: () =>
    function AdapterStub({
      request,
      activeCount,
      onClose,
    }: {
      request: { id: number }
      activeCount: number
      onClose: () => void
    }) {
      return (
        <div data-testid="adapter-stub">
          <span data-testid="adapter-request-id">{request.id}</span>
          <span data-testid="adapter-active-count">{activeCount}</span>
          <button type="button" onClick={onClose}>close linked request</button>
        </div>
      )
    },
}))

const baseEquipment: Equipment = {
  id: 501,
  ma_thiet_bi: "TB-501",
  ten_thiet_bi: "Máy thở",
  tinh_trang_hien_tai: "Chờ sửa chữa",
  active_repair_request_id: 7001,
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function DesktopHarness({
  equipment,
  onShowDetails = vi.fn(),
}: {
  equipment: Equipment
  onShowDetails?: (equipment: Equipment) => void
}) {
  const columns = React.useMemo(
    () => createEquipmentColumns({ renderActions: () => null }),
    [],
  )
  const table = useReactTable({
    data: [equipment],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <EquipmentContent
      isGlobal={false}
      isRegionalLeader={false}
      shouldFetchEquipment={true}
      isLoading={false}
      isFetching={false}
      isCardView={false}
      table={table}
      columns={columns}
      onShowDetails={onShowDetails}
    />
  )
}

function renderLinkedRequestHarness(
  ui: React.ReactNode,
  client = makeQueryClient(),
) {
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <LinkedRequestProvider>
          {ui}
          <LinkedRequestSheetHost />
        </LinkedRequestProvider>
      </QueryClientProvider>,
    ),
  }
}

describe("equipment row linked request integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallRpc.mockReset()
    mockToast.mockReset()
  })

  it("opens the active repair sheet from a desktop equipment row", async () => {
    const user = userEvent.setup()
    mockCallRpc.mockResolvedValueOnce({
      active_count: 1,
      request: { id: 7001, thiet_bi_id: 501 },
    })

    renderLinkedRequestHarness(<DesktopHarness equipment={baseEquipment} />)

    await user.click(screen.getByRole("button", {
      name: "Xem yêu cầu sửa chữa hiện tại của thiết bị TB-501",
    }))

    expect(await screen.findByTestId("adapter-request-id")).toHaveTextContent("7001")
    expect(mockCallRpc).toHaveBeenCalledWith(expect.objectContaining({
      fn: "repair_request_active_for_equipment",
      args: { p_thiet_bi_id: 501 },
    }))
  })

  it("opens the active repair sheet from a mobile equipment card", async () => {
    const user = userEvent.setup()
    mockCallRpc.mockResolvedValueOnce({
      active_count: 1,
      request: { id: 7002, thiet_bi_id: 501 },
    })

    renderLinkedRequestHarness(
      <MobileEquipmentListItem equipment={baseEquipment} onShowDetails={vi.fn()} />,
    )

    await user.click(screen.getByRole("button", {
      name: "Xem yêu cầu sửa chữa hiện tại của thiết bị TB-501",
    }))

    expect(await screen.findByTestId("adapter-request-id")).toHaveTextContent("7002")
  })

  it("shows a loading sheet while the active repair resolver is pending", async () => {
    const user = userEvent.setup()
    mockCallRpc.mockImplementationOnce(() => new Promise(() => {}))

    renderLinkedRequestHarness(<DesktopHarness equipment={baseEquipment} />)

    await user.click(screen.getByRole("button", {
      name: "Xem yêu cầu sửa chữa hiện tại của thiết bị TB-501",
    }))

    expect(await screen.findByText("Đang mở yêu cầu sửa chữa")).toBeInTheDocument()
  })

  it("shows an error sheet when the active repair resolver fails", async () => {
    const user = userEvent.setup()
    mockCallRpc.mockRejectedValueOnce(new Error("RPC failed"))

    renderLinkedRequestHarness(<DesktopHarness equipment={baseEquipment} />)

    await user.click(screen.getByRole("button", {
      name: "Xem yêu cầu sửa chữa hiện tại của thiết bị TB-501",
    }))

    expect(await screen.findByText("Không thể mở yêu cầu sửa chữa")).toBeInTheDocument()
  })

  it("passes multi-active count through to the sheet adapter", async () => {
    const user = userEvent.setup()
    mockCallRpc.mockResolvedValueOnce({
      active_count: 3,
      request: { id: 7003, thiet_bi_id: 501 },
    })

    renderLinkedRequestHarness(<DesktopHarness equipment={baseEquipment} />)

    await user.click(screen.getByRole("button", {
      name: "Xem yêu cầu sửa chữa hiện tại của thiết bị TB-501",
    }))

    expect(await screen.findByTestId("adapter-active-count")).toHaveTextContent("3")
  })

  it("auto-closes and toasts when the resolver returns no active request", async () => {
    const user = userEvent.setup()
    mockCallRpc.mockResolvedValueOnce({ active_count: 0, request: null })

    renderLinkedRequestHarness(<DesktopHarness equipment={baseEquipment} />)

    await user.click(screen.getByRole("button", {
      name: "Xem yêu cầu sửa chữa hiện tại của thiết bị TB-501",
    }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: "Yêu cầu đã được hoàn thành" })
    })
    expect(screen.queryByTestId("adapter-stub")).toBeNull()
  })

  it("keeps row click behavior outside the wrench icon", async () => {
    const user = userEvent.setup()
    const onShowDetails = vi.fn()
    mockCallRpc.mockResolvedValueOnce({
      active_count: 1,
      request: { id: 7004, thiet_bi_id: 501 },
    })

    renderLinkedRequestHarness(
      <DesktopHarness equipment={baseEquipment} onShowDetails={onShowDetails} />,
    )

    await user.click(screen.getByRole("button", {
      name: "Xem yêu cầu sửa chữa hiện tại của thiết bị TB-501",
    }))
    expect(onShowDetails).not.toHaveBeenCalled()

    await user.click(await screen.findByRole("button", { name: "close linked request" }))
    await user.click(screen.getByText("TB-501"))
    expect(onShowDetails).toHaveBeenCalledWith(baseEquipment)
  })

  it("does not show a stale request after switching equipment mid-fetch", async () => {
    const user = userEvent.setup()
    let resolveFirst: (value: unknown) => void = () => {}
    mockCallRpc
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce({
        active_count: 1,
        request: { id: 8002, thiet_bi_id: 502 },
      })

    const secondEquipment: Equipment = {
      ...baseEquipment,
      id: 502,
      ma_thiet_bi: "TB-502",
      active_repair_request_id: 8002,
    }

    function RaceHarness() {
      const [equipment, setEquipment] = React.useState(baseEquipment)
      return (
        <>
          <button type="button" onClick={() => setEquipment(secondEquipment)}>
            switch equipment
          </button>
          <DesktopHarness equipment={equipment} />
        </>
      )
    }

    renderLinkedRequestHarness(<RaceHarness />)

    await user.click(screen.getByRole("button", {
      name: "Xem yêu cầu sửa chữa hiện tại của thiết bị TB-501",
    }))
    await user.click(await screen.findByRole("button", { name: "Đóng" }))
    await user.click(screen.getByRole("button", { name: "switch equipment" }))
    await user.click(screen.getByRole("button", {
      name: "Xem yêu cầu sửa chữa hiện tại của thiết bị TB-502",
    }))

    resolveFirst({
      active_count: 1,
      request: { id: 8001, thiet_bi_id: 501 },
    })

    expect(await screen.findByTestId("adapter-request-id")).toHaveTextContent("8002")
  })
})
