import { useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { UrlDocumentForm } from "../UrlDocumentForm"
import { isAllowedDocumentUrl, parseAbsoluteUrl } from "../url-document-utils"

function ValidationHarness({
  initialUrl,
  onPersist,
}: {
  initialUrl: string
  onPersist: (values: { name: string; url: string }) => void
}) {
  const [name, setName] = useState("Thông số kỹ thuật")
  const [url, setUrl] = useState(initialUrl)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = () => {
    const parsed = parseAbsoluteUrl(url)
    if (!isAllowedDocumentUrl(parsed)) {
      setValidationError("URL tài liệu không hợp lệ.")
      return
    }

    setValidationError(null)
    onPersist({ name, url })
  }

  return (
    <UrlDocumentForm
      name={name}
      url={url}
      onNameChange={setName}
      onUrlChange={setUrl}
      onSubmit={handleSubmit}
      validationError={validationError}
    />
  )
}

describe("UrlDocumentForm", () => {
  it("renders fixed accessible labels and controlled values", () => {
    render(
      <UrlDocumentForm
        name="Hồ sơ kỹ thuật"
        url="https://example.com/spec.pdf"
        onNameChange={vi.fn()}
        onUrlChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    )

    expect(screen.getByLabelText("Tên tài liệu")).toHaveValue("Hồ sơ kỹ thuật")
    expect(screen.getByLabelText("Đường dẫn (URL)"))
      .toHaveAttribute("type", "text")
      .toHaveAttribute("inputmode", "url")
      .toHaveValue("https://example.com/spec.pdf")
    expect(screen.getByRole("button", { name: "Lưu liên kết" })).toBeEnabled()
  })

  it("emits raw controlled field changes without rewriting values", () => {
    const onNameChange = vi.fn()
    const onUrlChange = vi.fn()
    const { rerender } = render(
      <UrlDocumentForm
        name=""
        url=""
        onNameChange={onNameChange}
        onUrlChange={onUrlChange}
        onSubmit={vi.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText("Tên tài liệu"), {
      target: { value: "  Hướng dẫn sử dụng  " },
    })
    fireEvent.change(screen.getByLabelText("Đường dẫn (URL)"), {
      target: { value: "  HtTpS://EXAMPLE.com/a/../spec.pdf  " },
    })

    expect(onNameChange).toHaveBeenCalledWith("  Hướng dẫn sử dụng  ")
    expect(onUrlChange).toHaveBeenCalledWith("  HtTpS://EXAMPLE.com/a/../spec.pdf  ")
    expect(screen.getByLabelText("Tên tài liệu")).toHaveValue("")
    expect(screen.getByLabelText("Đường dẫn (URL)")).toHaveValue("")

    rerender(
      <UrlDocumentForm
        name="  Hướng dẫn sử dụng  "
        url="  HtTpS://EXAMPLE.com/a/../spec.pdf  "
        onNameChange={onNameChange}
        onUrlChange={onUrlChange}
        onSubmit={vi.fn()}
      />
    )

    expect(screen.getByLabelText("Tên tài liệu")).toHaveValue("  Hướng dẫn sử dụng  ")
    expect(screen.getByLabelText("Đường dẫn (URL)")).toHaveValue(
      "  HtTpS://EXAMPLE.com/a/../spec.pdf  "
    )
  })

  it("uses unique IDs and keeps each label associated when multiple forms are mounted", () => {
    const { container } = render(
      <>
        <UrlDocumentForm
          name="Biểu mẫu thứ nhất"
          url="https://example.com/first.pdf"
          onNameChange={vi.fn()}
          onUrlChange={vi.fn()}
          onSubmit={vi.fn()}
        />
        <UrlDocumentForm
          name="Biểu mẫu thứ hai"
          url="https://example.com/second.pdf"
          onNameChange={vi.fn()}
          onUrlChange={vi.fn()}
          onSubmit={vi.fn()}
        />
      </>
    )

    const forms = Array.from(container.querySelectorAll("form"))
    expect(forms).toHaveLength(2)

    const [firstNameInput, firstUrlInput] = Array.from(forms[0].querySelectorAll("input"))
    const [secondNameInput, secondUrlInput] = Array.from(forms[1].querySelectorAll("input"))
    const firstLabels = Array.from(forms[0].querySelectorAll("label"))
    const secondLabels = Array.from(forms[1].querySelectorAll("label"))

    expect(firstNameInput.id).not.toBe(secondNameInput.id)
    expect(firstUrlInput.id).not.toBe(secondUrlInput.id)
    expect(firstLabels[0]).toHaveAttribute("for", firstNameInput.id)
    expect(firstLabels[1]).toHaveAttribute("for", firstUrlInput.id)
    expect(secondLabels[0]).toHaveAttribute("for", secondNameInput.id)
    expect(secondLabels[1]).toHaveAttribute("for", secondUrlInput.id)
  })

  it("prevents native submission and emits onSubmit exactly once", () => {
    const onSubmit = vi.fn()
    render(
      <UrlDocumentForm
        name="Hồ sơ kỹ thuật"
        url="https://example.com/spec.pdf"
        onNameChange={vi.fn()}
        onUrlChange={vi.fn()}
        onSubmit={onSubmit}
      />
    )

    const form = screen.getByRole("button", { name: "Lưu liên kết" }).closest("form")
    expect(form).not.toBeNull()
    expect(fireEvent.submit(form!)).toBe(false)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith()
  })

  it("uses a custom submit label", () => {
    render(
      <UrlDocumentForm
        name=""
        url=""
        onNameChange={vi.fn()}
        onUrlChange={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Cập nhật tài liệu"
      />
    )

    expect(screen.getByRole("button", { name: "Cập nhật tài liệu" })).toBeInTheDocument()
  })

  it.each([
    { state: "pending", props: { isPending: true } },
    { state: "disabled", props: { disabled: true } },
  ])("disables all controls when $state", ({ props }) => {
    const { container } = render(
      <UrlDocumentForm
        name="Hồ sơ kỹ thuật"
        url="https://example.com/spec.pdf"
        onNameChange={vi.fn()}
        onUrlChange={vi.fn()}
        onSubmit={vi.fn()}
        {...props}
      />
    )

    expect(screen.getByLabelText("Tên tài liệu")).toBeDisabled()
    expect(screen.getByLabelText("Đường dẫn (URL)")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Lưu liên kết" })).toBeDisabled()

    if ("isPending" in props) {
      expect(screen.getByRole("button", { name: "Lưu liên kết" })).toHaveAttribute(
        "aria-busy",
        "true"
      )
      expect(screen.getByRole("status")).toHaveTextContent("Đang lưu tài liệu.")
      expect(container.querySelector("svg.animate-spin")).toBeInTheDocument()
    }
  })

  it("associates an inline alert with the URL input", () => {
    render(
      <UrlDocumentForm
        name="Hồ sơ kỹ thuật"
        url="not-a-url"
        onNameChange={vi.fn()}
        onUrlChange={vi.fn()}
        onSubmit={vi.fn()}
        validationError="URL tài liệu không hợp lệ."
      />
    )

    const urlInput = screen.getByLabelText("Đường dẫn (URL)")
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("URL tài liệu không hợp lệ.")
    expect(alert).toHaveAttribute("id")
    expect(urlInput).toHaveAttribute("aria-invalid", "true")
    expect(urlInput).toHaveAttribute("aria-describedby", alert.id)
  })

  it.each(["không-phải-url", "ftp://example.com/spec.pdf"])(
    "lets the consumer reject %s without calling persistence",
    async (initialUrl) => {
      const onPersist = vi.fn()
      render(<ValidationHarness initialUrl={initialUrl} onPersist={onPersist} />)

      const urlInput = screen.getByLabelText("Đường dẫn (URL)")
      expect(urlInput.checkValidity()).toBe(true)
      await userEvent.setup().click(screen.getByRole("button", { name: "Lưu liên kết" }))

      expect(await screen.findByRole("alert")).toHaveTextContent("URL tài liệu không hợp lệ.")
      expect(onPersist).not.toHaveBeenCalled()
    }
  )

  it("preserves an accepted raw URL through the controlled consumer callback", async () => {
    const raw = "HtTpS://EXAMPLE.com/a/../spec.pdf"
    const onPersist = vi.fn()
    render(<ValidationHarness initialUrl={raw} onPersist={onPersist} />)

    await userEvent.setup().click(screen.getByRole("button", { name: "Lưu liên kết" }))

    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledWith({
        name: "Thông số kỹ thuật",
        url: raw,
      })
    })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
