import * as React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useTechnicalConfigurationDossierList } from "../_hooks/useTechnicalConfigurationDossierList"
import { useTechnicalConfigurationDossierSpecialties } from "../_hooks/useTechnicalConfigurationDossierSpecialties"
import {
  TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
  technicalConfigurationDossierListQueryKey,
} from "../technical-configuration-query-keys"
import {
  buildDossierListPage,
  buildDossierListRow,
  createQueryClient,
  flushQueryNotifications,
} from "./technical-configuration-dossier-actions-test-harness"

const mocks = vi.hoisted(() => ({ list: vi.fn(), options: vi.fn() }))
vi.mock("../technical-configuration-rpc", () => ({
  listTechnicalConfigurationDossiers: (...args: unknown[]) => mocks.list(...args),
  listTechnicalConfigurationDossierSpecialties: (...args: unknown[]) => mocks.options(...args),
}))
beforeEach(() => {
  vi.useFakeTimers()
  mocks.list
    .mockReset()
    .mockImplementation((args) =>
      Promise.resolve(buildDossierListPage(args, [buildDossierListRow("dossier-1")], 60))
    )
  mocks.options
    .mockReset()
    .mockResolvedValue({ data: ["Tim mạch"], total: 101, page: 1, page_size: 100 })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it("separates all, null and exact-label cache entries", () => {
  const base = { page: 1, pageSize: 20, normalizedSearch: "may" }
  const keys = [undefined, null, "Tim mạch"].map((specialtyFilter) =>
    JSON.stringify(technicalConfigurationDossierListQueryKey({ ...base, specialtyFilter }))
  )
  expect(new Set(keys).size).toBe(3)
})

it("resets a later page for null/exact/all filters while preserving search", async () => {
  const client = createQueryClient()
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result, rerender } = renderHook(
    ({ filter }: { filter: string | null | undefined }) =>
      useTechnicalConfigurationDossierList(filter),
    { wrapper, initialProps: { filter: undefined as string | null | undefined } }
  )
  await flushQueryNotifications()
  act(() => result.current.handleSearchTextChange("may"))
  act(() => vi.advanceTimersByTime(300))
  await flushQueryNotifications()
  act(() => result.current.handlePageChange(2))
  await flushQueryNotifications()
  for (const filter of [null, "Tim mạch", undefined]) {
    rerender({ filter })
    await flushQueryNotifications()
    expect(result.current.page).toBe(1)
    expect(result.current.listQueryKey).toEqual(
      technicalConfigurationDossierListQueryKey({
        page: 1,
        pageSize: 20,
        normalizedSearch: "may",
        specialtyFilter: filter,
      })
    )
    if (filter !== undefined) {
      expect(mocks.list.mock.lastCall?.[0]).toEqual({
        p_page: 1,
        p_page_size: 20,
        p_include_archived: false,
        p_search: "may",
        p_filter_specialty: true,
        p_specialty: filter,
      })
    }
  }
  expect(result.current.searchText).toBe("may")
})

it("keeps options pagination independent and refreshes on dossier mutation invalidation", async () => {
  const client = createQueryClient()
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result, rerender } = renderHook(
    ({ page }) => ({
      list: useTechnicalConfigurationDossierList(),
      options: useTechnicalConfigurationDossierSpecialties({ p_page: page }),
    }),
    { wrapper, initialProps: { page: 1 } }
  )
  await flushQueryNotifications()
  act(() => result.current.list.handlePageChange(2))
  await flushQueryNotifications()
  expect(mocks.options).toHaveBeenCalledTimes(1)
  rerender({ page: 2 })
  await flushQueryNotifications()
  expect(mocks.options.mock.lastCall?.[0]).toEqual({ p_page: 2, p_page_size: 100, p_search: null })
  expect(result.current.list.page).toBe(2)
  act(() => {
    void client.invalidateQueries({ queryKey: TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT })
  })
  await flushQueryNotifications()
  expect(mocks.options).toHaveBeenCalledTimes(3)
})

it("serializes null-filter as an explicit six-argument RPC and keeps old calls unchanged", async () => {
  const rpc = await vi.importActual<typeof import("../technical-configuration-rpc")>(
    "../technical-configuration-rpc"
  )
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
  vi.stubGlobal("fetch", fetchMock)
  await rpc.listTechnicalConfigurationDossiers({ p_specialty: null, p_filter_specialty: true })
  expect(JSON.parse(fetchMock.mock.lastCall?.[1].body)).toEqual({
    p_page: 1,
    p_page_size: 20,
    p_include_archived: false,
    p_search: null,
    p_filter_specialty: true,
    p_specialty: null,
  })
  await rpc.listTechnicalConfigurationDossiers({})
  expect(JSON.parse(fetchMock.mock.lastCall?.[1].body)).toEqual({})
  await rpc.listTechnicalConfigurationDossierSpecialties({ p_page: 2 })
  expect(fetchMock.mock.lastCall?.[0]).toBe("/api/rpc/technical_configuration_dossiers_specialties")
})
