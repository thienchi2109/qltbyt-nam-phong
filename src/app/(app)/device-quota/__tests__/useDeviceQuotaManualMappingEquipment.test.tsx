import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useDeviceQuotaManualMappingEquipment } from "../_hooks/useDeviceQuotaManualMappingEquipment"
import { callRpc } from "@/lib/rpc-client"

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

const mockCallRpc = vi.mocked(callRpc)

type RpcCall = {
  fn: string
  args?: Record<string, unknown>
}

const equipmentRows = [
  {
    id: 101,
    ma_thiet_bi: "TB101",
    ten_thiet_bi: "Thiết bị 101",
    model: null,
    serial: null,
    hang_san_xuat: null,
    khoa_phong_quan_ly: "Khoa A",
    tinh_trang: null,
    total_count: 100,
  },
]

function Probe({ donViId }: { donViId: number | null }) {
  const mapping = useDeviceQuotaManualMappingEquipment({ donViId })

  return (
    <div>
      <div data-testid="page">{mapping.pagination.page}</div>
      <input
        aria-label="Tìm thiết bị"
        value={mapping.filters.searchTerm}
        onChange={(event) => mapping.filters.setSearchTerm(event.target.value)}
      />
      <button
        type="button"
        onClick={() => mapping.pagination.setPagination({ pageIndex: 2, pageSize: 20 })}
      >
        Trang 3
      </button>
      <button type="button" onClick={() => mapping.filters.setSelectedDepartments(["Khoa A"])}>
        Lọc Khoa A
      </button>
    </div>
  )
}

function renderHookProbe(donViId: number | null) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <Probe donViId={donViId} />
      </QueryClientProvider>
    ),
  }
}

function getLatestEquipmentCall(): RpcCall | undefined {
  return mockCallRpc.mock.calls
    .map(([call]) => call as RpcCall)
    .toReversed()
    .find((call) => call.fn === "dinh_muc_thiet_bi_unassigned")
}

describe("useDeviceQuotaManualMappingEquipment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallRpc.mockImplementation(({ fn }: RpcCall) => {
      if (fn === "dinh_muc_thiet_bi_unassigned_filter_options") {
        return Promise.resolve({
          departments: ["Khoa A"],
          users: [],
          locations: [],
          fundingSources: [],
        })
      }
      if (fn === "dinh_muc_thiet_bi_unassigned") {
        return Promise.resolve(equipmentRows)
      }
      return Promise.resolve([])
    })
  })

  it("does not query manual-mapping data until a facility is selected", async () => {
    const { queryClient } = renderHookProbe(null)

    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0)
    })
    expect(mockCallRpc).not.toHaveBeenCalled()
  })

  it("preserves the initial query keys and complete RPC arguments", async () => {
    const { queryClient } = renderHookProbe(7)
    const expectedEquipmentQueryKey = [
      "dinh_muc_thiet_bi_unassigned",
      {
        donViId: 7,
        search: "",
        departments: [],
        users: [],
        locations: [],
        fundingSources: [],
        page: 1,
        pageSize: 20,
      },
    ]

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: "dinh_muc_thiet_bi_unassigned",
        args: {
          p_don_vi: 7,
          p_search: null,
          p_limit: 20,
          p_offset: 0,
          p_khoa_phong_array: null,
          p_nguoi_su_dung_array: null,
          p_vi_tri_lap_dat_array: null,
          p_nguon_kinh_phi_array: null,
        },
      })
    })
    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: "dinh_muc_thiet_bi_unassigned_filter_options",
      args: { p_don_vi: 7 },
    })
    expect(
      queryClient.getQueryCache().find({
        queryKey: ["dinh_muc_thiet_bi_unassigned_filter_options", { donViId: 7 }],
        exact: true,
      })
    ).toBeDefined()
    expect(
      queryClient.getQueryCache().find({
        queryKey: expectedEquipmentQueryKey,
        exact: true,
      })
    ).toBeDefined()
  })

  it("resets pagination after user-driven search and filter changes", async () => {
    const user = userEvent.setup()
    renderHookProbe(7)

    await waitFor(() => {
      expect(getLatestEquipmentCall()).toBeDefined()
    })

    await user.click(screen.getByRole("button", { name: "Trang 3" }))
    await waitFor(() => {
      expect(screen.getByTestId("page")).toHaveTextContent("3")
      expect(getLatestEquipmentCall()?.args).toEqual(expect.objectContaining({ p_offset: 40 }))
    })

    await user.type(screen.getByRole("textbox", { name: "Tìm thiết bị" }), "máy")
    await waitFor(() => {
      expect(screen.getByTestId("page")).toHaveTextContent("1")
      expect(getLatestEquipmentCall()?.args).toEqual(
        expect.objectContaining({
          p_search: "máy",
          p_offset: 0,
        })
      )
    })

    await user.click(screen.getByRole("button", { name: "Trang 3" }))
    await waitFor(() => {
      expect(screen.getByTestId("page")).toHaveTextContent("3")
    })
    await user.click(screen.getByRole("button", { name: "Lọc Khoa A" }))

    await waitFor(() => {
      expect(screen.getByTestId("page")).toHaveTextContent("1")
      expect(getLatestEquipmentCall()).toEqual({
        fn: "dinh_muc_thiet_bi_unassigned",
        args: {
          p_don_vi: 7,
          p_search: "máy",
          p_limit: 20,
          p_offset: 0,
          p_khoa_phong_array: ["Khoa A"],
          p_nguoi_su_dung_array: null,
          p_vi_tri_lap_dat_array: null,
          p_nguon_kinh_phi_array: null,
        },
      })
    })
  })
})
