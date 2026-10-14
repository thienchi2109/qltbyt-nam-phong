import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { EquipmentDatasetTabs } from "../_components/EquipmentDatasetTabs"

describe("EquipmentDatasetTabs", () => {
  it("renders both Vietnamese labels and reports dataset changes", async () => {
    const onDatasetChange = vi.fn()
    const user = userEvent.setup()
    render(<EquipmentDatasetTabs dataset="regular" onDatasetChange={onDatasetChange} />)

    expect(screen.getByRole("tab", { name: "Thiết bị thường" })).toBeVisible()
    expect(screen.getByRole("tab", { name: "Thiết bị đặt" })).toBeVisible()

    await user.click(screen.getByRole("tab", { name: "Thiết bị đặt" }))
    expect(onDatasetChange).toHaveBeenCalledWith("placed")
  })
})
