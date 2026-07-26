import { QueryObserver } from "@tanstack/react-query"
import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import {
  technicalConfigurationDossierDetailQueryKey,
  technicalConfigurationOptionResponsesQueryKey,
} from "@/app/(app)/technical-configurations/technical-configuration-query-keys"
import type { TechnicalConfigurationOptionImportPreviewWireResponse } from "@/app/(app)/technical-configurations/supplier-option-types"
import type { TechnicalConfigurationDossierWireResponse } from "@/app/(app)/technical-configurations/types"

import {
  confirmOptionImport,
  mockParsedWorkbook,
  persistedImportResponse,
  renderImportResponses,
  setImportBaselineVersion,
  toWorkbookRows,
  uploadOptionWorkbook,
  workbookPayload,
  type SupplierOptionImportTestMocks,
} from "./supplier-option-import-fixtures"
import {
  baselineVersion,
  comparisonSet,
  getRequest,
  jsonResponse,
  optionResponse,
} from "./supplier-option-response-cases"
import { dossier, option, optionsResponse, suppliersResponse } from "./supplier-options-fixtures"
import { deferred } from "./technical-configuration-baseline-tab-fixtures"

export function registerSupplierOptionImportWorkspaceTests(mocks: SupplierOptionImportTestMocks) {
  const { fetchMock, supplierOptionRpc, workbookCodec } = mocks

  describe("technical configuration supplier option import workspace", () => {
    beforeEach(() => {
      Object.values(supplierOptionRpc).forEach((mock) => mock.mockReset())
      workbookCodec.readWorkbook.mockReset()
      workbookCodec.createParser.mockReset()
      workbookCodec.createWorkbook.mockReset()
      workbookCodec.downloadBlob.mockReset()

      supplierOptionRpc.listSuppliers.mockResolvedValue(suppliersResponse([]))
      supplierOptionRpc.listOptions.mockResolvedValue(optionsResponse([]))
      workbookCodec.readWorkbook.mockResolvedValue({})
      workbookCodec.createWorkbook.mockResolvedValue({
        xlsx: {
          writeBuffer: async () => new Uint8Array([1, 2, 3]),
        },
      })
    })

    it("downloads the exact locked-baseline template through the P9A1 codec", async () => {
      const user = userEvent.setup()
      const baseline = setImportBaselineVersion(
        mocks.baselineRpc,
        baselineVersion({ status: "locked", revision: 5 })
      )
      const currentOption = option({ id: "option-1", revision: 5 })
      const persisted = persistedImportResponse(baseline, 5)
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: comparisonSet(baseline, [persisted], 5) })
      )

      renderImportResponses({
        mocks,
        baseline,
        currentOption,
        dossierValue: { ...dossier, revision: 5 },
      })
      await screen.findByLabelText("Phản hồi tiêu chí")
      await user.click(screen.getByRole("button", { name: "Tải template phản hồi" }))

      expect(workbookCodec.createWorkbook).toHaveBeenCalledWith({
        metadata: expect.objectContaining({
          dossier_id: dossier.id,
          option_id: currentOption.id,
          baseline_version_id: baseline.id,
          dossier_revision: 5,
        }),
        rows: toWorkbookRows(baseline, {
          [persisted.criterion_id]: {
            response_text: persisted.response_text,
            supplementary_information: persisted.supplementary_information,
          },
        }),
      })
      expect(workbookCodec.downloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        "Mau_Phan_Hoi_Phuong_An_Phien_Ban_1.xlsx"
      )
    })

    it("previews without mutation, confirms once, clears blanks, and adopts caches", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      const currentOption = option({ id: "option-1" })
      const persisted = persistedImportResponse(baseline)
      const rows = toWorkbookRows(baseline, {
        [persisted.criterion_id]: {
          response_text: "Phản hồi import",
          supplementary_information: "",
        },
      })
      const payload = workbookPayload({ baseline, currentOption, rows })
      const preview: TechnicalConfigurationOptionImportPreviewWireResponse = {
        data: payload,
        errors: [],
      }
      const applied = comparisonSet(
        baseline,
        [
          optionResponse(baseline, {
            response_text: "Phản hồi import",
            supplementary_information: "",
            revision: 4,
          }),
        ],
        4
      )
      mockParsedWorkbook(workbookCodec, payload)
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({ data: comparisonSet(baseline, [persisted], dossier.revision) })
        )
        .mockResolvedValueOnce(jsonResponse(preview))
        .mockResolvedValueOnce(jsonResponse({ data: applied }))

      const rendered = renderImportResponses({ mocks, baseline, currentOption })
      const detailQueryKey = technicalConfigurationDossierDetailQueryKey(dossier.id)
      rendered.queryClient.setQueryData<TechnicalConfigurationDossierWireResponse>(detailQueryKey, {
        data: dossier,
      })
      const detailObserver = new QueryObserver(rendered.queryClient, {
        queryKey: detailQueryKey,
        enabled: false,
      })
      const unsubscribeDetailObserver = detailObserver.subscribe(() => undefined)
      await screen.findByDisplayValue("Thông tin bổ sung cũ")
      await uploadOptionWorkbook(user)
      await screen.findByText("option.xlsx")

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(screen.getByText("Xóa phản hồi đã lưu")).toBeInTheDocument()
      expect(screen.getAllByText("Xóa thông tin bổ sung")).toHaveLength(2)
      expect(String(getRequest(fetchMock, 1).url)).toContain(
        "technical_configuration_option_import_preview"
      )
      expect(getRequest(fetchMock, 1).body.p_rows).toEqual(rows)

      await user.click(screen.getByRole("button", { name: /Nhập 2 dòng/ }))
      expect(fetchMock).toHaveBeenCalledTimes(2)
      await confirmOptionImport(user)

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
      expect(String(getRequest(fetchMock, 2).url)).toContain(
        "technical_configuration_option_import_apply"
      )
      await waitFor(() =>
        expect(screen.getByLabelText("Phản hồi tiêu chí")).toHaveValue("Phản hồi import")
      )
      expect(screen.getByLabelText("Thông tin bổ sung")).toHaveValue("")
      expect(rendered.onRevisionChange).toHaveBeenCalledWith(4)
      expect(
        rendered.queryClient.getQueryData(
          technicalConfigurationOptionResponsesQueryKey(currentOption.id, baseline.id)
        )
      ).toEqual(applied)
      expect(
        rendered.queryClient.getQueryData<TechnicalConfigurationDossierWireResponse>(detailQueryKey)
          ?.data.revision
      ).toBe(4)
      unsubscribeDetailObserver()
    })

    it("keeps imported response and dossier caches newer than in-flight refetches", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      const currentOption = option({ id: "option-1" })
      const persisted = persistedImportResponse(baseline)
      const existingSet = comparisonSet(baseline, [persisted], dossier.revision)
      const payload = workbookPayload({ baseline, currentOption })
      const applied = comparisonSet(
        baseline,
        [
          optionResponse(baseline, {
            response_text: "Phản hồi import mới",
            revision: 4,
          }),
        ],
        4
      )
      const staleResponseRequest = deferred<Response>()
      const staleDetailRequest = deferred<TechnicalConfigurationDossierWireResponse>()
      mockParsedWorkbook(workbookCodec, payload)
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: existingSet }))
        .mockImplementationOnce(() => staleResponseRequest.promise)
        .mockResolvedValueOnce(jsonResponse({ data: payload, errors: [] }))
        .mockResolvedValueOnce(jsonResponse({ data: applied }))

      const rendered = renderImportResponses({ mocks, baseline, currentOption })
      const responseInput = await screen.findByLabelText("Phản hồi tiêu chí")
      const responseQueryKey = technicalConfigurationOptionResponsesQueryKey(
        currentOption.id,
        baseline.id
      )
      const detailQueryKey = technicalConfigurationDossierDetailQueryKey(dossier.id)
      rendered.queryClient.setQueryData<TechnicalConfigurationDossierWireResponse>(detailQueryKey, {
        data: dossier,
      })
      const detailObserver = new QueryObserver(rendered.queryClient, {
        queryKey: detailQueryKey,
        enabled: false,
      })
      const unsubscribeDetailObserver = detailObserver.subscribe(() => undefined)
      const responseRefetch = rendered.queryClient.refetchQueries({
        queryKey: responseQueryKey,
        exact: true,
      })
      const detailRefetch = rendered.queryClient
        .fetchQuery({
          queryKey: detailQueryKey,
          queryFn: () => staleDetailRequest.promise,
          staleTime: 0,
        })
        .catch(() => undefined)
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

      await uploadOptionWorkbook(user)
      await confirmOptionImport(user)
      await waitFor(() => expect(responseInput).toHaveValue("Phản hồi import mới"))

      await act(async () => {
        staleResponseRequest.resolve(jsonResponse({ data: existingSet }))
        staleDetailRequest.resolve({ data: dossier })
        await Promise.all([responseRefetch, detailRefetch])
      })

      expect(rendered.queryClient.getQueryData(responseQueryKey)).toEqual(applied)
      expect(
        rendered.queryClient.getQueryData<TechnicalConfigurationDossierWireResponse>(detailQueryKey)
          ?.data.revision
      ).toBe(4)
      expect(responseInput).toHaveValue("Phản hồi import mới")
      unsubscribeDetailObserver()
    })

    it("rejects a lower-revision response cache publication after import", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      const currentOption = option({ id: "option-1" })
      const existingSet = comparisonSet(
        baseline,
        [persistedImportResponse(baseline)],
        dossier.revision
      )
      const payload = workbookPayload({ baseline, currentOption })
      const applied = comparisonSet(
        baseline,
        [
          optionResponse(baseline, {
            response_text: "Phản hồi import mới",
            revision: 4,
          }),
        ],
        4
      )
      mockParsedWorkbook(workbookCodec, payload)
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: existingSet }))
        .mockResolvedValueOnce(jsonResponse({ data: payload, errors: [] }))
        .mockResolvedValueOnce(jsonResponse({ data: applied }))

      const rendered = renderImportResponses({ mocks, baseline, currentOption })
      const responseInput = await screen.findByLabelText("Phản hồi tiêu chí")
      const responseQueryKey = technicalConfigurationOptionResponsesQueryKey(
        currentOption.id,
        baseline.id
      )
      await uploadOptionWorkbook(user)
      await confirmOptionImport(user)
      await waitFor(() => expect(responseInput).toHaveValue("Phản hồi import mới"))

      act(() => {
        rendered.queryClient.setQueryData(responseQueryKey, existingSet)
      })

      await waitFor(() =>
        expect(rendered.queryClient.getQueryData(responseQueryKey)).toEqual(applied)
      )
      expect(responseInput).toHaveValue("Phản hồi import mới")
    })

    it("shows parser missing-row errors without previewing or applying", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      const currentOption = option({ id: "option-1" })
      workbookCodec.createParser.mockReturnValue(async () => {
        throw new Error("Thiếu dòng tiêu chí TC-0002.")
      })
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: null }))

      renderImportResponses({ mocks, baseline, currentOption })
      await screen.findByLabelText("Phản hồi tiêu chí")
      await uploadOptionWorkbook(user, "missing-row.xlsx")

      expect(
        await screen.findByText(/Da co loi xay ra khi doc file: Thiếu dòng tiêu chí TC-0002\./)
      ).toBeInTheDocument()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(
        screen.queryByRole("alertdialog", { name: "Xác nhận ghi đè phản hồi phương án" })
      ).not.toBeInTheDocument()
    })

    it("keeps download and import read-only for archived dossiers", async () => {
      const baseline = baselineVersion({ status: "locked" })
      const currentOption = option({ id: "option-1" })
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: comparisonSet(baseline) }))

      renderImportResponses({
        mocks,
        baseline,
        currentOption,
        dossierValue: {
          ...dossier,
          archived_at: "2026-07-25T00:00:00.000Z",
          archived_by: 9,
        },
      })

      expect(await screen.findByLabelText("Phản hồi tiêu chí")).toBeDisabled()
      expect(screen.getByRole("button", { name: "Tải template phản hồi" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Nhập phản hồi từ Excel" })).toBeDisabled()
    })
  })
}
