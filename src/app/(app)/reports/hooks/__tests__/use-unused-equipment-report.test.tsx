import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

import { useUnusedEquipmentReport } from "../use-unused-equipment-report"

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

describe("useUnusedEquipmentReport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls the server-side report RPC with facility scope and table controls", async () => {
    mocks.callRpc.mockResolvedValueOnce({
      summary: {
        totalCount: 1,
        deviceTypeCount: 1,
        departmentCount: 1,
        totalOriginalValue: 1000000,
      },
      topDeviceGroups: [],
      departments: [],
      items: [],
      totalCount: 1,
      page: 2,
      pageSize: 20,
    })

    const queryClient = createQueryClient()

    renderHook(
      () =>
        useUnusedEquipmentReport({
          selectedDonVi: 17,
          searchTerm: "Máy thở",
          selectedDepartment: "ICU",
          page: 2,
          pageSize: 20,
          sort: "ten_thiet_bi.asc",
          enabled: true,
        }),
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => expect(mocks.callRpc).toHaveBeenCalledTimes(1))

    expect(mocks.callRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: "unused_equipment_report_for_reports",
        args: {
          p_don_vi: 17,
          p_q: "Máy thở",
          p_khoa_phong: "ICU",
          p_page: 2,
          p_page_size: 20,
          p_sort: "ten_thiet_bi.asc",
        },
        signal: expect.any(AbortSignal),
      })
    )
  })

  it("keeps the query disabled when facility scope is not ready", async () => {
    const queryClient = createQueryClient()

    const { result } = renderHook(
      () =>
        useUnusedEquipmentReport({
          selectedDonVi: null,
          searchTerm: "",
          selectedDepartment: "all",
          page: 1,
          pageSize: 10,
          sort: "ten_thiet_bi.asc",
          enabled: false,
        }),
      { wrapper: createWrapper(queryClient) }
    )

    expect(result.current.fetchStatus).toBe("idle")
    expect(mocks.callRpc).not.toHaveBeenCalled()
  })
})
