import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createDraft,
  getBaselineRpcMock,
  renderTab,
} from "./technical-configuration-baseline-tab-fixtures"

const rpc = getBaselineRpcMock()

describe("technical configuration focus transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getDraft.mockResolvedValue({ data: createDraft() })
  })

  it("focuses the next group tab after deleting the selected group", async () => {
    const user = userEvent.setup()
    renderTab()

    await user.click(await screen.findByRole("tab", { name: /Yêu cầu cấu hình cung cấp/ }))
    await user.click(screen.getByRole("button", { name: "Xóa nhóm 2" }))

    const nextGroupTab = screen.getByRole("tab", { name: /Yêu cầu kỹ thuật/ })
    expect(nextGroupTab).toHaveAttribute("aria-selected", "true")
    expect(nextGroupTab).toHaveFocus()
  })

  it("focuses add criterion after deleting the final criterion", async () => {
    const user = userEvent.setup()
    renderTab()

    await user.click(await screen.findByRole("button", { name: "Xóa tiêu chí 1.1" }))
    expect(screen.getByRole("button", { name: "Thêm tiêu chí vào nhóm 1" })).toHaveFocus()
  })

  it("focuses add group after deleting the final group", async () => {
    const user = userEvent.setup()
    const singleGroupDraft = createDraft()
    rpc.getDraft.mockResolvedValueOnce({
      data: { ...singleGroupDraft, groups: singleGroupDraft.groups.slice(0, 1) },
    })
    renderTab()

    await user.click(await screen.findByRole("button", { name: "Xóa nhóm 1" }))
    expect(screen.getByRole("button", { name: "Thêm nhóm" })).toHaveFocus()
  })
})
