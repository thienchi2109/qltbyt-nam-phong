import { act, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
  technicalConfigurationDossierDetailQueryKey,
} from "../technical-configuration-query-keys"
import type {
  TechnicalConfigurationDossierDeleteRpcArgs,
  TechnicalConfigurationDossierDeleteWireResponse,
  TechnicalConfigurationDossierListItemWire,
  TechnicalConfigurationDossierListWireResponse,
} from "../types"
import {
  createQueryClient,
  dossier,
  listQueryKey,
  renderDossierActions,
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

describe("technical configuration dossier delete action cache", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("removes a confirmed dossier from list, detail and selected state after server success", async () => {
    const retainedDossier: TechnicalConfigurationDossierListItemWire = {
      ...dossier,
      id: "dossier-2",
      name: "Cấu hình máy X-quang",
      can_delete: false,
    }
    const deleteArgs: TechnicalConfigurationDossierDeleteRpcArgs = {
      p_id: dossier.id,
      p_expected_revision: dossier.revision,
    }
    const queryClient = createQueryClient()
    queryClient.setQueryData(listQueryKey, {
      data: [dossier, retainedDossier],
      total: 2,
      page: 1,
      page_size: 20,
    })
    queryClient.setQueryData(technicalConfigurationDossierDetailQueryKey(dossier.id), {
      data: dossier,
    })
    mocks.deleteDossier.mockResolvedValue({ data: { id: dossier.id } })

    const { result } = await renderDossierActions(queryClient)

    act(() => {
      result.current.actions.openDelete(dossier)
    })
    await act(async () => {
      await result.current.actions.submitDelete()
    })

    expect(mocks.deleteDossier).toHaveBeenCalledWith(deleteArgs)
    expect(
      queryClient.getQueryData<TechnicalConfigurationDossierListWireResponse>(listQueryKey)
    ).toMatchObject({
      data: [{ id: retainedDossier.id }],
      total: 1,
    })
    expect(
      queryClient.getQueryData(technicalConfigurationDossierDetailQueryKey(dossier.id))
    ).toBeUndefined()
    expect(result.current.selectedDossier).toBeNull()
    expect(result.current.actions.deleteTarget).toBeNull()
  })

  it("moves to the previous page when deleting the only row on a non-first page", async () => {
    const pageTwoQueryKey = [
      ...TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
      { page: 2, pageSize: 20 },
    ] as const
    const onPageChange = vi.fn()
    const queryClient = createQueryClient()
    queryClient.setQueryData(pageTwoQueryKey, {
      data: [dossier],
      total: 21,
      page: 2,
      page_size: 20,
    })
    mocks.deleteDossier.mockResolvedValue({ data: { id: dossier.id } })

    const { result } = await renderDossierActions(queryClient, {
      listQueryKey: pageTwoQueryKey,
      page: 2,
      onPageChange,
    })

    act(() => {
      result.current.actions.openDelete(dossier)
    })
    await act(async () => {
      await result.current.actions.submitDelete()
    })

    expect(onPageChange).toHaveBeenCalledWith(1)
    expect(
      queryClient.getQueryData<TechnicalConfigurationDossierListWireResponse>(pageTwoQueryKey)
    ).toMatchObject({
      data: [],
      total: 20,
    })
  })

  it("blocks duplicate same-tick delete submissions before pending state rerenders", async () => {
    let resolveDelete:
      ((response: TechnicalConfigurationDossierDeleteWireResponse) => void) | undefined
    const deletePromise = new Promise<TechnicalConfigurationDossierDeleteWireResponse>(
      (resolve) => {
        resolveDelete = resolve
      }
    )
    const queryClient = createQueryClient()
    queryClient.setQueryData(listQueryKey, {
      data: [dossier],
      total: 1,
      page: 1,
      page_size: 20,
    })
    mocks.deleteDossier.mockReturnValue(deletePromise)

    const { result } = await renderDossierActions(queryClient)

    act(() => {
      result.current.actions.openDelete(dossier)
    })
    await waitFor(() => {
      expect(result.current.actions.deleteTarget).toEqual(dossier)
    })

    let firstSubmission: Promise<void> | undefined
    let secondSubmission: Promise<void> | undefined
    act(() => {
      firstSubmission = result.current.actions.submitDelete()
      secondSubmission = result.current.actions.submitDelete()
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(mocks.deleteDossier).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveDelete?.({ data: { id: dossier.id } })
      await Promise.all([firstSubmission, secondSubmission])
    })
  })

  it("reconciles authoritative cache state after the action owner unmounts", async () => {
    let resolveDelete:
      ((response: TechnicalConfigurationDossierDeleteWireResponse) => void) | undefined
    const queryClient = createQueryClient()
    queryClient.setQueryData(listQueryKey, {
      data: [dossier],
      total: 1,
      page: 1,
      page_size: 20,
    })
    queryClient.setQueryData(technicalConfigurationDossierDetailQueryKey(dossier.id), {
      data: dossier,
    })
    mocks.deleteDossier.mockReturnValue(
      new Promise<TechnicalConfigurationDossierDeleteWireResponse>((resolve) => {
        resolveDelete = resolve
      })
    )

    const { result, unmount } = await renderDossierActions(queryClient)

    act(() => {
      result.current.actions.openDelete(dossier)
    })
    await waitFor(() => {
      expect(result.current.actions.deleteTarget).toEqual(dossier)
    })
    const submission = result.current.actions.submitDelete()
    await waitFor(() => {
      expect(mocks.deleteDossier).toHaveBeenCalledTimes(1)
    })

    unmount()
    resolveDelete?.({ data: { id: dossier.id } })
    await submission

    expect(
      queryClient.getQueryData<TechnicalConfigurationDossierListWireResponse>(listQueryKey)
    ).toMatchObject({
      data: [],
      total: 0,
    })
    expect(
      queryClient.getQueryData(technicalConfigurationDossierDetailQueryKey(dossier.id))
    ).toBeUndefined()
  })

  it("leaves cache, workspace and page unchanged when delete fails", async () => {
    const onPageChange = vi.fn()
    const queryClient = createQueryClient()
    queryClient.setQueryData(listQueryKey, {
      data: [dossier],
      total: 1,
      page: 1,
      page_size: 20,
    })
    queryClient.setQueryData(technicalConfigurationDossierDetailQueryKey(dossier.id), {
      data: dossier,
    })
    mocks.deleteDossier.mockRejectedValueOnce(new Error("locked_dossier"))

    const { result } = await renderDossierActions(queryClient, { onPageChange })

    act(() => {
      result.current.actions.openDelete(dossier)
    })
    await act(async () => {
      await result.current.actions.submitDelete().catch(() => undefined)
    })

    expect(
      queryClient.getQueryData<TechnicalConfigurationDossierListWireResponse>(listQueryKey)
    ).toMatchObject({
      data: [{ id: dossier.id }],
      total: 1,
    })
    expect(
      queryClient.getQueryData(technicalConfigurationDossierDetailQueryKey(dossier.id))
    ).toEqual({ data: dossier })
    expect(result.current.selectedDossier).toEqual(dossier)
    expect(result.current.actions.deleteTarget).toEqual(dossier)
    await waitFor(() => {
      expect(result.current.actions.deleteError).toMatchObject({ message: "locked_dossier" })
    })
    expect(onPageChange).not.toHaveBeenCalled()
  })
})
