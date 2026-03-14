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
    const { container } = render(
      <AssistantMarkdownRenderer content={"```\nSELECT 1;\n```"} />
    )

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
})
