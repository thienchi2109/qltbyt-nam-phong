import * as React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useTechnicalConfigurationDossierActions } from "../_hooks/useTechnicalConfigurationDossierActions"
import { useTechnicalConfigurationDossierList } from "../_hooks/useTechnicalConfigurationDossierList"
import { technicalConfigurationDossierListQueryKey } from "../technical-configuration-query-keys"
import type {
  TechnicalConfigurationDossierListRpcArgs,
  TechnicalConfigurationDossierListWireResponse,
  TechnicalConfigurationDossierWire,
} from "../types"
import {
  buildDossierListPage as buildPage,
  buildDossierListRow as buildRow,
  createQueryClient,
  dossier as baseDossier,
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

function getListCallArgs(call: number): TechnicalConfigurationDossierListRpcArgs {
  const [args] = mocks.listDossiers.mock.calls[call - 1] as [
    TechnicalConfigurationDossierListRpcArgs,
    AbortSignal?,
  ]

  return args
}

describe("technical configuration dossier search actions", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("falls back within the filtered result and invalidates inactive search variants after delete", async () => {
    const queryClient = createQueryClient()
    const unfilteredVariantKey = technicalConfigurationDossierListQueryKey({
      page: 1,
      pageSize: 20,
      normalizedSearch: "",
    })

    mocks.listDossiers.mockImplementation((args: TechnicalConfigurationDossierListRpcArgs) => {
      if (args.p_search === "may") {
        const rows = args.p_page === 2 ? [buildRow("loc-trang-2")] : [buildRow("loc-trang-1")]

        return Promise.resolve(buildPage(args, rows, 21))
      }

      return Promise.resolve(buildPage(args, [buildRow(`trang-${args.p_page}`)], 60))
    })
    mocks.deleteDossier.mockResolvedValue({ data: { id: "loc-trang-2" } })

    const { result } = renderHook(
      () => {
        const list = useTechnicalConfigurationDossierList()
        const [, setSelectedDossier] = React.useState<TechnicalConfigurationDossierWire | null>(
          null
        )
        const actions = useTechnicalConfigurationDossierActions({
          listQueryKey: list.listQueryKey,
          page: list.page,
          onPageChange: list.handlePageChange,
          onSelectedDossierChange: setSelectedDossier,
        })

        return { list, actions }
      },
      {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    )
    await flushQueryNotifications()

    act(() => {
      result.current.list.handleSearchTextChange("may")
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    await flushQueryNotifications()

    act(() => {
      result.current.list.handlePageChange(2)
    })
    await flushQueryNotifications()
    expect(result.current.list.dossiers[0]?.id).toBe("loc-trang-2")
    expect(queryClient.getQueryState(unfilteredVariantKey)?.isInvalidated).toBe(false)

    const target = result.current.list.dossiers[0]
    if (!target) throw new Error("expected a filtered page-2 row")
    const callCountBeforeDelete = mocks.listDossiers.mock.calls.length
    act(() => {
      result.current.actions.openDelete(target)
    })
    await act(async () => {
      await result.current.actions.submitDelete()
    })
    await flushQueryNotifications()

    expect(result.current.list.page).toBe(1)
    expect(result.current.list.dossiers[0]?.id).toBe("loc-trang-1")
    expect(
      mocks.listDossiers.mock.calls
        .slice(callCountBeforeDelete)
        .map(([args]) => args as TechnicalConfigurationDossierListRpcArgs)
    ).toEqual([
      {
        p_page: 1,
        p_page_size: 20,
        p_include_archived: false,
        p_search: "may",
      },
    ])
    expect(queryClient.getQueryState(unfilteredVariantKey)?.isInvalidated).toBe(true)
  })

  it("invalidates every search variant while merging edits into the active variant only", async () => {
    const queryClient = createQueryClient()
    const unfilteredVariantKey = technicalConfigurationDossierListQueryKey({
      page: 1,
      pageSize: 20,
      normalizedSearch: "",
    })
    let updateCompleted = false
    let resolveActiveRefetch:
      ((response: TechnicalConfigurationDossierListWireResponse) => void) | undefined

    mocks.listDossiers.mockImplementation((args: TechnicalConfigurationDossierListRpcArgs) => {
      if (args.p_search !== undefined && args.p_search !== null && args.p_search !== "") {
        if (updateCompleted) {
          return new Promise((resolve) => {
            resolveActiveRefetch = resolve
          })
        }

        return Promise.resolve(buildPage(args, [buildRow(baseDossier.id)], 41))
      }

      return Promise.resolve(buildPage(args, [buildRow(`trang-${args.p_page}`)], 60))
    })
    mocks.updateDossier.mockImplementation(async () => {
      updateCompleted = true

      return { data: { ...baseDossier, name: "Tên đã sửa", revision: 8 } }
    })

    const { result } = renderHook(
      () => {
        const list = useTechnicalConfigurationDossierList()
        const [, setSelectedDossier] = React.useState<TechnicalConfigurationDossierWire | null>(
          null
        )
        const actions = useTechnicalConfigurationDossierActions({
          listQueryKey: list.listQueryKey,
          page: list.page,
          onPageChange: list.handlePageChange,
          onSelectedDossierChange: setSelectedDossier,
        })

        return { list, actions }
      },
      {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    )
    await flushQueryNotifications()

    act(() => {
      result.current.list.handleSearchTextChange("may")
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    await flushQueryNotifications()

    queryClient.setQueryData<TechnicalConfigurationDossierListWireResponse>(
      unfilteredVariantKey,
      buildPage({ p_page: 1 }, [baseDossier], 60)
    )

    act(() => {
      result.current.actions.openEdit(result.current.list.dossiers[0])
    })
    let submission: Promise<void> | undefined
    act(() => {
      submission = result.current.actions.submitEdit({
        p_id: baseDossier.id,
        p_device_type_name: baseDossier.device_type_name,
        p_name: "Tên đã sửa",
        p_description: null,
        p_expected_revision: baseDossier.revision,
      })
    })
    await flushQueryNotifications()

    const activeCacheDuringRefetch =
      queryClient.getQueryData<TechnicalConfigurationDossierListWireResponse>(
        result.current.list.listQueryKey
      )
    expect(activeCacheDuringRefetch?.data[0]).toMatchObject({
      id: baseDossier.id,
      name: "Tên đã sửa",
      revision: 8,
    })
    expect(
      queryClient.getQueryData<TechnicalConfigurationDossierListWireResponse>(unfilteredVariantKey)
        ?.data[0]
    ).toMatchObject({
      id: baseDossier.id,
      name: baseDossier.name,
      revision: baseDossier.revision,
    })
    expect(queryClient.getQueryState(unfilteredVariantKey)?.isInvalidated).toBe(true)

    const completeActiveRefetch = resolveActiveRefetch
    if (!completeActiveRefetch || !submission) {
      throw new Error("expected update invalidation to start an active refetch")
    }
    await act(async () => {
      completeActiveRefetch(
        buildPage(
          { p_page: 1, p_page_size: 20, p_search: "may" },
          [{ ...baseDossier, name: "Tên đã sửa", revision: 8 }],
          41
        )
      )
      await submission
    })
    await flushQueryNotifications()

    const activeCacheAfterRefetch =
      queryClient.getQueryData<TechnicalConfigurationDossierListWireResponse>(
        result.current.list.listQueryKey
      )
    expect(activeCacheAfterRefetch?.data[0]?.name).toBe("Tên đã sửa")
  })
})
