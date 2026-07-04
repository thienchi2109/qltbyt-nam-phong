import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { RepairRequestsFilterChips } from "../_components/RepairRequestsFilterChips"

describe("RepairRequestsFilterChips", () => {
  it("lets long tenant names size naturally and wrap instead of truncating", () => {
    render(
      <RepairRequestsFilterChips
        showFacility
        value={{
          status: [],
          facilityName: "Bệnh viện Đa khoa Trung tâm Nam Phong cơ sở khám chữa bệnh mở rộng",
          dateRange: null,
        }}
        onRemove={vi.fn()}
      />
    )

    const facility = screen.getByText(
      "Cơ sở: Bệnh viện Đa khoa Trung tâm Nam Phong cơ sở khám chữa bệnh mở rộng"
    )

    expect(facility).not.toHaveClass("truncate")
    expect(facility).not.toHaveClass("max-w-[150px]")
    expect(facility).toHaveClass("whitespace-normal", "break-words")
  })
})
