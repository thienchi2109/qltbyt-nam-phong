import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import {
  EquipmentDetailFilesTab,
  type EquipmentDetailFilesTabProps,
} from "../_components/EquipmentDetailDialog/EquipmentDetailFilesTab"
import type { Attachment } from "../types"

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

class ResizeObserverMock implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    void callback
  }

  observe(target: Element, options?: ResizeObserverOptions) {
    void target
    void options
  }

  unobserve(target: Element) {
    void target
  }

  disconnect() {}
}

const attachment: Attachment = {
  id: "attachment-1",
  ten_file: "Giấy chứng nhận hiệu chuẩn",
  duong_dan_luu_tru: "https://example.com/calibration.pdf",
  thiet_bi_id: 42,
}

const urlPolicyCases = [
  ["malformed", "không-phải-url", false],
  ["relative", "/documents/spec.pdf", false],
  ["scheme-relative", "//example.com/spec.pdf", false],
  ["protocol-only", "https:example.com", false],
  ["single-slash", "https:/example.com", false],
  ["one-backslash", String.raw`https:\example.com`, false],
  ["two-backslashes", String.raw`https:\\example.com`, false],
  ["ftp", "ftp://example.com/spec.pdf", false],
  ["mailto", "mailto:owner@example.com", false],
  ["blob", "blob:https://example.com/document-id", false],
  ["javascript", "javascript:alert(1)", false],
  ["data", "data:text/plain,specification", false],
  ["file", "file:///tmp/spec.pdf", false],
  ["HTTP", "http://example.com/spec.pdf", true],
  ["HTTPS", "https://example.com/spec.pdf", true],
] as const

function renderFilesTab(overrides: Partial<EquipmentDetailFilesTabProps> = {}) {
  const props: EquipmentDetailFilesTabProps = {
    attachments: [],
    isLoading: false,
    googleDriveFolderUrl: null,
    onAddAttachment: vi.fn().mockResolvedValue(undefined),
    onDeleteAttachment: vi.fn().mockResolvedValue(undefined),
    isAdding: false,
    isDeleting: false,
    ...overrides,
  }

  return {
    ...render(<EquipmentDetailFilesTab {...props} />),
    props,
  }
}

function getNameInput() {
  return (screen.queryByLabelText("Tên tài liệu") ??
    screen.getByLabelText("Tên file")) as HTMLInputElement
}

function getDeleteButton(container: HTMLElement) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => !candidate.closest("form")
  )
  expect(button).toBeInstanceOf(HTMLButtonElement)
  return button as HTMLButtonElement
}

async function fillValidAttachmentForm() {
  const user = userEvent.setup()
  await user.type(getNameInput(), "Hướng dẫn sử dụng")
  await user.type(screen.getByLabelText("Đường dẫn (URL)"), "https://example.com/manual.pdf")
  return user
}

beforeAll(() => {
  globalThis.ResizeObserver = ResizeObserverMock
})

afterEach(() => {
  vi.restoreAllMocks()
  mocks.toast.mockReset()
})

