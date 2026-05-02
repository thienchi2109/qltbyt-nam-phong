import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TransferKanbanResponse } from "@/types/transfers-data-grid"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

import { transferKanbanKeys, useTransfersKanban } from "../useTransfersKanban"

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false,
      },
    },
  })
}

function makeKanbanResponse(totalCount: number): TransferKanbanResponse {
  return {
    columns: {
      cho_duyet: { tasks: [], total: totalCount, hasMore: false },
      da_duyet: { tasks: [], total: 0, hasMore: false },
      dang_luan_chuyen: { tasks: [], total: 0, hasMore: false },
      da_ban_giao: { tasks: [], total: 0, hasMore: false },
      hoan_thanh: { tasks: [], total: 0, hasMore: false },
    },
    totalCount,
  }
}

describe("useTransfersKanban", () => {
  beforeEach(() => {
    mocks.callRpc.mockReset()
  })

  it("uses initial page data without disabling background refresh", async () => {
    mocks.callRpc.mockResolvedValue(makeKanbanResponse(2))

    const queryClient = createQueryClient()
    const filters = { types: ["noi_bo"] as const, facilityId: 7 }
    const { result } = renderHook(
      () =>
        useTransfersKanban(
          filters,
          {
            initialData: makeKanbanResponse(1),
            perColumnLimit: 30,
            userRole: "to_qltb",
          },
        ),
      { wrapper: createWrapper(queryClient) },
    )

    expect(result.current.data?.totalCount).toBe(1)

    const query = queryClient.getQueryCache().find({
      queryKey: transferKanbanKeys.filtered(filters, {
        excludeCompleted: true,
        perColumnLimit: 30,
      }),
    })

    expect(query?.options.refetchInterval).toBe(60_000)
    expect(mocks.callRpc).not.toHaveBeenCalled()
  })
})
