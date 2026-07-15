import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { UrlDocumentList, type UrlDocumentItem } from "../UrlDocumentList"

const documentItem: UrlDocumentItem = {
  id: "document-1",
  name: "Hồ sơ kỹ thuật",
  url: "https://example.com/spec.pdf",
}

describe("UrlDocumentList", () => {
  it("shows loading skeletons instead of empty or populated content", () => {
    const { container } = render(
      <UrlDocumentList items={[documentItem]} isLoading emptyMessage="Chưa có hồ sơ." />
    )

    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-busy", "true")
    expect(status).toHaveTextContent("Đang tải tài liệu.")
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3)
    expect(screen.queryByText("Chưa có hồ sơ.")).not.toBeInTheDocument()
    expect(screen.queryByText(documentItem.name)).not.toBeInTheDocument()
  })

  it("shows the configured empty message only after loading", () => {
    render(<UrlDocumentList items={[]} isLoading={false} emptyMessage="Chưa có hồ sơ." />)

    expect(screen.getByText("Chưa có hồ sơ.")).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it.each([
    ["HTTP", "http://example.com/spec.pdf"],
    ["HTTPS", "https://example.com/spec.pdf"],
  ])("renders a valid %s document as a safe external link", (name, url) => {
    render(<UrlDocumentList items={[{ id: name, name, url }]} isLoading={false} />)

    const link = screen.getByRole("link", { name })
    expect(link).toHaveAttribute("href", url)
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it.each([
    ["malformed", "không-phải-url"],
    ["relative", "/documents/spec.pdf"],
    ["scheme-relative", "//example.com/spec.pdf"],
    ["protocol-only", "https:example.com"],
    ["single-slash", "https:/example.com"],
    ["one-backslash", String.raw`https:\example.com`],
    ["two-backslashes", String.raw`https:\\example.com`],
    ["ftp", "ftp://example.com/spec.pdf"],
    ["mailto", "mailto:owner@example.com"],
    ["blob", "blob:https://example.com/document-id"],
    ["javascript", "javascript:alert(1)"],
    ["data", "data:text/plain,specification"],
    ["file", "file:///tmp/spec.pdf"],
  ])("renders the %s item name without any fallback link", (name, url) => {
    const { container } = render(
      <UrlDocumentList items={[{ id: name, name, url }]} isLoading={false} />
    )

    expect(screen.getByText(name)).toBeInTheDocument()
    expect(screen.queryByRole("link", { name })).not.toBeInTheDocument()
    expect(container.querySelector("a")).not.toBeInTheDocument()
    expect(container.querySelector('[href="#"]')).not.toBeInTheDocument()
  })

  it("preserves the raw mixed-case URL attribute and resolved destination", () => {
    const raw = "HtTpS://EXAMPLE.com/a/../spec.pdf"
    render(
      <UrlDocumentList
        items={[{ id: "mixed-case", name: "Mixed case", url: raw }]}
        isLoading={false}
      />
    )

    const link = screen.getByRole("link", { name: "Mixed case" }) as HTMLAnchorElement
    expect(link.getAttribute("href")).toBe(raw)
    expect(link.href).toBe(new URL(raw).href)
  })

  it("emits the canonical ID without owning confirmation policy", () => {
    const onDelete = vi.fn()
    const confirmSpy = vi.spyOn(window, "confirm")
    render(<UrlDocumentList items={[documentItem]} isLoading={false} onDelete={onDelete} />)

    const deleteButton = screen.getByRole("button", {
      name: `Xóa ${documentItem.name}`,
    })
    expect(deleteButton).toHaveAttribute("type", "button")
    fireEvent.click(deleteButton)

    expect(onDelete).toHaveBeenCalledWith(documentItem.id)
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it("disables all delete actions while one item is deleting and labels the pending item", () => {
    const secondItem: UrlDocumentItem = {
      id: "document-2",
      name: "Hướng dẫn sử dụng",
      url: "https://example.com/manual.pdf",
    }
    const { container } = render(
      <UrlDocumentList
        items={[documentItem, secondItem]}
        isLoading={false}
        onDelete={vi.fn()}
        deletingId={documentItem.id}
      />
    )

    expect(
      screen.getByRole("button", {
        name: `Đang xóa ${documentItem.name}`,
      })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", {
        name: `Xóa ${secondItem.name}`,
      })
    ).toBeDisabled()
    expect(container.querySelector("svg.animate-spin")).toBeInTheDocument()
  })

  it("disables delete actions when the list is disabled", () => {
    render(<UrlDocumentList items={[documentItem]} isLoading={false} onDelete={vi.fn()} disabled />)

    expect(
      screen.getByRole("button", {
        name: `Xóa ${documentItem.name}`,
      })
    ).toBeDisabled()
  })

  it("does not submit an outer form when delete is clicked", () => {
    const onDelete = vi.fn()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <UrlDocumentList items={[documentItem]} isLoading={false} onDelete={onDelete} />
      </form>
    )

    fireEvent.click(
      screen.getByRole("button", {
        name: `Xóa ${documentItem.name}`,
      })
    )

    expect(onDelete).toHaveBeenCalledWith(documentItem.id)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
