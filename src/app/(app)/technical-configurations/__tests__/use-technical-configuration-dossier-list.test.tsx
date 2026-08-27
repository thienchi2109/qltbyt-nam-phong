import * as React from "react"
import "@testing-library/jest-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type {
  TechnicalConfigurationDossierListItemWire,
  TechnicalConfigurationDossierListRpcArgs,
  TechnicalConfigurationDossierListWireResponse,
} from "@/app/(app)/technical-configurations/types"
import {
  buildDossierListPage as buildPage,
  buildDossierListRow as buildRow,
  createQueryClient,
  flushQueryNotifications,
} from "./technical-configuration-dossier-actions-test-harness"

const mocks = vi.hoisted(() => ({
  listDossiers: vi.fn(),
  getDossier: vi.fn(),
  createDossier: vi.fn(),
  updateDossier: vi.fn(),
  deleteDossier: vi.fn(),
}))

vi.mock("../technical-configuration-rpc", () => ({
  listTechnicalConfigurationDossiers: (...args: unknown[]) => mocks.listDossiers(...args),
  getTechnicalConfigurationDossier: (...args: unknown[]) => mocks.getDossier(...args),
  createTechnicalConfigurationDossier: (...args: unknown[]) => mocks.createDossier(...args),
  updateTechnicalConfigurationDossier: (...args: unknown[]) => mocks.updateDossier(...args),
  deleteTechnicalConfigurationDossier: (...args: unknown[]) => mocks.deleteDossier(...args),
}))

type DossierListModuleContract = {
  useTechnicalConfigurationDossierList?: () => {
    searchText: string
    handleSearchTextChange: (value: string) => void
    dossiers: TechnicalConfigurationDossierListItemWire[]
    total: number
    page: number
    pageSize: number
    pageCount: number
    canPreviousPage: boolean
    canNextPage: boolean
    handlePageChange: (page: number) => void
    listQueryKey: readonly unknown[]
    isLoading: boolean
    isError: boolean
    error: unknown
    refetch: () => void
    isSearchPending: boolean
  }
}

async function importDossierListHook() {
  const hookModule =
    (await import("../_hooks/useTechnicalConfigurationDossierList")) as DossierListModuleContract
  const useDossierList = hookModule.useTechnicalConfigurationDossierList
  if (!useDossierList) {
    throw new Error("useTechnicalConfigurationDossierList is not available")
  }

  return useDossierList
}

function getListCallArgs(call: number): TechnicalConfigurationDossierListRpcArgs {
  const [args] = mocks.listDossiers.mock.calls[call - 1] as [
    TechnicalConfigurationDossierListRpcArgs,
    AbortSignal?,
  ]

  return args
}

