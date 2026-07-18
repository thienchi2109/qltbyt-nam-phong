import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationCitationEditor } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationCitationEditor"
import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"
import { baselineVersion, evidenceDocument } from "./baseline-evidence-fixtures"

const criteria = [
  {
    id: "criterion-1",
    criterionCode: "TC-0001",
    title: "Nguồn điện",
  },
  {
    id: "criterion-2",
    criterionCode: "TC-0002",
    title: "Môi trường vận hành",
  },
]

export function registerBaselineEvidenceCitationTests() {
  describe("TechnicalConfigurationCitationEditor behavior", () => {
    it("keeps long Vietnamese citation input after a stale conflict", async () => {
      const user = userEvent.setup()
      const onSave = vi
        .fn()
        .mockRejectedValue(new TechnicalConfigurationRpcError(409, { message: "stale_revision" }))
      const onDirtyChange = vi.fn()
      const excerpt =
        "Thiết bị phải duy trì nguồn điện ổn định trong toàn bộ chu kỳ vận hành, kể cả khi tải thay đổi đột ngột và hệ thống chuyển sang nguồn dự phòng."
      render(
        <TechnicalConfigurationCitationEditor
          documents={[evidenceDocument("document-1", "baseline", baselineVersion.id)]}
          criteria={criteria}
          fixedCriterionId="criterion-1"
          isPending={false}
          disabled={false}
          onSave={onSave}
          onDelete={vi.fn()}
          onDirtyChange={onDirtyChange}
        />
      )

      await user.type(screen.getByLabelText("Trang hoặc mục"), "Mục 4.2")
      await user.click(screen.getByLabelText("Trích đoạn"))
      await user.paste(excerpt)
      await user.click(screen.getByRole("button", { name: "Lưu trích dẫn" }))

      expect(onSave).toHaveBeenCalledWith({
        document: expect.objectContaining({ id: "document-1" }),
        criterionId: "criterion-1",
        pageSection: "Mục 4.2",
        excerpt,
      })
      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent("Phiên bản đã thay đổi trên máy chủ")
      )
      expect(screen.getByLabelText("Trang hoặc mục")).toHaveValue("Mục 4.2")
      expect(screen.getByLabelText("Trích đoạn")).toHaveValue(excerpt)
      expect(onDirtyChange).toHaveBeenCalledWith(true)
    })

    it("hydrates an existing citation after documents load asynchronously", async () => {
      const user = userEvent.setup()
      const onSave = vi.fn().mockResolvedValue(undefined)
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
      const view = render(
        <TechnicalConfigurationCitationEditor
          documents={[]}
          criteria={criteria}
          fixedCriterionId="criterion-1"
          isPending={false}
          disabled={false}
          onSave={onSave}
          onDelete={vi.fn()}
        />
      )

      view.rerender(
        <TechnicalConfigurationCitationEditor
          documents={[document]}
          criteria={criteria}
          fixedCriterionId="criterion-1"
          isPending={false}
          disabled={false}
          onSave={onSave}
          onDelete={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText("Trang hoặc mục")).toHaveValue("Mục 2")
        expect(screen.getByLabelText("Trích đoạn")).toHaveValue("Nguồn điện ổn định")
      })
      await user.clear(screen.getByLabelText("Trang hoặc mục"))
      await user.type(screen.getByLabelText("Trang hoặc mục"), "Mục 2.1")
      await user.click(screen.getByRole("button", { name: "Lưu trích dẫn" }))

      expect(onSave).toHaveBeenCalledWith({
        document: expect.objectContaining({ id: document.id }),
        criterionId: "criterion-1",
        pageSection: "Mục 2.1",
        excerpt: "Nguồn điện ổn định",
      })
    })

    it("preserves a dirty citation when document selection is rejected", async () => {
      const user = userEvent.setup()
      const firstDocument = {
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
      const secondDocument = {
        ...evidenceDocument("document-2", "baseline", baselineVersion.id),
        citations: [
          {
            id: "citation-2",
            criterion_id: "criterion-1",
            page_section: "Mục 5",
            excerpt: "Nguồn điện dự phòng",
          },
        ],
      }
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
      render(
        <TechnicalConfigurationCitationEditor
          documents={[firstDocument, secondDocument]}
          criteria={criteria}
          fixedCriterionId="criterion-1"
          isPending={false}
          disabled={false}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      )

      await user.clear(screen.getByLabelText("Trích đoạn"))
      await user.type(screen.getByLabelText("Trích đoạn"), "Bản nháp chưa lưu")
      const documentPicker = screen.getByRole("button", { name: /Tài liệu/i })
      act(() => documentPicker.focus())
      await user.keyboard("{ArrowDown}")
      await user.click(await screen.findByRole("option", { name: secondDocument.name }))

      expect(confirm).toHaveBeenCalledWith(
        "Chuyển lựa chọn sẽ bỏ nội dung trích dẫn chưa lưu. Tiếp tục?"
      )
      expect(screen.getByLabelText("Trích đoạn")).toHaveValue("Bản nháp chưa lưu")
      expect(documentPicker).toHaveTextContent(firstDocument.name)
      confirm.mockRestore()
    })

    it("preserves a dirty citation when the selected document disappears", async () => {
      const user = userEvent.setup()
      const firstDocument = evidenceDocument("document-1", "baseline", baselineVersion.id)
      const secondDocument = evidenceDocument("document-2", "baseline", baselineVersion.id)
      const view = render(
        <TechnicalConfigurationCitationEditor
          documents={[firstDocument, secondDocument]}
          criteria={criteria}
          fixedCriterionId="criterion-1"
          isPending={false}
          disabled={false}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      )

      await user.type(screen.getByLabelText("Trích đoạn"), "Bản nháp chưa lưu")
      view.rerender(
        <TechnicalConfigurationCitationEditor
          documents={[secondDocument]}
          criteria={criteria}
          fixedCriterionId="criterion-1"
          isPending={false}
          disabled={false}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      )

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Tài liệu đang chỉnh sửa không còn trong danh sách"
      )
      expect(screen.getByLabelText("Trích đoạn")).toHaveValue("Bản nháp chưa lưu")
      expect(screen.getByRole("button", { name: "Lưu trích dẫn" })).toBeDisabled()

      const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
      const documentPicker = screen.getByRole("button", { name: /Tài liệu/i })
      act(() => documentPicker.focus())
      await user.keyboard("{ArrowDown}")
      await user.click(await screen.findByRole("option", { name: secondDocument.name }))

      await waitFor(() => expect(screen.getByText(secondDocument.name)).toBeInTheDocument())
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
      confirm.mockRestore()
    })

    it("renders citation deletion failures without an unhandled rejection", async () => {
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
      render(
        <TechnicalConfigurationCitationEditor
          documents={[document]}
          criteria={criteria}
          fixedCriterionId="criterion-1"
          isPending={false}
          disabled={false}
          onSave={vi.fn()}
          onDelete={vi.fn().mockRejectedValue(new Error("delete_failed"))}
        />
      )

      await user.click(screen.getByRole("button", { name: "Xóa trích dẫn" }))

      expect(await screen.findByRole("alert")).toHaveTextContent("Không thể lưu trích dẫn")
      expect(screen.getByLabelText("Trích đoạn")).toHaveValue("Nguồn điện ổn định")
    })

    it("renders locked citations read-only without save or delete actions", () => {
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
      render(
        <TechnicalConfigurationCitationEditor
          documents={[document]}
          criteria={criteria}
          fixedCriterionId="criterion-1"
          isPending={false}
          disabled
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      )

      expect(screen.getByLabelText("Trang hoặc mục")).toBeDisabled()
      expect(screen.getByLabelText("Trích đoạn")).toBeDisabled()
      expect(screen.queryByRole("button", { name: "Lưu trích dẫn" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Xóa trích dẫn" })).not.toBeInTheDocument()
    })
  })
}
