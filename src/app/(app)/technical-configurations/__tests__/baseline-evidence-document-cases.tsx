import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { TechnicalConfigurationBaselineDocuments } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineDocuments"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import {
  baselineVersion,
  evidenceDocument,
  type DocumentRpcMocks,
} from "./baseline-evidence-fixtures"

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const emptyDocumentListResponse = {
  data: [],
  total: 0,
  page: 1,
  page_size: 100,
}

export function registerBaselineEvidenceDocumentTests(documentRpc: DocumentRpcMocks) {
  describe("TechnicalConfigurationBaselineDocuments behavior", () => {
    beforeEach(() => {
      Object.values(documentRpc).forEach((mock) => mock.mockReset())
      Object.defineProperty(globalThis, "ResizeObserver", {
        configurable: true,
        value: ResizeObserverMock,
      })
    })

    it("selects an existing document and preserves the raw URL when updating", async () => {
      const user = userEvent.setup()
      const document = evidenceDocument("document-1", "baseline", baselineVersion.id)
      const rawUpdatedUrl = "HtTpS://EXAMPLE.com/a/../revised-spec.pdf"
      documentRpc.listDocuments.mockResolvedValue({
        data: [document],
        total: 1,
        page: 1,
        page_size: 100,
      })
      documentRpc.updateBaselineDocument.mockResolvedValue({
        data: { ...document, name: "Hồ sơ kỹ thuật cập nhật", url: rawUpdatedUrl, revision: 6 },
      })

      render(
        <TechnicalConfigurationBaselineDocuments
          baselineVersion={baselineVersion}
          ownerType="baseline"
          ownerId={baselineVersion.id}
        />,
        { wrapper: createReactQueryWrapper(createTestQueryClient()) }
      )

      const documentPicker = await screen.findByRole("button", {
        name: /Tài liệu đang chỉnh sửa/i,
      })
      act(() => documentPicker.focus())
      await user.keyboard("{ArrowDown}")
      await user.click(await screen.findByRole("option", { name: document.name }))
      expect(screen.getByLabelText("Tên tài liệu")).toHaveValue(document.name)
      expect(screen.getByLabelText("Đường dẫn (URL)")).toHaveValue(document.url)

      const nameInput = screen.getByLabelText("Tên tài liệu")
      await user.clear(nameInput)
      await user.paste("Hồ sơ kỹ thuật cập nhật")
      const urlInput = screen.getByLabelText("Đường dẫn (URL)")
      await user.clear(urlInput)
      await user.paste(rawUpdatedUrl)
      await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))

      await waitFor(() =>
        expect(documentRpc.updateBaselineDocument).toHaveBeenCalledWith({
          p_baseline_document_id: document.id,
          p_name: "Hồ sơ kỹ thuật cập nhật",
          p_url: rawUpdatedUrl,
          p_expected_revision: baselineVersion.revision,
        })
      )
    })

    it("adopts refreshed document values only while the local draft remains clean", async () => {
      const user = userEvent.setup()
      const document = evidenceDocument("document-1", "baseline", baselineVersion.id)
      const queryClient = createTestQueryClient()
      documentRpc.listDocuments.mockResolvedValue({
        data: [document],
        total: 1,
        page: 1,
        page_size: 100,
      })

      render(
        <TechnicalConfigurationBaselineDocuments
          baselineVersion={baselineVersion}
          ownerType="baseline"
          ownerId={baselineVersion.id}
        />,
        { wrapper: createReactQueryWrapper(queryClient) }
      )

      const documentPicker = await screen.findByRole("button", {
        name: /Tài liệu đang chỉnh sửa/i,
      })
      act(() => documentPicker.focus())
      await user.keyboard("{ArrowDown}")
      await user.click(await screen.findByRole("option", { name: document.name }))

      act(() => {
        queryClient.setQueryData(
          ["technical-configurations", "documents", baselineVersion.id],
          [{ ...document, name: "Hồ sơ từ máy chủ", url: "https://example.com/server-v2.pdf" }]
        )
      })

      await waitFor(() =>
        expect(screen.getByLabelText("Tên tài liệu")).toHaveValue("Hồ sơ từ máy chủ")
      )
      expect(screen.getByLabelText("Đường dẫn (URL)")).toHaveValue(
        "https://example.com/server-v2.pdf"
      )

      await user.type(screen.getByLabelText("Tên tài liệu"), " bản nháp")
      act(() => {
        queryClient.setQueryData(
          ["technical-configurations", "documents", baselineVersion.id],
          [{ ...document, name: "Hồ sơ từ máy chủ v3", url: "https://example.com/server-v3.pdf" }]
        )
      })

      expect(screen.getByLabelText("Tên tài liệu")).toHaveValue("Hồ sơ từ máy chủ bản nháp")
      expect(screen.getByLabelText("Đường dẫn (URL)")).toHaveValue(
        "https://example.com/server-v2.pdf"
      )
    })

    it("blocks stale document submission until another document is selected", async () => {
      const user = userEvent.setup()
      const firstDocument = evidenceDocument("document-1", "baseline", baselineVersion.id)
      const secondDocument = evidenceDocument("document-2", "baseline", baselineVersion.id)
      const queryClient = createTestQueryClient()
      documentRpc.listDocuments.mockResolvedValue({
        data: [firstDocument, secondDocument],
        total: 2,
        page: 1,
        page_size: 100,
      })

      render(
        <TechnicalConfigurationBaselineDocuments
          baselineVersion={baselineVersion}
          ownerType="baseline"
          ownerId={baselineVersion.id}
        />,
        { wrapper: createReactQueryWrapper(queryClient) }
      )

      const documentPicker = await screen.findByRole("button", {
        name: /Tài liệu đang chỉnh sửa/i,
      })
      act(() => documentPicker.focus())
      await user.keyboard("{ArrowDown}")
      await user.click(await screen.findByRole("option", { name: firstDocument.name }))

      act(() => {
        queryClient.setQueryData(
          ["technical-configurations", "documents", baselineVersion.id],
          [secondDocument]
        )
      })

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Tài liệu đang chỉnh sửa không còn trong danh sách"
      )
      expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled()
      expect(documentRpc.createBaselineDocument).not.toHaveBeenCalled()

      const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
      const refreshedDocumentPicker = screen.getByRole("button", {
        name: /Tài liệu đang chỉnh sửa/i,
      })
      act(() => refreshedDocumentPicker.focus())
      await user.keyboard("{ArrowDown}")
      await user.click(await screen.findByRole("option", { name: secondDocument.name }))

      await waitFor(() => {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
        expect(screen.getByLabelText("Tên tài liệu")).toHaveValue(secondDocument.name)
      })
      confirm.mockRestore()
    })

    it("preserves a dirty document draft when creating a new document is rejected", async () => {
      const user = userEvent.setup()
      const document = evidenceDocument("document-1", "baseline", baselineVersion.id)
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
      documentRpc.listDocuments.mockResolvedValue({
        data: [document],
        total: 1,
        page: 1,
        page_size: 100,
      })

      render(
        <TechnicalConfigurationBaselineDocuments
          baselineVersion={baselineVersion}
          ownerType="baseline"
          ownerId={baselineVersion.id}
        />,
        { wrapper: createReactQueryWrapper(createTestQueryClient()) }
      )

      const documentPicker = await screen.findByRole("button", {
        name: /Tài liệu đang chỉnh sửa/i,
      })
      act(() => documentPicker.focus())
      await user.keyboard("{ArrowDown}")
      await user.click(await screen.findByRole("option", { name: document.name }))
      await user.type(screen.getByLabelText("Tên tài liệu"), " chưa lưu")
      await user.click(screen.getByRole("button", { name: "Tạo tài liệu mới" }))

      expect(confirm).toHaveBeenCalledWith(
        "Chuyển tài liệu sẽ bỏ nội dung tài liệu chưa lưu. Tiếp tục?"
      )
      expect(screen.getByLabelText("Tên tài liệu")).toHaveValue(`${document.name} chưa lưu`)
      confirm.mockRestore()
    })

    it("renders document submission failures while preserving the draft", async () => {
      const user = userEvent.setup()
      documentRpc.listDocuments.mockResolvedValue(emptyDocumentListResponse)
      documentRpc.createBaselineDocument.mockRejectedValue(new Error("create_failed"))

      render(
        <TechnicalConfigurationBaselineDocuments
          baselineVersion={baselineVersion}
          ownerType="baseline"
          ownerId={baselineVersion.id}
        />,
        { wrapper: createReactQueryWrapper(createTestQueryClient()) }
      )

      await user.type(await screen.findByLabelText("Tên tài liệu"), "Hồ sơ chưa lưu")
      await user.type(screen.getByLabelText("Đường dẫn (URL)"), "https://example.com/spec.pdf")
      await user.click(screen.getByRole("button", { name: "Thêm tài liệu" }))

      expect(await screen.findByRole("alert")).toHaveTextContent("Không thể lưu thay đổi tài liệu")
      expect(screen.getByLabelText("Tên tài liệu")).toHaveValue("Hồ sơ chưa lưu")
    })

    it("blocks document controls until a failed initial load is retried", async () => {
      const user = userEvent.setup()
      documentRpc.listDocuments
        .mockRejectedValueOnce(new Error("list_failed"))
        .mockResolvedValueOnce(emptyDocumentListResponse)

      render(
        <TechnicalConfigurationBaselineDocuments
          baselineVersion={baselineVersion}
          ownerType="baseline"
          ownerId={baselineVersion.id}
        />,
        { wrapper: createReactQueryWrapper(createTestQueryClient()) }
      )

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Không thể tải tài liệu và trích dẫn"
      )
      expect(screen.queryByLabelText("Tên tài liệu")).not.toBeInTheDocument()
      expect(screen.queryByText("Chưa có tài liệu")).not.toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Thử lại" }))

      expect(await screen.findByLabelText("Tên tài liệu")).toBeInTheDocument()
      expect(documentRpc.listDocuments).toHaveBeenCalledTimes(2)
    })

    it("blocks stale document controls when refresh fails after a successful write", async () => {
      const user = userEvent.setup()
      const createdDocument = evidenceDocument("document-1", "baseline", baselineVersion.id)
      documentRpc.listDocuments
        .mockResolvedValueOnce(emptyDocumentListResponse)
        .mockRejectedValueOnce(new Error("refresh_failed"))
        .mockResolvedValueOnce({
          data: [createdDocument],
          total: 1,
          page: 1,
          page_size: 100,
        })
      documentRpc.createBaselineDocument.mockResolvedValue({
        data: { ...createdDocument, revision: baselineVersion.revision + 1 },
      })

      render(
        <TechnicalConfigurationBaselineDocuments
          baselineVersion={baselineVersion}
          ownerType="baseline"
          ownerId={baselineVersion.id}
        />,
        { wrapper: createReactQueryWrapper(createTestQueryClient()) }
      )

      await user.type(await screen.findByLabelText("Tên tài liệu"), createdDocument.name)
      await user.type(screen.getByLabelText("Đường dẫn (URL)"), createdDocument.url)
      await user.click(screen.getByRole("button", { name: "Thêm tài liệu" }))

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Đã lưu thay đổi nhưng không thể làm mới danh sách"
      )
      expect(screen.getByLabelText("Tên tài liệu")).toBeDisabled()
      expect(documentRpc.createBaselineDocument).toHaveBeenCalledTimes(1)

      await user.click(screen.getByRole("button", { name: "Thử lại" }))

      expect(
        await screen.findByRole("button", { name: /Tài liệu đang chỉnh sửa/i })
      ).toBeInTheDocument()
      expect(screen.getByLabelText("Tên tài liệu")).not.toBeDisabled()
      expect(documentRpc.listDocuments).toHaveBeenCalledTimes(3)
    })

    it("confirms document deletion with the affected citation count", async () => {
      const user = userEvent.setup()
      const document = {
        ...evidenceDocument("document-1", "baseline", baselineVersion.id),
        citations: [
          {
            id: "citation-1",
            criterion_id: "criterion-1",
            page_section: "Mục 2",
            excerpt: "Nguồn điện ổn định",
          },
        ],
      }
      documentRpc.listDocuments.mockResolvedValue({
        data: [document],
        total: 1,
        page: 1,
        page_size: 100,
      })
      documentRpc.deleteBaselineDocument.mockResolvedValue({
        data: { affected_link_count: 1, revision: 6 },
      })

      render(
        <TechnicalConfigurationBaselineDocuments
          baselineVersion={baselineVersion}
          ownerType="baseline"
          ownerId={baselineVersion.id}
        />,
        { wrapper: createReactQueryWrapper(createTestQueryClient()) }
      )

      await user.click(await screen.findByRole("button", { name: `Xóa ${document.name}` }))
      expect(screen.getByRole("alertdialog")).toHaveTextContent("1 trích dẫn")
      await user.click(screen.getByRole("button", { name: "Xóa tài liệu" }))

      await waitFor(() =>
        expect(documentRpc.deleteBaselineDocument).toHaveBeenCalledWith({
          p_baseline_document_id: document.id,
          p_expected_revision: baselineVersion.revision,
        })
      )
    })

    it("keeps deletion failures inside the confirmation dialog", async () => {
      const user = userEvent.setup()
      const document = evidenceDocument("document-1", "baseline", baselineVersion.id)
      documentRpc.listDocuments.mockResolvedValue({
        data: [document],
        total: 1,
        page: 1,
        page_size: 100,
      })
      documentRpc.deleteBaselineDocument.mockRejectedValue(new Error("delete_failed"))

      render(
        <TechnicalConfigurationBaselineDocuments
          baselineVersion={baselineVersion}
          ownerType="baseline"
          ownerId={baselineVersion.id}
        />,
        { wrapper: createReactQueryWrapper(createTestQueryClient()) }
      )

      await user.click(await screen.findByRole("button", { name: `Xóa ${document.name}` }))
      const dialog = screen.getByRole("alertdialog")
      await user.click(within(dialog).getByRole("button", { name: "Xóa tài liệu" }))

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Không thể xóa tài liệu")
    })

    it("does not expose delete confirmation for a locked baseline", async () => {
      const document = evidenceDocument("document-1", "baseline", baselineVersion.id)
      documentRpc.listDocuments.mockResolvedValue({
        data: [document],
        total: 1,
        page: 1,
        page_size: 100,
      })

      render(
        <TechnicalConfigurationBaselineDocuments
          baselineVersion={{ ...baselineVersion, status: "locked", locked_at: "2026-07-18" }}
          ownerType="baseline"
          ownerId={baselineVersion.id}
        />,
        { wrapper: createReactQueryWrapper(createTestQueryClient()) }
      )

      await screen.findByRole("link", { name: `${document.name} (mở trong tab mới)` })
      expect(screen.queryByRole("button", { name: `Xóa ${document.name}` })).not.toBeInTheDocument()
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })

    it("does not expose writable controls for an archived dossier", async () => {
      const document = evidenceDocument("document-1", "baseline", baselineVersion.id)
      documentRpc.listDocuments.mockResolvedValue({
        data: [document],
        total: 1,
        page: 1,
        page_size: 100,
      })

      render(
        <TechnicalConfigurationBaselineDocuments
          baselineVersion={baselineVersion}
          ownerType="baseline"
          ownerId={baselineVersion.id}
          readOnly
        />,
        { wrapper: createReactQueryWrapper(createTestQueryClient()) }
      )

      expect(await screen.findByLabelText("Tên tài liệu")).toBeDisabled()
      expect(screen.queryByRole("button", { name: `Xóa ${document.name}` })).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Thêm tài liệu" })).toBeDisabled()
    })
  })
}
