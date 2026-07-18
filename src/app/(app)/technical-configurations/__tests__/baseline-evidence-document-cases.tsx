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
      documentRpc.listDocuments.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        page_size: 100,
      })
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
