import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { callRpc } from "@/lib/rpc-client"
import {
  DeviceQuotaMappingProvider,
  type DeviceQuotaMappingContextValue,
} from "@/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingContext"
import { useDeviceQuotaMappingContext } from "@/app/(app)/device-quota/mapping/_hooks/useDeviceQuotaMappingContext"

const mockUseSession = vi.fn()
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}))

vi.mock("@/contexts/TenantSelectionContext", () => ({
  useTenantSelection: () => ({
    selectedFacilityId: null,
    showSelector: false,
  }),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

const mockCallRpc = vi.mocked(callRpc)

type RpcCall = {
  fn: string
  args?: Record<string, unknown>
}

function Probe() {
  const context: DeviceQuotaMappingContextValue = useDeviceQuotaMappingContext()
  const selectedIds = Array.from(context.selectedEquipmentIds).join(",")

  return (
    <div>
      <div data-testid="page">{context.pagination.page}</div>
      <div data-testid="total">{context.totalEquipmentCount}</div>
      <div data-testid="selected-equipment">{selectedIds}</div>
      <div data-testid="selected-category">{context.selectedCategoryId ?? "none"}</div>
      <button type="button" onClick={() => context.pagination.setPagination({ pageIndex: 1, pageSize: 20 })}>
        Go page 2
      </button>
      <button type="button" onClick={context.selectAllEquipment}>
        Select page
      </button>
      <button type="button" onClick={context.deselectPageEquipment}>
        Deselect page
      </button>
      <button type="button" onClick={context.clearEquipmentSelection}>
        Clear equipment
      </button>
      <button type="button" onClick={() => context.setSelectedCategory(5)}>
        Select category
      </button>
    </div>
  )
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function renderProvider() {
  return render(
    <DeviceQuotaMappingProvider>
      <Probe />
    </DeviceQuotaMappingProvider>,
    { wrapper: createWrapper() }
  )
}

describe("DeviceQuotaMappingProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1", role: "admin", don_vi: "1" } },
      status: "authenticated",
    })
    mockCallRpc.mockImplementation(({ fn, args }: RpcCall) => {
      if (fn === "dinh_muc_thiet_bi_unassigned_filter_options") {
        return Promise.resolve({ departments: [], users: [], locations: [], fundingSources: [] })
      }

      if (fn === "dinh_muc_nhom_list") {
        return Promise.resolve([
          {
            id: 5,
            parent_id: null,
            ma_nhom: "DM05",
            ten_nhom: "Danh mục 5",
            phan_loai: "B",
            level: 1,
            so_luong_hien_co: 0,
          },
        ])
      }

      if (fn === "dinh_muc_thiet_bi_unassigned") {
        if (args?.p_offset === 20) return Promise.resolve([])

        return Promise.resolve([
          {
            id: 101,
            ma_thiet_bi: "TB101",
            ten_thiet_bi: "Thiết bị 101",
            model: null,
            serial: null,
            hang_san_xuat: null,
            khoa_phong_quan_ly: null,
            tinh_trang: null,
            total_count: 21,
          },
          {
            id: 102,
            ma_thiet_bi: "TB102",
            ten_thiet_bi: "Thiết bị 102",
            model: null,
            serial: null,
            hang_san_xuat: null,
            khoa_phong_quan_ly: null,
            tinh_trang: null,
            total_count: 21,
          },
        ])
      }

      return Promise.resolve([])
    })
  })

  it("resets an empty out-of-range page back to the first page", async () => {
    renderProvider()

    await waitFor(() => {
      expect(screen.getByTestId("total")).toHaveTextContent("21")
    })

    fireEvent.click(screen.getByRole("button", { name: "Go page 2" }))

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledWith(
        expect.objectContaining({
          fn: "dinh_muc_thiet_bi_unassigned",
          args: expect.objectContaining({ p_offset: 20 }),
        })
      )
    })
    await waitFor(() => {
      expect(screen.getByTestId("page")).toHaveTextContent("1")
    })
  })

  it("keeps page selection actions and category selection independent", async () => {
    renderProvider()

    await waitFor(() => {
      expect(screen.getByTestId("total")).toHaveTextContent("21")
    })

    fireEvent.click(screen.getByRole("button", { name: "Select page" }))
    fireEvent.click(screen.getByRole("button", { name: "Select category" }))

    expect(screen.getByTestId("selected-equipment")).toHaveTextContent("101,102")
    expect(screen.getByTestId("selected-category")).toHaveTextContent("5")

    fireEvent.click(screen.getByRole("button", { name: "Deselect page" }))

    expect(screen.getByTestId("selected-equipment")).toBeEmptyDOMElement()
    expect(screen.getByTestId("selected-category")).toHaveTextContent("5")
  })
})
