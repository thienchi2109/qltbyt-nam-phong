import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationCriterionPanel } from "../_components/comparison/TechnicalConfigurationCriterionPanel"
import {
  technicalConfigurationDocumentsQueryKey,
  technicalConfigurationOptionDocumentsQueryKey,
} from "../technical-configuration-query-keys"

import {
  baselineEvidenceDocument,
  createEvidenceDetail,
  createEvidenceTestQueryClient,
  renderEvidencePanel,
} from "./comparison-matrix-evidence-fixtures"

const documentRpc = vi.hoisted(() => ({
  listBaselineDocuments: vi.fn(),
  listOptionDocuments: vi.fn(),
}))

vi.mock("../technical-configuration-document-rpc", async (importOriginal) => {
  const original = await importOriginal<typeof import("../technical-configuration-document-rpc")>()
  return {
    ...original,
    listTechnicalConfigurationBaselineDocuments: (...args: unknown[]) =>
      documentRpc.listBaselineDocuments(...args),
    listTechnicalConfigurationOptionDocuments: (...args: unknown[]) =>
      documentRpc.listOptionDocuments(...args),
  }
})

describe("P10B3 lazy comparison evidence", () => {
  beforeEach(() => {
    documentRpc.listBaselineDocuments.mockReset()
    documentRpc.listOptionDocuments.mockReset()
  })

  it("does not query while the panel is closed or the summary reports no evidence", async () => {
    const { rerender } = renderEvidencePanel({
      detail: createEvidenceDetail(),
      open: false,
    })

    rerender(
      <TechnicalConfigurationCriterionPanel
        detail={createEvidenceDetail({ hasEvidence: false })}
        open
        onOpenChange={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(documentRpc.listBaselineDocuments).not.toHaveBeenCalled()
      expect(documentRpc.listOptionDocuments).not.toHaveBeenCalled()
    })
  })

  it("uses the existing bounded baseline document path for one open baseline cell", async () => {
    const queryClient = createEvidenceTestQueryClient()
    documentRpc.listBaselineDocuments.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      page_size: 20,
    })

    renderEvidencePanel({ detail: createEvidenceDetail(), open: true, queryClient })

    await waitFor(() => expect(documentRpc.listBaselineDocuments).toHaveBeenCalledTimes(1))
    expect(documentRpc.listBaselineDocuments).toHaveBeenCalledWith(
      {
        p_baseline_version_id: "baseline-1",
        p_page: 1,
        p_page_size: 20,
      },
      expect.any(AbortSignal)
    )
    expect(documentRpc.listOptionDocuments).not.toHaveBeenCalled()
    expect(
      queryClient
        .getQueryCache()
        .findAll({ queryKey: technicalConfigurationDocumentsQueryKey("baseline-1") })
    ).toHaveLength(1)
  })

  it("uses the existing exact-baseline option document path for one open option cell", async () => {
    const queryClient = createEvidenceTestQueryClient()
    documentRpc.listOptionDocuments.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      page_size: 20,
    })

    renderEvidencePanel({
      detail: createEvidenceDetail({ owner: "option" }),
      open: true,
      queryClient,
    })

    await waitFor(() => expect(documentRpc.listOptionDocuments).toHaveBeenCalledTimes(1))
    expect(documentRpc.listOptionDocuments).toHaveBeenCalledWith(
      {
        p_option_id: "option-b",
        p_baseline_version_id: "baseline-1",
        p_page: 1,
        p_page_size: 20,
      },
      expect.any(AbortSignal)
    )
    expect(documentRpc.listBaselineDocuments).not.toHaveBeenCalled()
    expect(
      queryClient.getQueryCache().findAll({
        queryKey: technicalConfigurationOptionDocumentsQueryKey("option-b", "baseline-1"),
      })
    ).toHaveLength(1)
  })

  it("renders only baseline-owned documents and citations for the active criterion", async () => {
    const longExcerpt =
      "Đây là đoạn trích rất dài dùng để xác nhận nội dung bằng chứng được giữ nguyên, tự xuống dòng và không bị rút gọn trong panel chi tiết."
    documentRpc.listBaselineDocuments.mockResolvedValue({
      data: [
        baselineEvidenceDocument({ id: "matching", excerpt: longExcerpt }),
        baselineEvidenceDocument({ id: "other-criterion", criterionId: "criterion-other" }),
        baselineEvidenceDocument({
          id: "reference-product",
          ownerType: "reference_product",
          ownerId: "reference-1",
        }),
      ],
      total: 3,
      page: 1,
      page_size: 20,
    })

    renderEvidencePanel({ detail: createEvidenceDetail(), open: true })

    expect(await screen.findByRole("link", { name: /Tài liệu matching/ })).toHaveAttribute(
      "href",
      "https://example.com/matching"
    )
    expect(screen.getByText(longExcerpt)).toHaveClass("whitespace-pre-wrap", "break-words")
    expect(screen.queryByText("Tài liệu other-criterion")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Tài liệu chưa có trích dẫn cho tiêu chí này.")
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Tài liệu reference-product")).not.toBeInTheDocument()
    expect(screen.queryByText("Đoạn trích xác nhận độ phân giải.")).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByText("Thêm tài liệu")).not.toBeInTheDocument()
    expect(screen.queryByText("Lưu thay đổi")).not.toBeInTheDocument()
    expect(screen.queryByText("Xóa")).not.toBeInTheDocument()
  })

  it("loads one bounded page at a time", async () => {
    const user = userEvent.setup()
    documentRpc.listBaselineDocuments
      .mockResolvedValueOnce({
        data: [baselineEvidenceDocument({ id: "page-1" })],
        total: 21,
        page: 1,
        page_size: 20,
      })
      .mockResolvedValueOnce({
        data: [baselineEvidenceDocument({ id: "page-2" })],
        total: 21,
        page: 2,
        page_size: 20,
      })

    renderEvidencePanel({ detail: createEvidenceDetail(), open: true })

    expect(await screen.findByText("Tài liệu page-1")).toBeInTheDocument()
    expect(screen.queryByText("Tài liệu page-2")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Tải thêm" }))

    expect(await screen.findByText("Tài liệu page-2")).toBeInTheDocument()
    expect(documentRpc.listBaselineDocuments).toHaveBeenNthCalledWith(
      2,
      {
        p_baseline_version_id: "baseline-1",
        p_page: 2,
        p_page_size: 20,
      },
      expect.any(AbortSignal)
    )
    expect(screen.queryByRole("button", { name: "Tải thêm" })).not.toBeInTheDocument()
  })

  it("renders an initial error with one retry action and recovers", async () => {
    const user = userEvent.setup()
    documentRpc.listBaselineDocuments
      .mockRejectedValueOnce(new Error("network_error"))
      .mockResolvedValueOnce({
        data: [baselineEvidenceDocument({ id: "recovered" })],
        total: 1,
        page: 1,
        page_size: 20,
      })

    renderEvidencePanel({ detail: createEvidenceDetail(), open: true })

    expect(await screen.findByText("Không thể tải bằng chứng.")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Thử lại" })).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "Thử lại" }))

    expect(await screen.findByText("Tài liệu recovered")).toBeInTheDocument()
    expect(screen.queryByText("Không thể tải bằng chứng.")).not.toBeInTheDocument()
  })

  it("replaces load more with one retry action after a later page fails", async () => {
    const user = userEvent.setup()
    documentRpc.listBaselineDocuments
      .mockResolvedValueOnce({
        data: [baselineEvidenceDocument({ id: "page-1" })],
        total: 21,
        page: 1,
        page_size: 20,
      })
      .mockRejectedValueOnce(new Error("page_2_failed"))
      .mockResolvedValueOnce({
        data: [baselineEvidenceDocument({ id: "page-2" })],
        total: 21,
        page: 2,
        page_size: 20,
      })

    renderEvidencePanel({ detail: createEvidenceDetail(), open: true })

    await user.click(await screen.findByRole("button", { name: "Tải thêm" }))

    expect(await screen.findByText("Không thể tải thêm bằng chứng.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tải thêm" })).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Thử lại" })).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "Thử lại" }))

    expect(await screen.findByText("Tài liệu page-2")).toBeInTheDocument()
    expect(screen.queryByText("Không thể tải thêm bằng chứng.")).not.toBeInTheDocument()
  })

  it("aborts the obsolete request when the active detail closes", async () => {
    let requestSignal: AbortSignal | undefined
    documentRpc.listBaselineDocuments.mockImplementation((_args: unknown, signal: AbortSignal) => {
      requestSignal = signal
      return new Promise(() => undefined)
    })
    const detail = createEvidenceDetail()
    const { rerender } = renderEvidencePanel({ detail, open: true })

    await waitFor(() => expect(requestSignal).toBeDefined())

    rerender(
      <TechnicalConfigurationCriterionPanel detail={detail} open={false} onOpenChange={vi.fn()} />
    )

    await waitFor(() => expect(requestSignal?.aborted).toBe(true))
  })

  it("aborts the obsolete request when the active detail switches target", async () => {
    let baselineRequestSignal: AbortSignal | undefined
    documentRpc.listBaselineDocuments.mockImplementation((_args: unknown, signal: AbortSignal) => {
      baselineRequestSignal = signal
      return new Promise(() => undefined)
    })
    documentRpc.listOptionDocuments.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      page_size: 20,
    })
    const { rerender } = renderEvidencePanel({
      detail: createEvidenceDetail(),
      open: true,
    })

    await waitFor(() => expect(baselineRequestSignal).toBeDefined())

    rerender(
      <TechnicalConfigurationCriterionPanel
        detail={createEvidenceDetail({ owner: "option" })}
        open
        onOpenChange={vi.fn()}
      />
    )

    await waitFor(() => expect(baselineRequestSignal?.aborted).toBe(true))
    expect(documentRpc.listOptionDocuments).toHaveBeenCalledWith(
      {
        p_option_id: "option-b",
        p_baseline_version_id: "baseline-1",
        p_page: 1,
        p_page_size: 20,
      },
      expect.any(AbortSignal)
    )
  })
})