describe("EquipmentDetailFilesTab", () => {
  it("shows loading skeletons instead of empty or listed content", () => {
    const { container } = renderFilesTab({
      attachments: [attachment],
      isLoading: true,
    })

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3)
    expect(screen.queryByText("Chưa có file nào được đính kèm.")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: new RegExp(attachment.ten_file) })
    ).not.toBeInTheDocument()
  })

  it("shows the empty state after loading an empty list", () => {
    renderFilesTab()

    expect(screen.getByText("Chưa có file nào được đính kèm.")).toBeInTheDocument()
  })

  it("renders an attachment from duong_dan_luu_tru with safe external-link attributes", () => {
    renderFilesTab({ attachments: [attachment] })

    const link = screen.getByRole("link", { name: new RegExp(attachment.ten_file) })
    expect(link).toHaveAttribute("href", attachment.duong_dan_luu_tru)
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("keeps submit disabled until both required controlled fields have values", async () => {
    const user = userEvent.setup()
    renderFilesTab()

    const submitButton = screen.getByRole("button", { name: "Lưu liên kết" })
    expect(submitButton).toBeDisabled()

    await user.type(getNameInput(), "Hướng dẫn sử dụng")
    expect(submitButton).toBeDisabled()

    await user.type(screen.getByLabelText("Đường dẫn (URL)"), "https://example.com/manual.pdf")
    expect(submitButton).toBeEnabled()
  })

  it.each(urlPolicyCases)(
    "applies shared URL policy to add input: %s",
    async (_name, url, allowed) => {
      const onAddAttachment = vi.fn().mockResolvedValue(undefined)
      renderFilesTab({ onAddAttachment })

      fireEvent.change(getNameInput(), {
        target: { value: "Hướng dẫn sử dụng" },
      })
      fireEvent.change(screen.getByLabelText("Đường dẫn (URL)"), {
        target: { value: url },
      })
      fireEvent.submit(screen.getByRole("button", { name: "Lưu liên kết" }).closest("form")!)

      if (allowed) {
        await waitFor(() =>
          expect(onAddAttachment).toHaveBeenCalledWith({
            name: "Hướng dẫn sử dụng",
            url,
          })
        )
      } else {
        expect(onAddAttachment).not.toHaveBeenCalled()
        expect(mocks.toast).toHaveBeenCalledWith({
          variant: "destructive",
          title: "URL không hợp lệ",
          description: "Vui lòng nhập một đường dẫn URL hợp lệ.",
        })
      }
    }
  )

  it.each(urlPolicyCases)(
    "applies shared URL policy to an existing attachment: %s",
    (_name, url, allowed) => {
      const item = { ...attachment, duong_dan_luu_tru: url }
      const { container } = renderFilesTab({ attachments: [item] })
      const link = screen.queryByRole("link", {
        name: new RegExp(item.ten_file),
      })

      expect(Boolean(link)).toBe(allowed)
      if (allowed) {
        expect(link).toHaveAttribute("href", url)
        expect(link).toHaveAttribute("target", "_blank")
        expect(link).toHaveAttribute("rel", "noopener noreferrer")
      } else {
        expect(screen.getByText(item.ten_file)).toBeInTheDocument()
        expect(container.querySelector("a")).not.toBeInTheDocument()
        expect(container.querySelector('[href="#"]')).not.toBeInTheDocument()
      }
    }
  )

  it.each(urlPolicyCases)(
    "applies shared URL policy to the Google Drive folder: %s",
    (_name, url, allowed) => {
      const { container } = renderFilesTab({ googleDriveFolderUrl: url })
      const link = screen.queryByRole("link", { name: "Mở thư mục chung" })

      expect(Boolean(link)).toBe(allowed)
      if (allowed) {
        expect(link).toHaveAttribute("href", url)
        expect(link).toHaveAttribute("target", "_blank")
        expect(link).toHaveAttribute("rel", "noopener noreferrer")
      } else {
        expect(container.querySelector('a[href="#"]')).not.toBeInTheDocument()
      }
    }
  )

  it("submits exact values and clears both fields after a successful add", async () => {
    const onAddAttachment = vi.fn().mockResolvedValue(undefined)
    renderFilesTab({ onAddAttachment })
    const user = await fillValidAttachmentForm()

    await user.click(screen.getByRole("button", { name: "Lưu liên kết" }))

    await waitFor(() => {
      expect(onAddAttachment).toHaveBeenCalledWith({
        name: "Hướng dẫn sử dụng",
        url: "https://example.com/manual.pdf",
      })
    })
    expect(getNameInput()).toHaveValue("")
    expect(screen.getByLabelText("Đường dẫn (URL)")).toHaveValue("")
  })

  it("keeps values after a rejected add and allows retry without an unhandled rejection", async () => {
    const onAddAttachment = vi
      .fn()
      .mockRejectedValueOnce(new Error("add failed"))
      .mockResolvedValueOnce(undefined)
    renderFilesTab({ onAddAttachment })
    const user = await fillValidAttachmentForm()
    const submitButton = screen.getByRole("button", { name: "Lưu liên kết" })

    await user.click(submitButton)

    await waitFor(() => expect(onAddAttachment).toHaveBeenCalledTimes(1))
    expect(getNameInput()).toHaveValue("Hướng dẫn sử dụng")
    expect(screen.getByLabelText("Đường dẫn (URL)")).toHaveValue("https://example.com/manual.pdf")

    await user.click(submitButton)

    await waitFor(() => expect(onAddAttachment).toHaveBeenCalledTimes(2))
    expect(getNameInput()).toHaveValue("")
    expect(screen.getByLabelText("Đường dẫn (URL)")).toHaveValue("")
  })

  it("disables both inputs and submit while add is pending and shows a spinner", () => {
    const { container } = renderFilesTab({ isAdding: true })

    expect(getNameInput()).toBeDisabled()
    expect(screen.getByLabelText("Đường dẫn (URL)")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Lưu liên kết" })).toBeDisabled()
    expect(container.querySelector("svg.animate-spin")).toBeInTheDocument()
  })

  it("does not delete when confirmation is cancelled", async () => {
    const onDeleteAttachment = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(window, "confirm").mockReturnValue(false)
    const { container } = renderFilesTab({
      attachments: [attachment],
      onDeleteAttachment,
    })

    await userEvent.setup().click(getDeleteButton(container))

    expect(onDeleteAttachment).not.toHaveBeenCalled()
  })

  it("passes the exact attachment ID after delete confirmation", async () => {
    const onDeleteAttachment = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(window, "confirm").mockReturnValue(true)
    const { container } = renderFilesTab({
      attachments: [attachment],
      onDeleteAttachment,
    })

    await userEvent.setup().click(getDeleteButton(container))

    await waitFor(() => {
      expect(onDeleteAttachment).toHaveBeenCalledWith(attachment.id)
    })
  })

  it("keeps deletion disabled while the external delete mutation is pending", async () => {
    const onDeleteAttachment = vi.fn().mockResolvedValue(undefined)
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    const { container } = renderFilesTab({
      attachments: [attachment],
      isDeleting: true,
      onDeleteAttachment,
    })
    const deleteButton = getDeleteButton(container)

    expect(deleteButton).toBeDisabled()
    await userEvent.setup().click(deleteButton)
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(onDeleteAttachment).not.toHaveBeenCalled()
  })

  it("blocks duplicate delete requests and re-enables deletion after the request settles", async () => {
    let resolveDelete = () => undefined
    const pendingDelete = new Promise<void>((resolve) => {
      resolveDelete = resolve
    })
    const onDeleteAttachment = vi.fn(() => pendingDelete)
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    const { container } = renderFilesTab({
      attachments: [attachment],
      onDeleteAttachment,
    })
    const user = userEvent.setup()
    const deleteButton = getDeleteButton(container)

    await user.click(deleteButton)

    await waitFor(() => expect(deleteButton).toBeDisabled())
    expect(container.querySelector("svg.animate-spin")).toBeInTheDocument()
    await user.click(deleteButton)
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(onDeleteAttachment).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveDelete()
      await pendingDelete
    })

    await waitFor(() => expect(deleteButton).toBeEnabled())
    await user.click(deleteButton)
    await waitFor(() => expect(onDeleteAttachment).toHaveBeenCalledTimes(2))
    expect(confirmSpy).toHaveBeenCalledTimes(2)
  })

  it("catches a rejected delete, clears pending state, and allows retry", async () => {
    const onDeleteAttachment = vi
      .fn()
      .mockRejectedValueOnce(new Error("delete failed"))
      .mockResolvedValueOnce(undefined)
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    const { container } = renderFilesTab({
      attachments: [attachment],
      onDeleteAttachment,
    })
    const deleteButton = getDeleteButton(container)
    const user = userEvent.setup()

    await user.click(deleteButton)

    await waitFor(() => expect(onDeleteAttachment).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(deleteButton).toBeEnabled())

    await user.click(deleteButton)

    await waitFor(() => expect(onDeleteAttachment).toHaveBeenCalledTimes(2))
    expect(confirmSpy).toHaveBeenCalledTimes(2)
  })

  it("preserves normalization-prone raw URLs across all three Equipment sinks", async () => {
    const raw = "HtTpS://EXAMPLE.com/a/../spec.pdf"
    const onAddAttachment = vi.fn().mockResolvedValue(undefined)
    renderFilesTab({
      attachments: [{ ...attachment, ten_file: "Raw attachment", duong_dan_luu_tru: raw }],
      googleDriveFolderUrl: raw,
      onAddAttachment,
    })

    fireEvent.change(getNameInput(), {
      target: { value: "Raw upload" },
    })
    fireEvent.change(screen.getByLabelText("Đường dẫn (URL)"), {
      target: { value: raw },
    })
    fireEvent.submit(screen.getByRole("button", { name: "Lưu liên kết" }).closest("form")!)

    await waitFor(() =>
      expect(onAddAttachment).toHaveBeenCalledWith({
        name: "Raw upload",
        url: raw,
      })
    )

    const attachmentLink = screen.getByRole("link", {
      name: /Raw attachment/,
    }) as HTMLAnchorElement
    const folderLink = screen.getByRole("link", {
      name: "Mở thư mục chung",
    }) as HTMLAnchorElement
    for (const link of [attachmentLink, folderLink]) {
      expect(link.getAttribute("href")).toBe(raw)
      expect(link.href).toBe(new URL(raw).href)
      expect(link).toHaveAttribute("target", "_blank")
      expect(link).toHaveAttribute("rel", "noopener noreferrer")
    }
  })

  it("renders the Google Drive action only for a provided folder URL with safe attributes", () => {
    const googleDriveFolderUrl = "https://drive.google.com/drive/folders/shared"
    const { rerender } = renderFilesTab({ googleDriveFolderUrl })

    const link = screen.getByRole("link", { name: "Mở thư mục chung" })
    expect(link).toHaveAttribute("href", googleDriveFolderUrl)
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")

    rerender(
      <EquipmentDetailFilesTab
        attachments={[]}
        isLoading={false}
        googleDriveFolderUrl={null}
        onAddAttachment={vi.fn().mockResolvedValue(undefined)}
        onDeleteAttachment={vi.fn().mockResolvedValue(undefined)}
        isAdding={false}
        isDeleting={false}
      />
    )

    expect(screen.queryByRole("link", { name: "Mở thư mục chung" })).not.toBeInTheDocument()
  })
})
