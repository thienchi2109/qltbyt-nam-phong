import * as React from "react"
import { QueryClientProvider, type QueryKey } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useTechnicalConfigurationDossierActions } from "../_hooks/useTechnicalConfigurationDossierActions"
import { technicalConfigurationDossierListQueryKey } from "../technical-configuration-query-keys"
import type {
  TechnicalConfigurationDossierListWireResponse,
  TechnicalConfigurationDossierUpdateRpcArgs,
  TechnicalConfigurationDossierWire,
} from "../types"
import {
  buildDossierListPage,
  createQueryClient,
  dossier,
} from "./technical-configuration-dossier-actions-test-harness"

const mocks = vi.hoisted(() => ({
  deleteDossier: vi.fn(),
  getDossier: vi.fn(),
  updateDossier: vi.fn(),
}))

vi.mock("../technical-configuration-rpc", () => ({
  deleteTechnicalConfigurationDossier: (...args: unknown[]) => mocks.deleteDossier(...args),
  getTechnicalConfigurationDossier: (...args: unknown[]) => mocks.getDossier(...args),
  updateTechnicalConfigurationDossier: (...args: unknown[]) => mocks.updateDossier(...args),
}))

type HookProps = {
  listQueryKey: QueryKey
  page: number
}

function renderActions(
  queryClient: ReturnType<typeof createQueryClient>,
  initialProps: HookProps,
  onPageChange = vi.fn()
) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return {
    onPageChange,
    ...renderHook(
      ({ listQueryKey, page }: HookProps) =>
        useTechnicalConfigurationDossierActions({
          listQueryKey,
          page,
          onPageChange,
          onSelectedDossierChange: vi.fn(),
        }),
      { initialProps, wrapper }
    ),
  }
}

describe("technical configuration dossier mutation origin", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("merges a pending edit into the cache from which the action originated", async () => {
    const queryClient = createQueryClient()
    const originKey = technicalConfigurationDossierListQueryKey({
      page: 1,
      pageSize: 20,
      normalizedSearch: "",
    })
    const replacementKey = technicalConfigurationDossierListQueryKey({
      page: 1,
      pageSize: 20,
      normalizedSearch: "may",
    })
    const replacementRow = { ...dossier, name: "Kết quả tìm kiếm" }
    const updatedDossier = { ...dossier, name: "Tên đã sửa", revision: 8 }
    let resolveUpdate: ((response: { data: TechnicalConfigurationDossierWire }) => void) | undefined

    queryClient.setQueryData<TechnicalConfigurationDossierListWireResponse>(
      originKey,
      buildDossierListPage({ p_page: 1, p_page_size: 20, p_include_archived: false }, [dossier], 1)
    )
    queryClient.setQueryData<TechnicalConfigurationDossierListWireResponse>(
      replacementKey,
      buildDossierListPage(
        { p_page: 1, p_page_size: 20, p_include_archived: false, p_search: "may" },
        [replacementRow],
        1
      )
    )
    mocks.updateDossier.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve
        })
    )

    const { result, rerender } = renderActions(queryClient, {
      listQueryKey: originKey,
      page: 1,
    })
    act(() => {
      result.current.openEdit(dossier)
    })

    let submission: Promise<void> | undefined
    act(() => {
      submission = result.current.submitEdit({
        p_id: dossier.id,
        p_device_type_name: dossier.device_type_name,
        p_name: updatedDossier.name,
        p_description: dossier.description,
        p_expected_revision: dossier.revision,
      })
    })
    await act(async () => {
      await Promise.resolve()
    })
    rerender({ listQueryKey: replacementKey, page: 1 })

    const completeUpdate = resolveUpdate
    if (!completeUpdate || !submission) {
      throw new Error("expected a pending dossier update")
    }
    await act(async () => {
      completeUpdate({ data: updatedDossier })
      await submission
    })

    expect(
      queryClient.getQueryData<TechnicalConfigurationDossierListWireResponse>(originKey)?.data[0]
        ?.name
    ).toBe(updatedDossier.name)
    expect(
      queryClient.getQueryData<TechnicalConfigurationDossierListWireResponse>(replacementKey)
        ?.data[0]?.name
    ).toBe(replacementRow.name)
  })

  it("uses the opened row cache and page when delete is submitted after a rerender", async () => {
    const queryClient = createQueryClient()
    const originKey = technicalConfigurationDossierListQueryKey({
      page: 2,
      pageSize: 20,
      normalizedSearch: "",
    })
    const replacementKey = technicalConfigurationDossierListQueryKey({
      page: 1,
      pageSize: 20,
      normalizedSearch: "may",
    })
    const replacementRow = { ...dossier, name: "Kết quả tìm kiếm" }
    let resolveDelete: ((response: { data: { id: string } }) => void) | undefined

    queryClient.setQueryData<TechnicalConfigurationDossierListWireResponse>(
      originKey,
      buildDossierListPage({ p_page: 2, p_page_size: 20, p_include_archived: false }, [dossier], 21)
    )
    queryClient.setQueryData<TechnicalConfigurationDossierListWireResponse>(
      replacementKey,
      buildDossierListPage(
        { p_page: 1, p_page_size: 20, p_include_archived: false, p_search: "may" },
        [replacementRow],
        1
      )
    )
    mocks.deleteDossier.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve
        })
    )

    const { result, rerender, onPageChange } = renderActions(queryClient, {
      listQueryKey: originKey,
      page: 2,
    })
    act(() => {
      result.current.openDelete(dossier)
    })
    rerender({ listQueryKey: replacementKey, page: 1 })

    let submission: Promise<void> | undefined
    act(() => {
      submission = result.current.submitDelete()
    })
    await act(async () => {
      await Promise.resolve()
    })

    const completeDelete = resolveDelete
    if (!completeDelete || !submission) {
      throw new Error("expected a pending dossier delete")
    }
    await act(async () => {
      completeDelete({ data: { id: dossier.id } })
      await submission
    })

    expect(
      queryClient.getQueryData<TechnicalConfigurationDossierListWireResponse>(originKey)
    ).toMatchObject({
      data: [],
      total: 20,
    })
    expect(
      queryClient.getQueryData<TechnicalConfigurationDossierListWireResponse>(replacementKey)
    ).toMatchObject({
      data: [replacementRow],
      total: 1,
    })
    expect(onPageChange).toHaveBeenCalledWith(1)
  })
})
