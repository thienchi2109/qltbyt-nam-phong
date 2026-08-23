import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import AccessDeniedPage from "../page"

describe("AccessDeniedPage", () => {
  it("explains the denial and provides a safe route back to the dashboard", () => {
    render(<AccessDeniedPage />)

    expect(screen.getByRole("heading", { name: "Truy cập bị hạn chế" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Về trang tổng quan" })).toHaveAttribute(
      "href",
      "/dashboard"
    )
  })
})