describe("useTechnicalConfigurationDossierList", () => {
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

  it("loads the default first page on mount without sending p_search", async () => {
    const useDossierList = await importDossierListHook()
    const queryClient = createQueryClient()

    renderHook(() => useDossierList(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    })

    await flushQueryNotifications()

    expect(mocks.listDossiers).toHaveBeenCalledTimes(1)
    expect(getListCallArgs(1)).toEqual({
      p_page: 1,
      p_page_size: 20,
      p_include_archived: false,
    })
    expect(Object.hasOwn(getListCallArgs(1), "p_search")).toBe(false)
  })

  it("sends zero requests through 299 ms and exactly one current-search page-1 request at 300 ms", async () => {
    const useDossierList = await importDossierListHook()
    const queryClient = createQueryClient()

    const { result } = renderHook(() => useDossierList(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    })
    await flushQueryNotifications()

    act(() => {
      result.current.handleSearchTextChange("May Siêu Âm")
    })
    act(() => {
      vi.advanceTimersByTime(299)
    })

    expect(mocks.listDossiers).toHaveBeenCalledTimes(1)
    expect(result.current.isSearchPending).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    await flushQueryNotifications()

    expect(mocks.listDossiers).toHaveBeenCalledTimes(2)
    expect(getListCallArgs(2)).toEqual({
      p_page: 1,
      p_page_size: 20,
      p_include_archived: false,
      p_search: "may sieu am",
    })
    expect(result.current.isSearchPending).toBe(false)
    expect(result.current.dossiers[0]?.id).toBe("tim-may sieu am-trang-1")
  })

  it("resets pagination immediately on a later page while keeping last-settled rows pinned through the debounce window", async () => {
    const useDossierList = await importDossierListHook()
    const queryClient = createQueryClient()

    const { result } = renderHook(() => useDossierList(), {
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
    expect(result.current.dossiers[0]?.id).toBe("trang-2")

    act(() => {
      result.current.handleSearchTextChange("x quang")
    })

    expect(result.current.page).toBe(1)
    expect(result.current.dossiers[0]?.id).toBe("trang-2")
    expect(mocks.listDossiers).toHaveBeenCalledTimes(2)

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(mocks.listDossiers).toHaveBeenCalledTimes(2)
    expect(result.current.dossiers[0]?.id).toBe("trang-2")

    act(() => {
      vi.advanceTimersByTime(1)
    })
    await flushQueryNotifications()

    expect(mocks.listDossiers).toHaveBeenCalledTimes(3)
    expect(getListCallArgs(3)).toEqual({
      p_page: 1,
      p_page_size: 20,
      p_include_archived: false,
      p_search: "x quang",
    })
    expect(result.current.dossiers[0]?.id).toBe("tim-x quang-trang-1")
  })

  it("keeps one settled identity for equivalent normalized input without extra requests or reset", async () => {
    const useDossierList = await importDossierListHook()
    const queryClient = createQueryClient()

    const { result } = renderHook(() => useDossierList(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    })
    await flushQueryNotifications()

    act(() => {
      result.current.handleSearchTextChange("Máy")
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    await flushQueryNotifications()

    expect(mocks.listDossiers).toHaveBeenCalledTimes(2)
    expect(getListCallArgs(2).p_search).toBe("may")

    act(() => {
      result.current.handleSearchTextChange("  Máy  ")
    })
    expect(result.current.isSearchPending).toBe(false)

    act(() => {
      vi.advanceTimersByTime(600)
    })
    await flushQueryNotifications()

    expect(mocks.listDossiers).toHaveBeenCalledTimes(2)
    expect(result.current.page).toBe(1)
    expect(result.current.searchText).toBe("  Máy  ")
  })

  it("retains previous rows while the next settled page request is pending", async () => {
    const useDossierList = await importDossierListHook()
    const queryClient = createQueryClient()
    let resolvePage2: ((response: TechnicalConfigurationDossierListWireResponse) => void) | null =
      null

    mocks.listDossiers.mockImplementation((args: TechnicalConfigurationDossierListRpcArgs) => {
      if (args.p_page === 2) {
        return new Promise((resolve) => {
          resolvePage2 = resolve
        })
      }

      return Promise.resolve(buildPage(args, [buildRow(`trang-${args.p_page}`)], 60))
    })

    const { result } = renderHook(() => useDossierList(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    })
    await flushQueryNotifications()

    act(() => {
      result.current.handlePageChange(2)
    })

    expect(result.current.dossiers[0]?.id).toBe("trang-1")

    resolvePage2?.(buildPage({ p_page: 2 }, [buildRow("trang-2")], 60))
    await flushQueryNotifications()

    expect(result.current.dossiers[0]?.id).toBe("trang-2")
  })

  it("reports filtered totals and page count derived from the settled search", async () => {
    const useDossierList = await importDossierListHook()
    const queryClient = createQueryClient()

    const { result } = renderHook(() => useDossierList(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    })
    await flushQueryNotifications()

    expect(result.current.total).toBe(60)
    expect(result.current.pageCount).toBe(3)
    expect(result.current.canNextPage).toBe(true)

    act(() => {
      result.current.handleSearchTextChange("may")
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    await flushQueryNotifications()

    expect(result.current.total).toBe(41)
    expect(result.current.pageCount).toBe(3)
  })
})
