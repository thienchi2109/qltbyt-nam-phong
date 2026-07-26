import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, type Mock } from "vitest"

import { TechnicalConfigurationOptionDocuments } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionDocuments"
import type {
  TechnicalConfigurationOptionDocumentWire,
  TechnicalConfigurationOptionDocumentsListWireResponse,
} from "@/app/(app)/technical-configurations/document-types"
import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"

import { baselineVersion, comparisonSet } from "./supplier-option-response-cases"
import { dossier, option } from "./supplier-options-fixtures"

type OptionEvidenceRpcMocks = {
  listDocuments: Mock
  createDocument: Mock
  updateDocument: Mock
  deleteDocument: Mock
  upsertCitation: Mock
  deleteCitation: Mock
  getOrCreateComparisonSet: Mock
  fetchDossierRevision: Mock
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const currentOption = option({ id: "option-1" })

function optionDocument({
  id = "document-1",
  citations = [],
  affectedCitationCount = citations.length,
}: {
  id?: string
  citations?: TechnicalConfigurationOptionDocumentWire["citations"]
  affectedCitationCount?: number
} = {}): TechnicalConfigurationOptionDocumentWire {
  return {
    id,
    option_id: currentOption.id,
    name: `Tài liệu ${id}`,
    url: `https://example.com/${id}.pdf`,
    created_by: 1,
    created_at: "2026-07-26T00:00:00.000Z",
    updated_at: "2026-07-26T00:00:00.000Z",
    affected_citation_count: affectedCitationCount,
    citations,
  }
}

function documentsResponse(
  data: TechnicalConfigurationOptionDocumentWire[]
): TechnicalConfigurationOptionDocumentsListWireResponse {
  return {
    data,
    total: data.length,
    page: 1,
    page_size: 100,
  }
}

function renderOptionEvidence({
  baseline = baselineVersion(),
  dossierValue = dossier,
}: {
  baseline?: ReturnType<typeof baselineVersion>
  dossierValue?: typeof dossier
} = {}) {
  const queryClient = createTestQueryClient()
  return render(
    <TechnicalConfigurationOptionDocuments
      dossier={dossierValue}
      option={currentOption}
      baselineVersion={baseline}
      criterionId={baseline.groups[0]?.criteria[0]?.id}
    />,
    { wrapper: createReactQueryWrapper(queryClient) }
  )
}

export function registerOptionEvidenceWorkspaceTests(rpc: OptionEvidenceRpcMocks) {
  describe("TechnicalConfigurationOptionDocuments behavior", () => {
    beforeEach(() => {
      Object.defineProperty(globalThis, "ResizeObserver", {
        configurable: true,
        value: ResizeObserverMock,
      })
      Object.values(rpc).forEach((mock) => mock.mockReset())
      rpc.listDocuments.mockResolvedValue(documentsResponse([]))
    })

    it("reuses one option document across baseline selections while rendering exact citations", async () => {
      const firstBaseline = baselineVersion({ id: "baseline-1", version_number: 1 })
      const secondBaseline = baselineVersion({ id: "baseline-2", version_number: 2 })
      const firstCriterionId = firstBaseline.groups[0]?.criteria[0]?.id ?? ""
      const secondCriterionId = secondBaseline.groups[0]?.criteria[0]?.id ?? ""
      const firstDocument = optionDocument({
        citations: [
          {
            id: "citation-baseline-1",
            criterion_id: firstCriterionId,
            page_section: "Trang 1",
            excerpt: "Bằng chứng baseline 1",
          },
        ],
        affectedCitationCount: 2,
      })
      const secondDocument = optionDocument({
        citations: [
          {
            id: "citation-baseline-2",
            criterion_id: secondCriterionId,
            page_section: "Trang 2",
            excerpt: "Bằng chứng baseline 2",
          },
        ],
        affectedCitationCount: 2,
      })
      rpc.listDocuments
        .mockResolvedValueOnce(documentsResponse([firstDocument]))
        .mockResolvedValueOnce(documentsResponse([secondDocument]))

      const view = renderOptionEvidence({ baseline: firstBaseline })
      expect(await screen.findByLabelText("Trích đoạn")).toHaveValue("Bằng chứng baseline 1")
      expect(
        screen.getAllByRole("link", {
          name: `${firstDocument.name} (mở trong tab mới)`,
        })
      ).toHaveLength(1)

      view.rerender(
        <TechnicalConfigurationOptionDocuments
          dossier={dossier}
          option={currentOption}
          baselineVersion={secondBaseline}
          criterionId={secondCriterionId}
        />
      )

      await waitFor(() =>
        expect(rpc.listDocuments).toHaveBeenLastCalledWith(
          expect.objectContaining({ p_baseline_version_id: secondBaseline.id }),
          expect.any(AbortSignal)
        )
      )
      expect(await screen.findByLabelText("Trích đoạn")).toHaveValue("Bằng chứng baseline 2")
      expect(
        screen.getAllByRole("link", {
          name: `${secondDocument.name} (mở trong tab mới)`,
        })
      ).toHaveLength(1)
      expect(rpc.getOrCreateComparisonSet).not.toHaveBeenCalled()
    })

    it("shows the global affected citation count and mutates only after confirmation", async () => {
      const user = userEvent.setup()
      const document = optionDocument({ affectedCitationCount: 7 })
      rpc.listDocuments.mockResolvedValue(documentsResponse([document]))
      rpc.deleteDocument.mockResolvedValue({
        data: {
          id: document.id,
          revision: dossier.revision + 1,
          affected_citation_count: document.affected_citation_count,
        },
      })
      renderOptionEvidence()

      await user.click(
        await screen.findByRole("button", {
          name: `Xóa ${document.name}`,
        })
      )
      const dialog = await screen.findByRole("alertdialog")
      expect(within(dialog).getByText(/đang có 7 trích dẫn liên kết/)).toBeInTheDocument()
      expect(rpc.deleteDocument).not.toHaveBeenCalled()

      await user.click(within(dialog).getByRole("button", { name: "Hủy" }))
      expect(rpc.deleteDocument).not.toHaveBeenCalled()

      await user.click(screen.getByRole("button", { name: `Xóa ${document.name}` }))
      await user.click(
        within(await screen.findByRole("alertdialog")).getByRole("button", {
          name: "Xóa tài liệu",
        })
      )
      await waitFor(() =>
        expect(rpc.deleteDocument).toHaveBeenCalledWith({
          p_option_document_id: document.id,
          p_expected_revision: dossier.revision,
        })
      )
    })

    it("preserves the exact raw document draft after a stale conflict and allows retry", async () => {
      const user = userEvent.setup()
      const rawUrl = "HtTpS://EXAMPLE.com/a/../retry-option-spec.pdf"
      rpc.createDocument
        .mockRejectedValueOnce(
          new TechnicalConfigurationRpcError(409, {
            code: "PT409",
            message: "stale_revision",
          })
        )
        .mockResolvedValueOnce({
          data: {
            ...optionDocument(),
            name: "Hồ sơ thử lại",
            url: rawUrl,
            revision: dossier.revision + 2,
          },
        })
      rpc.fetchDossierRevision.mockResolvedValue(dossier.revision + 1)
      renderOptionEvidence()

      await user.type(screen.getByLabelText("Tên tài liệu"), "Hồ sơ thử lại")
      await user.type(screen.getByLabelText("Đường dẫn (URL)"), rawUrl)
      await user.click(screen.getByRole("button", { name: "Thêm tài liệu" }))

      expect(
        await screen.findByText(
          "Hồ sơ đã thay đổi trên máy chủ. Nội dung đang nhập được giữ lại để thử lại."
        )
      ).toBeInTheDocument()
      expect(screen.getByLabelText("Tên tài liệu")).toHaveValue("Hồ sơ thử lại")
      expect(screen.getByLabelText("Đường dẫn (URL)")).toHaveValue(rawUrl)

      await user.click(screen.getByRole("button", { name: "Thêm tài liệu" }))
      await waitFor(() => expect(rpc.createDocument).toHaveBeenCalledTimes(2))
      expect(rpc.createDocument).toHaveBeenLastCalledWith({
        p_option_id: currentOption.id,
        p_name: "Hồ sơ thử lại",
        p_url: rawUrl,
        p_expected_revision: dossier.revision + 1,
      })
    })

    it("preserves a dirty citation and reuses the created comparison set after upsert failure", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      const criterionId = baseline.groups[0]?.criteria[0]?.id ?? ""
      const document = optionDocument()
      const createdComparisonSet = comparisonSet(baseline, [], dossier.revision + 1)
      rpc.listDocuments.mockResolvedValue(documentsResponse([document]))
      rpc.getOrCreateComparisonSet.mockResolvedValue(createdComparisonSet)
      rpc.upsertCitation
        .mockRejectedValueOnce(
          new TechnicalConfigurationRpcError(409, {
            code: "PT409",
            message: "stale_revision",
          })
        )
        .mockResolvedValueOnce({
          data: {
            id: "citation-1",
            criterion_id: criterionId,
            page_section: "Trang 12",
            excerpt: "Đáp ứng đúng tiêu chí",
            revision: createdComparisonSet.revision + 2,
          },
        })
      rpc.fetchDossierRevision.mockResolvedValue(createdComparisonSet.revision + 1)
      renderOptionEvidence({ baseline })

      await user.type(await screen.findByLabelText("Trang hoặc mục"), "Trang 12")
      await user.type(screen.getByLabelText("Trích đoạn"), "Đáp ứng đúng tiêu chí")
      await user.click(screen.getByRole("button", { name: "Lưu trích dẫn" }))

      expect(
        await screen.findByText(
          "Phiên bản đã thay đổi trên máy chủ. Nội dung trích dẫn được giữ lại để thử lại."
        )
      ).toBeInTheDocument()
      expect(screen.getByLabelText("Trang hoặc mục")).toHaveValue("Trang 12")
      expect(screen.getByLabelText("Trích đoạn")).toHaveValue("Đáp ứng đúng tiêu chí")

      await user.click(screen.getByRole("button", { name: "Lưu trích dẫn" }))

      await waitFor(() => expect(rpc.upsertCitation).toHaveBeenCalledTimes(2))
      expect(rpc.getOrCreateComparisonSet).toHaveBeenCalledTimes(1)
      expect(rpc.upsertCitation).toHaveBeenLastCalledWith({
        p_option_document_id: document.id,
        p_comparison_set_id: createdComparisonSet.id,
        p_criterion_id: criterionId,
        p_page_section: "Trang 12",
        p_excerpt: "Đáp ứng đúng tiêu chí",
        p_expected_revision: createdComparisonSet.revision + 1,
      })
    })

    it("keeps locked baselines editable and archived dossiers read-only", async () => {
      const lockedBaseline = baselineVersion({
        status: "locked",
        locked_at: "2026-07-26T01:00:00.000Z",
        locked_by: 1,
      })
      const lockedView = renderOptionEvidence({ baseline: lockedBaseline })
      expect(await screen.findByLabelText("Tên tài liệu")).toBeEnabled()
      lockedView.unmount()

      renderOptionEvidence({
        baseline: lockedBaseline,
        dossierValue: {
          ...dossier,
          archived_at: "2026-07-26T02:00:00.000Z",
          archived_by: 1,
        },
      })
      expect(await screen.findByLabelText("Tên tài liệu")).toBeDisabled()
      expect(screen.getByText("Chỉ đọc")).toBeInTheDocument()
    })
  })
}
