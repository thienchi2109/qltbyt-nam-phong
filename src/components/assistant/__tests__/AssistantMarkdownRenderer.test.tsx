import * as React from "react"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AssistantMarkdownRenderer } from "../AssistantMarkdownRenderer"

describe("AssistantMarkdownRenderer", () => {
  it("renders inline code as inline chip style", () => {
    const { container } = render(
      <AssistantMarkdownRenderer content={"Đây là `mã inline` để kiểm tra."} />
    )

    const code = container.querySelector("code")
    expect(code).toBeInTheDocument()
    expect(code).toHaveTextContent("mã inline")
    expect(code).toHaveClass("bg-muted/60")
    expect(code).not.toHaveClass("block")
  })

  it("renders fenced code blocks without language as block code", () => {
    const { container } = render(<AssistantMarkdownRenderer content={"```\nSELECT 1;\n```"} />)

    const code = container.querySelector("code")
    expect(code).toBeInTheDocument()
    expect(code).toHaveTextContent("SELECT 1;")
    expect(code).toHaveClass("block")
    expect(code).toHaveClass("overflow-x-auto")
  })

  it("keeps language class and block style for fenced code with language", () => {
    const { container } = render(
      <AssistantMarkdownRenderer content={"```sql\nSELECT * FROM thiet_bi;\n```"} />
    )

    const code = container.querySelector("code")
    expect(code).toBeInTheDocument()
    expect(code).toHaveClass("language-sql")
    expect(code).toHaveClass("block")
  })

  it("renders streamed-table content with safe cells and a mobile overflow contract", () => {
    const hostileCell = '<img src=x onerror="alert(1)">'
    const content = [
      "| Thiết bị | Tình trạng | Ghi chú |",
      "| --- | --- | --- |",
      "| Máy siêu âm | Hoạt động | Chưa có dữ liệu |",
      `| Máy X\\|Y | Hỏng | ${hostileCell} |`,
    ].join("\n")

    const { container } = render(<AssistantMarkdownRenderer content={content} />)
    const scrollContainer = container.querySelector("div.overflow-x-auto")
    const table = scrollContainer?.querySelector("table")

    expect(scrollContainer).toHaveClass("min-w-0")
    expect(table).toBeInTheDocument()
    expect(table?.querySelectorAll("thead th")).toHaveLength(3)
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(2)
    expect(
      Array.from(table?.querySelectorAll("tbody tr") ?? []).every(
        (row) => row.querySelectorAll("td").length === 3,
      ),
    ).toBe(true)
    expect(table).toHaveTextContent("Máy X|Y")
    expect(table).toHaveTextContent("Chưa có dữ liệu")
    expect(table).toHaveTextContent("Hỏng")
    expect(container.querySelector("img")).not.toBeInTheDocument()
    expect(container.querySelector("[onerror]")).not.toBeInTheDocument()
  })
})
