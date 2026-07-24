import { act, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest"

import { TechnicalConfigurationOptionResponseEditor } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionResponseEditor"
import { TechnicalConfigurationSuppliers } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers"
import { useTechnicalConfigurationIdentityMutationState } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationIdentityMutationState"
import {
  technicalConfigurationDossierDetailQueryKey,
  technicalConfigurationOptionsQueryKey,
  technicalConfigurationSuppliersQueryKey,
} from "@/app/(app)/technical-configurations/technical-configuration-query-keys"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import { deferred } from "./technical-configuration-baseline-tab-fixtures"
import {
  dossier,
  option,
  optionsResponse,
  renderWithQueryClient,
  supplier,
  suppliersResponse,
  type SupplierOptionRpcMocks,
} from "./supplier-options-fixtures"
import {
  baselineVersion,
  comparisonSet,
  getRequest,
  jsonResponse,
  optionResponse,
  renderResponseHook,
} from "./supplier-option-response-cases"

type ResponseRecoveryTestMocks = {
  baselineRpc: { listVersions: Mock }
  fetchMock: Mock
  supplierOptionRpc: SupplierOptionRpcMocks
}

function conflictResponse() {
  return jsonResponse({ code: "PT409", message: "stale_revision" }, 409)
}

export function registerSupplierOptionResponseRecoveryTests({
  baselineRpc,
  fetchMock,
  supplierOptionRpc,
}: ResponseRecoveryTestMocks) {
  const originalScrollIntoView = Element.prototype.scrollIntoView

  beforeAll(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterAll(() => {
    if (originalScrollIntoView) {
      Object.defineProperty(Element.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView,
      })
      return
    }
    Reflect.deleteProperty(Element.prototype, "scrollIntoView")
  })

  beforeEach(() => {
    Object.values(supplierOptionRpc).forEach((mock) => mock.mockReset())
  })

  describe("technical configuration option response recovery", () => {
    it("upserts an existing set with its loaded revision and keeps conflict guidance visible", async () => {
      const baseline = baselineVersion({ revision: 7 })
      const existingSet = comparisonSet(
        baseline,
        [optionResponse(baseline, { response_text: "Đáp ứng cũ", revision: 7 })],
        7
      )
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: existingSet }))
        .mockResolvedValueOnce(conflictResponse())

      const { result } = renderResponseHook({
        baseline,
        dossierValue: { ...dossier, revision: 7 },
      })
      await waitFor(() => expect(result.current.responseQuery.isSuccess).toBe(true))
      act(() => result.current.updateDraft({ responseText: "Đáp ứng mới" }))

      await act(async () => result.current.save())

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(getRequest(fetchMock, 1)).toEqual({
        url: "/api/rpc/technical_configuration_option_response_upsert",
        body: {
          p_comparison_set_id: existingSet.id,
          p_criterion_id: baseline.groups[0]?.criteria[0]?.id,
          p_response_text: "Đáp ứng mới",
          p_supplementary_information: existingSet.responses[0]?.supplementary_information,
          p_expected_revision: 7,
        },
      })
      expect(result.current.isConflict).toBe(true)
      expect(result.current.operationError).toMatch(/Tải lại dữ liệu/)

      act(() => result.current.updateDraft({ supplementaryInformation: "Giữ hướng dẫn" }))
      expect(result.current.operationError).toMatch(/Tải lại dữ liệu/)
    })

    it("keeps an advanced dossier revision after a stale existing-set conflict", async () => {
      const baseline = baselineVersion({ revision: 7 })
      const existingSet = comparisonSet(
        baseline,
        [optionResponse(baseline, { response_text: "Đáp ứng cũ", revision: 7 })],
        7
      )
      const savedResponse = optionResponse(baseline, {
        response_text: "Đáp ứng mới",
        revision: 9,
      })
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: existingSet }))
        .mockResolvedValueOnce(conflictResponse())
        .mockResolvedValueOnce(jsonResponse({ data: existingSet }))
        .mockResolvedValueOnce(jsonResponse({ data: savedResponse }))

      const onRevisionChange = vi.fn()
      const { result, queryClient } = renderResponseHook({
        baseline,
        dossierValue: { ...dossier, revision: 8 },
        onRevisionChange,
      })
      await waitFor(() => expect(result.current.responseQuery.isSuccess).toBe(true))
      const detailQueryKey = technicalConfigurationDossierDetailQueryKey(dossier.id)
      queryClient.setQueryDefaults(detailQueryKey, { gcTime: Number.POSITIVE_INFINITY })
      queryClient.setQueryData(detailQueryKey, {
        data: { ...dossier, revision: 8 },
      })
      act(() => result.current.updateDraft({ responseText: savedResponse.response_text }))

      await act(async () => result.current.save())

      expect(
        queryClient.getQueryData<{ data: typeof dossier }>(detailQueryKey)?.data.revision
      ).toBe(8)
      expect(onRevisionChange).not.toHaveBeenCalledWith(7)

      await act(async () => result.current.reload())
      await act(async () => result.current.save())

      expect(getRequest(fetchMock, 3).body).toMatchObject({ p_expected_revision: 8 })
    })

    it("refreshes a null-set conflict revision and retries without losing the draft", async () => {
      const baseline = baselineVersion()
      const createdSet = comparisonSet(baseline, [], 9)
      const savedResponse = optionResponse(baseline, {
        response_text: "Giữ nội dung này",
        supplementary_information: "Giữ bổ sung này",
        revision: 10,
      })
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: null }))
        .mockResolvedValueOnce(conflictResponse())
        .mockResolvedValueOnce(jsonResponse({ data: null }))
        .mockResolvedValueOnce(jsonResponse({ data: { ...dossier, revision: 8 } }))
        .mockResolvedValueOnce(jsonResponse({ data: createdSet }))
        .mockResolvedValueOnce(jsonResponse({ data: savedResponse }))

      const { result } = renderResponseHook({ baseline })
      await waitFor(() => expect(result.current.responseQuery.isSuccess).toBe(true))
      act(() =>
        result.current.updateDraft({
          responseText: savedResponse.response_text,
          supplementaryInformation: savedResponse.supplementary_information,
        })
      )

      await act(async () => result.current.save())
      expect(result.current.isConflict).toBe(true)

      await act(async () => result.current.reload())
      expect(getRequest(fetchMock, 3)).toEqual({
        url: "/api/rpc/technical_configuration_dossiers_get",
        body: { p_id: dossier.id },
      })
      expect(result.current.draft.responseText).toBe(savedResponse.response_text)
      expect(result.current.isConflict).toBe(false)

      await act(async () => result.current.save())
      expect(getRequest(fetchMock, 4).body).toMatchObject({ p_expected_revision: 8 })
      expect(getRequest(fetchMock, 5).body).toMatchObject({ p_expected_revision: 9 })
      expect(result.current.isDirty).toBe(false)
    })

    it("adopts refreshed server text when reload starts from a clean editor", async () => {
      const baseline = baselineVersion({ revision: 4 })
      const originalSet = comparisonSet(
        baseline,
        [optionResponse(baseline, { response_text: "Bản cũ", revision: 4 })],
        4
      )
      const refreshedSet = comparisonSet(
        baseline,
        [optionResponse(baseline, { response_text: "Bản mới", revision: 5 })],
        5
      )
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: originalSet }))
        .mockResolvedValueOnce(jsonResponse({ data: refreshedSet }))

      const { result } = renderResponseHook({
        baseline,
        dossierValue: { ...dossier, revision: 4 },
      })
      await waitFor(() => expect(result.current.draft.responseText).toBe("Bản cũ"))

      await act(async () => result.current.reload())

      expect(result.current.draft.responseText).toBe("Bản mới")
      expect(result.current.isDirty).toBe(false)
    })

    it("adopts server text when retrying an initial read error", async () => {
      const baseline = baselineVersion()
      const refreshedSet = comparisonSet(baseline, [
        optionResponse(baseline, { response_text: "Đã phục hồi" }),
      ])
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ message: "read_failed" }, 500))
        .mockResolvedValueOnce(jsonResponse({ data: refreshedSet }))

      const { result } = renderResponseHook({ baseline })
      await waitFor(() => expect(result.current.responseQuery.isError).toBe(true))

      await act(async () => result.current.reload())

      expect(result.current.draft.responseText).toBe("Đã phục hồi")
      expect(result.current.isDirty).toBe(false)
    })

    it("keeps the existing editor and dirty draft visible when reload fails", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      const persistedResponse = optionResponse(baseline, { response_text: "Nội dung đã lưu" })
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: comparisonSet(baseline, [persistedResponse]) }))
        .mockResolvedValueOnce(jsonResponse({ message: "read_failed" }, 500))

      renderWithQueryClient(
        <TechnicalConfigurationOptionResponseEditor
          dossier={dossier}
          option={option({ id: "option-1" })}
          baselineVersion={baseline}
          requestDiscardConfirmation={(_description, action) => action()}
        />
      )
      const responseInput = await screen.findByLabelText("Phản hồi tiêu chí")
      await waitFor(() => expect(responseInput).toHaveValue("Nội dung đã lưu"))
      await user.clear(responseInput)
      await user.type(responseInput, "Bản nháp cục bộ")

      await user.click(screen.getByRole("button", { name: "Tải lại dữ liệu" }))

      expect((await screen.findAllByText("read_failed")).length).toBeGreaterThan(0)
      expect(screen.getByLabelText("Phản hồi tiêu chí")).toHaveValue("Bản nháp cục bộ")
    })

    it("shows persisted response text and clears dirty state when the dossier becomes archived", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      const currentOption = option({ id: "option-1" })
      const persistedResponse = optionResponse(baseline, { response_text: "Nội dung đã lưu" })
      const onDirtyChange = vi.fn()
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: comparisonSet(baseline, [persistedResponse]) })
      )
      const editor = (dossierValue: typeof dossier): React.ReactElement => (
        <TechnicalConfigurationOptionResponseEditor
          dossier={dossierValue}
          option={currentOption}
          baselineVersion={baseline}
          onDirtyChange={onDirtyChange}
          requestDiscardConfirmation={(_description, action) => action()}
        />
      )
      const { rerender } = renderWithQueryClient(editor(dossier))
      const responseInput = await screen.findByLabelText("Phản hồi tiêu chí")
      await waitFor(() => expect(responseInput).toHaveValue("Nội dung đã lưu"))
      await user.clear(responseInput)
      await user.type(responseInput, "Bản nháp chưa lưu")
      await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))

      rerender(
        editor({
          ...dossier,
          archived_at: "2026-07-24T00:00:00.000Z",
          archived_by: 1,
        })
      )

      expect(screen.getByLabelText("Phản hồi tiêu chí")).toBeDisabled()
      expect(screen.getByLabelText("Phản hồi tiêu chí")).toHaveValue("Nội dung đã lưu")
      await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false))
    })

    it("updates the dossier detail cache after a successful response save", async () => {
      const baseline = baselineVersion()
      const createdSet = comparisonSet(baseline, [], 4)
      const savedResponse = optionResponse(baseline, { response_text: "Đã lưu", revision: 5 })
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: null }))
        .mockResolvedValueOnce(jsonResponse({ data: createdSet }))
        .mockResolvedValueOnce(jsonResponse({ data: savedResponse }))

      const { result, queryClient } = renderResponseHook({ baseline })
      await waitFor(() => expect(result.current.responseQuery.isSuccess).toBe(true))
      const detailQueryKey = technicalConfigurationDossierDetailQueryKey(dossier.id)
      queryClient.setQueryDefaults(detailQueryKey, { gcTime: Number.POSITIVE_INFINITY })
      queryClient.setQueryData(detailQueryKey, {
        data: dossier,
      })
      act(() => result.current.updateDraft({ responseText: savedResponse.response_text }))

      await act(async () => result.current.save())

      expect(
        queryClient.getQueryData<{ data: typeof dossier }>(detailQueryKey)?.data.revision
      ).toBe(5)
    })

    it("tracks a newer workspace revision for later identity mutations", async () => {
      const queryClient = createTestQueryClient()
      const { result, rerender } = renderHook(
        ({ revision }: { revision: number }) =>
          useTechnicalConfigurationIdentityMutationState({
            dossier: { ...dossier, revision },
            supplierQueryKey: technicalConfigurationSuppliersQueryKey(dossier.id),
            optionQueryKey: technicalConfigurationOptionsQueryKey(dossier.id),
          }),
        {
          initialProps: { revision: dossier.revision },
          wrapper: createReactQueryWrapper(queryClient),
        }
      )

      rerender({ revision: 8 })

      await waitFor(() => expect(result.current.revisionRef.current).toBe(8))
    })

    it("blocks navigation for the full response save window", async () => {
      const baseline = baselineVersion()
      const createdSet = comparisonSet(baseline, [], 4)
      const savedResponse = optionResponse(baseline, { response_text: "Đang lưu", revision: 5 })
      const createRequest = deferred<Response>()
      const onNavigationBlockedChange = vi.fn()
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: null }))
        .mockImplementationOnce(() => createRequest.promise)
        .mockResolvedValueOnce(jsonResponse({ data: savedResponse }))

      const { result } = renderResponseHook({ baseline, onNavigationBlockedChange })
      await waitFor(() => expect(result.current.responseQuery.isSuccess).toBe(true))
      act(() => result.current.updateDraft({ responseText: savedResponse.response_text }))

      let savePromise: Promise<void> | undefined
      act(() => {
        savePromise = result.current.save()
      })
      await waitFor(() => expect(onNavigationBlockedChange).toHaveBeenLastCalledWith(true))

      createRequest.resolve(jsonResponse({ data: createdSet }))
      await act(async () => savePromise)

      expect(onNavigationBlockedChange).toHaveBeenLastCalledWith(false)
    })

    it("switches option and baseline with read-only calls and responsive navigation", async () => {
      const user = userEvent.setup()
      const firstBaseline = baselineVersion()
      const secondBaseline = baselineVersion({ id: "baseline-2", version_number: 2 })
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const firstOption = option({ id: "option-1", model: "Model A" })
      const secondOption = option({ id: "option-2", model: "Model B" })
      baselineRpc.listVersions.mockResolvedValue({
        data: [firstBaseline, secondBaseline],
        total: 2,
        page: 1,
        page_size: 100,
      })
      supplierOptionRpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      supplierOptionRpc.listOptions.mockResolvedValue(optionsResponse([firstOption, secondOption]))
      fetchMock.mockResolvedValue(jsonResponse({ data: null }))

      renderWithQueryClient(<TechnicalConfigurationSuppliers dossier={dossier} />)
      expect(await screen.findByTestId("option-response-workspace")).toHaveClass(
        "grid",
        "min-w-0",
        "lg:grid-cols-[minmax(12rem,0.45fr)_minmax(0,1fr)]"
      )
      expect(
        screen.getByRole("navigation", { name: "Tiêu chí cấu hình cơ sở" }).querySelector("div")
      ).toHaveClass("overflow-x-auto", "lg:flex-col", "lg:overflow-visible")

      await user.click(screen.getByRole("button", { name: secondOption.display_label }))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

      act(() => screen.getByLabelText("Phiên bản cấu hình cơ sở").focus())
      await user.keyboard("{ArrowDown}")
      await user.click(await screen.findByRole("option", { name: /Phiên bản 1/ }))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

      expect(fetchMock.mock.calls.map((_, index) => getRequest(fetchMock, index).url)).toEqual([
        "/api/rpc/technical_configuration_comparison_set_get",
        "/api/rpc/technical_configuration_comparison_set_get",
        "/api/rpc/technical_configuration_comparison_set_get",
      ])
      expect(getRequest(fetchMock, 2).body).toEqual({
        p_option_id: secondOption.id,
        p_baseline_version_id: firstBaseline.id,
      })
    })
  })
}
