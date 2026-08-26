import * as React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useTechnicalConfigurationDossierList } from "../_hooks/useTechnicalConfigurationDossierList"
import type { TechnicalConfigurationDossierListRpcArgs } from "../types"
import {
  buildDossierListPage as buildPage,
  buildDossierListRow as buildRow,
  createQueryClient,
  flushQueryNotifications,
} from "./technical-configuration-dossier-actions-test-harness"

const mocks = vi.hoisted(() => ({
  listDossiers: vi.fn(),
}))

vi.mock("../technical-configuration-rpc", () => ({
  listTechnicalConfigurationDossiers: (...args: unknown[]) => mocks.listDossiers(...args),
}))

function getListCallArgs(call: number): TechnicalConfigurationDossierListRpcArgs {
  const [args] = mocks.listDossiers.mock.calls[call - 1] as [
    TechnicalConfigurationDossierListRpcArgs,
    AbortSignal?,
  ]

  return args
}

describe("technical configuration dossier list consistency", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()
    mocks.listDossiers.mockImplementation((args: TechnicalConfigurationDossierListRpcArgs) => {
      if (args.p_search !== undefined && args.p_search !== null && args.p_search !== "") {
        return Promise.resolve(
          buildPage(args, [buildRow(`tim-${args.p_search}-trang-${args.p_page}`)], 41)
        )
      }

      return Promise.resolve(buildPage(args, [buildRow(`trang-${args.p_page}`)], 60))
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("aborts the previous request when the settled query identity changes", async () => {
    const queryClient = createQueryClient()
    let previousSignal: AbortSignal | undefined

    mocks.listDossiers.mockImplementation(
      (args: TechnicalConfigurationDossierListRpcArgs, signal?: AbortSignal) => {
        if (args.p_search === undefined) {
          previousSignal = signal
          return new Promise(() => undefined)
        }

        return Promise.resolve(buildPage(args, [buildRow("tim-may-trang-1")], 1))
      }
    )

    const { result } = renderHook(() => useTechnicalConfigurationDossierList(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    })
    await flushQueryNotifications()

    expect(previousSignal?.aborted).toBe(false)

    act(() => {
      result.current.handleSearchTextChange("may")
    })
    act(() => {
      vi.advanceTimersByTime(299)
    })

    expect(previousSignal?.aborted).toBe(false)
    expect(mocks.listDossiers).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    await flushQueryNotifications()

    expect(previousSignal?.aborted).toBe(true)
    expect(getListCallArgs(2).p_search).toBe("may")
  })

  it("does not refetch an invalidated previous identity when the debounce settles", async () => {
    const queryClient = createQueryClient()

    const { result } = renderHook(() => useTechnicalConfigurationDossierList(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    })
    await flushQueryNotifications()

    act(() => {
      result.current.handlePageChange(2)
    })
    await flushQueryNotifications()
    expect(mocks.listDossiers).toHaveBeenCalledTimes(2)

    act(() => {
      result.current.handleSearchTextChange("x quang")
    })
    expect(result.current.isSearchPending).toBe(true)

    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: result.current.listQueryKey,
        exact: true,
      })
    })
    expect(mocks.listDossiers).toHaveBeenCalledTimes(2)

    act(() => {
      vi.advanceTimersByTime(300)
    })
    await flushQueryNotifications()

    expect(mocks.listDossiers).toHaveBeenCalledTimes(3)
    expect(getListCallArgs(3)).toEqual({
      p_page: 1,
      p_page_size: 20,
      p_include_archived: false,
      p_search: "x quang",
    })
  })

  it("keeps rows and pagination totals on the same query snapshot", async () => {
    const queryClient = createQueryClient()
    const snapshots: Array<{
      rowId: string | undefined
      total: number
      pageCount: number
    }> = []

    mocks.listDossiers.mockImplementation((args: TechnicalConfigurationDossierListRpcArgs) => {
      if (args.p_search === "may") {
        return Promise.resolve(buildPage(args, [buildRow("tim-may-trang-1")], 1))
      }

      return Promise.resolve(buildPage(args, [buildRow("trang-1")], 60))
    })

    const { result } = renderHook(
      () => {
        const list = useTechnicalConfigurationDossierList()
        snapshots.push({
          rowId: list.dossiers[0]?.id,
          total: list.total,
          pageCount: list.pageCount,
        })
        return list
      },
      {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    )
    await flushQueryNotifications()

    act(() => {
      result.current.handleSearchTextChange("may")
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    await flushQueryNotifications()

    const allowedSnapshots = [
      { rowId: undefined, total: 0, pageCount: 0 },
      { rowId: "trang-1", total: 60, pageCount: 3 },
      { rowId: "tim-may-trang-1", total: 1, pageCount: 1 },
    ]
    expect(
      snapshots.every((snapshot) =>
        allowedSnapshots.some(
          (allowed) =>
            allowed.rowId === snapshot.rowId &&
            allowed.total === snapshot.total &&
            allowed.pageCount === snapshot.pageCount
        )
      )
    ).toBe(true)
    expect(result.current.dossiers[0]?.id).toBe("tim-may-trang-1")
    expect(result.current.total).toBe(1)
    expect(result.current.pageCount).toBe(1)
  })
})
