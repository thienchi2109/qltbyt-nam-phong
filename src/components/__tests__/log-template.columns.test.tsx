import * as React from "react"
import { render, screen, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/form-branding-header", () => ({
  FormBrandingHeader: () => <div data-testid="branding-header" />,
}))

import { LogTemplate } from "../log-template"

describe("LogTemplate", () => {
  it("renders split status columns with narrower existing widths for print layout", () => {
    render(
      <LogTemplate
        usageLogs={[
          {
            dateTime: "08:30 - 12/07/2025",
            user: "BS. Nguyễn Thị Bình",
            initialCondition: "Tốt",
            finalCondition: "Cần theo dõi",
            note: "Xét nghiệm máu thường quy",
          },
        ]}
      />
    )

    const headerRow = screen.getAllByRole("row")[0]
    const headers = within(headerRow).getAllByRole("columnheader")

    expect(headers).toHaveLength(5)
    expect(headers[0]).toHaveTextContent("Ngày, giờ sử dụng")
    expect(headers[0]).toHaveStyle({ width: "18%" })
    expect(headers[1]).toHaveTextContent("Người sử dụng")
    expect(headers[1]).toHaveStyle({ width: "18%" })
    expect(headers[2]).toHaveTextContent("Tình trạng bắt đầu")
    expect(headers[2]).toHaveStyle({ width: "16%" })
    expect(headers[3]).toHaveTextContent("Tình trạng kết thúc")
    expect(headers[3]).toHaveStyle({ width: "16%" })
    expect(headers[4]).toHaveTextContent("Ghi chú")
    expect(headers[4]).toHaveStyle({ width: "32%" })

    expect(screen.getByText("Tốt")).toBeInTheDocument()
    expect(screen.getByText("Cần theo dõi")).toBeInTheDocument()
  })
})
