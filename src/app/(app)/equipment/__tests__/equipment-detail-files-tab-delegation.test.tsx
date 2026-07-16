import { act, render, screen, waitFor } from "@testing-library/react"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { UrlDocumentFormProps } from "@/components/url-documents/UrlDocumentForm"
import type { UrlDocumentListProps } from "@/components/url-documents/UrlDocumentList"
import type { ParsedAbsoluteUrl } from "@/components/url-documents/url-document-utils"
import {
  EquipmentDetailFilesTab,
  type EquipmentDetailFilesTabProps,
} from "../_components/EquipmentDetailDialog/EquipmentDetailFilesTab"
import type { Attachment } from "../types"

const sharedMocks = vi.hoisted(() => ({
  formProps: null as UrlDocumentFormProps | null,
  listProps: null as UrlDocumentListProps | null,
  parseAbsoluteUrl: vi.fn<(value: string) => ParsedAbsoluteUrl | null>(),
  isAllowedDocumentUrl: vi.fn<(parsed: ParsedAbsoluteUrl | null) => boolean>(),
}))

vi.mock("@/components/url-documents/UrlDocumentForm", () => ({
  UrlDocumentForm: (props: UrlDocumentFormProps) => {
    sharedMocks.formProps = props
    return <div data-testid="url-document-form" />
  },
}))

vi.mock("@/components/url-documents/UrlDocumentList", () => ({
  UrlDocumentList: (props: UrlDocumentListProps) => {
    sharedMocks.listProps = props
    return <div data-testid="url-document-list" />
  },
}))

vi.mock("@/components/url-documents/url-document-utils", () => ({
  parseAbsoluteUrl: sharedMocks.parseAbsoluteUrl,
  isAllowedDocumentUrl: sharedMocks.isAllowedDocumentUrl,
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

const attachment: Attachment = {
  id: "attachment-1",
  ten_file: "Giấy chứng nhận hiệu chuẩn",
  duong_dan_luu_tru: "https://example.com/calibration.pdf",
  thiet_bi_id: 42,
}

function renderFilesTab(overrides: Partial<EquipmentDetailFilesTabProps> = {}) {
  const props: EquipmentDetailFilesTabProps = {
    attachments: [attachment],
    isLoading: false,
    googleDriveFolderUrl: null,
    onAddAttachment: vi.fn().mockResolvedValue(undefined),
    onDeleteAttachment: vi.fn().mockResolvedValue(undefined),
    isAdding: false,
    isDeleting: false,
    ...overrides,
  }

  return { ...render(<EquipmentDetailFilesTab {...props} />), props }
}

function currentFormProps() {
  expect(sharedMocks.formProps).not.toBeNull()
  return sharedMocks.formProps!
}

function currentListProps() {
  expect(sharedMocks.listProps).not.toBeNull()
  return sharedMocks.listProps!
}

beforeEach(() => {
  sharedMocks.formProps = null
  sharedMocks.listProps = null
  sharedMocks.parseAbsoluteUrl.mockReset().mockImplementation((value) => ({
    raw: value,
    protocol: value.toLowerCase().startsWith("http://") ? "http:" : "https:",
  }))
  sharedMocks.isAllowedDocumentUrl.mockReset().mockImplementation((parsed) => parsed !== null)
})

afterAll(() => {
  vi.restoreAllMocks()
})

describe("EquipmentDetailFilesTab shared URL document delegation", () => {
  it("keeps fields controlled and submits the exact raw URL through shared policy", async () => {
    const onAddAttachment = vi.fn().mockResolvedValue(undefined)
    renderFilesTab({ onAddAttachment })

    expect(screen.getByTestId("url-document-form")).toBeInTheDocument()
    expect(currentFormProps()).toMatchObject({
      name: "",
      url: "",
      isPending: false,
      submitLabel: "Lưu liên kết",
    })

    act(() => currentFormProps().onNameChange("Hướng dẫn sử dụng"))
    act(() => currentFormProps().onUrlChange("HtTpS://EXAMPLE.com/a/../spec.pdf"))

    expect(currentFormProps().name).toBe("Hướng dẫn sử dụng")
    expect(currentFormProps().url).toBe("HtTpS://EXAMPLE.com/a/../spec.pdf")

    await act(async () => {
      await currentFormProps().onSubmit()
    })

    expect(sharedMocks.parseAbsoluteUrl).toHaveBeenCalledWith("HtTpS://EXAMPLE.com/a/../spec.pdf")
    expect(sharedMocks.isAllowedDocumentUrl).toHaveBeenCalledWith({
      raw: "HtTpS://EXAMPLE.com/a/../spec.pdf",
      protocol: "https:",
    })
    expect(onAddAttachment).toHaveBeenCalledWith({
      name: "Hướng dẫn sử dụng",
      url: "HtTpS://EXAMPLE.com/a/../spec.pdf",
    })
    expect(currentFormProps()).toMatchObject({ name: "", url: "" })
  })

  it("maps file_dinh_kem fields and retains confirmation plus per-item pending", async () => {
    let resolveDelete = () => undefined
    const pendingDelete = new Promise<void>((resolve) => {
      resolveDelete = resolve
    })
    const onDeleteAttachment = vi.fn(() => pendingDelete)
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    renderFilesTab({ onDeleteAttachment })

    expect(screen.getByTestId("url-document-list")).toBeInTheDocument()
    expect(currentListProps()).toMatchObject({
      items: [
        {
          id: attachment.id,
          name: attachment.ten_file,
          url: attachment.duong_dan_luu_tru,
        },
      ],
      isLoading: false,
      deletingId: null,
      disabled: false,
      emptyMessage: "Chưa có file nào được đính kèm.",
    })

    act(() => {
      currentListProps().onDelete?.(attachment.id)
    })

    await waitFor(() => expect(onDeleteAttachment).toHaveBeenCalledWith(attachment.id))
    expect(confirmSpy).toHaveBeenCalledWith("Bạn có chắc chắn muốn xóa file đính kèm này không?")
    await waitFor(() => expect(currentListProps().deletingId).toBe(attachment.id))

    await act(async () => {
      resolveDelete()
      await pendingDelete
    })

    await waitFor(() => expect(currentListProps().deletingId).toBeNull())
  })

  it("keeps Google Drive outside shared primitives but gates it through shared policy", () => {
    const googleDriveFolderUrl = "https://drive.google.com/drive/folders/shared"
    renderFilesTab({ googleDriveFolderUrl })

    expect(sharedMocks.parseAbsoluteUrl).toHaveBeenCalledWith(googleDriveFolderUrl)
    expect(sharedMocks.isAllowedDocumentUrl).toHaveBeenCalledWith({
      raw: googleDriveFolderUrl,
      protocol: "https:",
    })
    expect(screen.getByRole("link", { name: "Mở thư mục chung" })).toHaveAttribute(
      "href",
      googleDriveFolderUrl
    )
  })
})
