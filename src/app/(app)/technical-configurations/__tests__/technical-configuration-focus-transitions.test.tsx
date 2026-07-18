import "@testing-library/jest-dom"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"
import {
  baselineVersionsResponse,
  createDraft,
  getBaselineRpcMock,
  renderTab,
} from "./technical-configuration-baseline-tab-fixtures"

const rpc = getBaselineRpcMock()

describe("technical configuration focus transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listVersions.mockResolvedValue(baselineVersionsResponse([createDraft()]))
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
    rpc.listVersions.mockResolvedValueOnce(
      baselineVersionsResponse([
        { ...singleGroupDraft, groups: singleGroupDraft.groups.slice(0, 1) },
      ])
    )
    renderTab()

    await user.click(await screen.findByRole("button", { name: "Xóa nhóm 1" }))
    expect(screen.getByRole("button", { name: "Thêm nhóm" })).toHaveFocus()
  })

  it("focuses the first invalid requirement when manually returning to row mode", async () => {
    const user = userEvent.setup()
    const draft = createDraft()
    rpc.listVersions.mockResolvedValueOnce(
      baselineVersionsResponse([
        {
          ...draft,
          groups: draft.groups.map((group, index) =>
            index === 0
              ? {
                  ...group,
                  criteria: [
                    ...group.criteria,
                    {
                      ...group.criteria[0],
                      id: "criterion-2",
                      criterion_code: "TC-0002",
                      requirement_text: " ",
                      sort_order: 2,
                    },
                  ],
                }
              : group
          ),
        },
      ])
    )
    renderTab()

    await user.click(await screen.findByRole("tab", { name: "Nhập nhiều dòng" }))
    await user.click(screen.getByRole("tab", { name: "Chỉnh từng dòng" }))

    expect(screen.getByLabelText("Nội dung yêu cầu 1.2")).toHaveFocus()
  })

  it("focuses the first server group after a successful conflict reload", async () => {
    const user = userEvent.setup()
    rpc.updateGroup.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, {
        code: "PT409",
        message: "stale_revision",
      })
    )
    renderTab()

    const nameInput = await screen.findByDisplayValue("Yêu cầu chung")
    await user.clear(nameInput)
    await user.type(nameInput, "Tên đang xung đột")
    await user.click(screen.getByRole("button", { name: "Lưu" }))
    expect(await screen.findByText("Xung đột dữ liệu")).toBeInTheDocument()

    const currentDraft = createDraft()
    const reloadedDraft = createDraft({
      revision: 8,
      groups: currentDraft.groups.map((group, index) =>
        index === 0 ? { ...group, name: "Tên mới từ máy chủ" } : group
      ),
    })
    rpc.listVersions.mockResolvedValueOnce(baselineVersionsResponse([reloadedDraft]))

    await user.click(screen.getByRole("button", { name: "Tải lại từ máy chủ" }))
    await user.click(await screen.findByRole("button", { name: "Bỏ thay đổi" }))

    const firstGroupTab = await screen.findByRole("tab", { name: /Tên mới từ máy chủ/ })
    await waitFor(() => expect(firstGroupTab).toHaveFocus())

    const reloadedNameInput = screen.getByDisplayValue("Tên mới từ máy chủ")
    await user.click(reloadedNameInput)
    await user.type(reloadedNameInput, " đã sửa")
    expect(reloadedNameInput).toHaveFocus()
    expect(reloadedNameInput).toHaveValue("Tên mới từ máy chủ đã sửa")
  })

  it("reapplies focus when the same criterion receives a newer focus token", async () => {
    const user = userEvent.setup()
    renderTab()

    await user.click(await screen.findByRole("tab", { name: "Nhập nhiều dòng" }))
    await user.type(screen.getByLabelText("Nội dung nhập nhanh"), "Yêu cầu mới")
    await user.click(screen.getByRole("button", { name: "Xem trước" }))
    await user.click(screen.getByRole("button", { name: "Thêm vào bản nháp" }))

    expect(screen.getByLabelText("Nội dung yêu cầu 1.2")).toHaveFocus()
    await user.click(screen.getByRole("button", { name: "Xóa tiêu chí 1.1" }))

    await waitFor(() => expect(screen.getByLabelText("Nội dung yêu cầu 1.1")).toHaveFocus())
  })

  it("keeps focus on the activated group tab when bulk mode is preserved from overview", async () => {
    const user = userEvent.setup()
    renderTab()

    await user.click(await screen.findByRole("tab", { name: "Nhập nhiều dòng" }))
    await user.click(screen.getByRole("tab", { name: "Xem tất cả nhóm" }))

    const targetGroupTab = screen.getByRole("tab", { name: /Yêu cầu cấu hình cung cấp/ })
    await user.click(targetGroupTab)

    expect(screen.getByRole("tab", { name: "Nhập nhiều dòng" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(targetGroupTab).toHaveFocus()
  })
})
