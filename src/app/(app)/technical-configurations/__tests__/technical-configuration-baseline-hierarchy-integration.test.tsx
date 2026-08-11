import "@testing-library/jest-dom"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  baselineVersionsResponse,
  createDraft,
  criterionMutation,
  dossier,
  getBaselineRpcMock,
  groupMutation,
  renderTab,
} from "./technical-configuration-baseline-tab-fixtures"

const rpc = getBaselineRpcMock()

describe("technical configuration baseline hierarchy integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listVersions.mockReset()
    rpc.getDossier.mockResolvedValue({ data: dossier })
    rpc.listVersions.mockResolvedValue(baselineVersionsResponse([createDraft()]))
  })

  it("renders server groups and stages multiline, add, and reorder changes without autosave", async () => {
    const user = userEvent.setup()
    renderTab()

    expect(await screen.findByDisplayValue("Yêu cầu chung")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Yêu cầu cấu hình cung cấp")).toBeInTheDocument()
    expect(screen.getAllByRole("region", { name: /Nhóm tiêu chí/ })).toHaveLength(4)
    expect(
      screen.getByRole("button", { name: "Thu gọn nhóm III: Yêu cầu kỹ thuật" })
    ).toHaveAttribute("aria-expanded", "true")

    const requirement = screen.getByLabelText("Nội dung yêu cầu tiêu chí trực tiếp 1 của nhóm I")
    await user.clear(requirement)
    await user.type(requirement, "Nguồn điện ổn định\n220V - 50Hz")
    await user.click(screen.getByRole("button", { name: "Thêm tiêu chí vào nhóm I" }))
    await user.click(screen.getByRole("button", { name: "Di chuyển nhóm IV lên" }))

    expect(screen.getByLabelText("Nội dung yêu cầu tiêu chí trực tiếp 1 của nhóm I")).toHaveValue(
      "Nguồn điện ổn định\n220V - 50Hz"
    )
    expect(screen.getByText("Có thay đổi chưa lưu")).toBeInTheDocument()
    expect(rpc.updateCriterion).not.toHaveBeenCalled()
    expect(rpc.createCriterion).not.toHaveBeenCalled()
    expect(rpc.reorderGroups).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Thêm nhóm" }))
    expect(screen.getByLabelText("Tên nhóm V")).toHaveFocus()
  })

  it("keeps bulk preview and accept local until explicit save", async () => {
    const user = userEvent.setup()
    rpc.createCriterion
      .mockResolvedValueOnce({
        data: criterionMutation("criterion-2", "TC-0002", "group-2", "Nguồn điện ổn định", 1, 5),
      })
      .mockResolvedValueOnce({
        data: criterionMutation(
          "criterion-3",
          "TC-0003",
          "group-2",
          "Áp lực vận hành ≥ 3 bar",
          2,
          6
        ),
      })
    renderTab()

    const secondGroup = await screen.findByRole("region", { name: "Nhóm tiêu chí II" })
    await user.click(within(secondGroup).getByRole("button", { name: /Nhập nhiều dòng/ }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.type(
      within(secondGroup).getByLabelText("Nội dung nhập nhanh"),
      "Nguồn điện ổn định\nÁp lực vận hành ≥ 3 bar"
    )
    await user.click(within(secondGroup).getByRole("button", { name: "Xem trước" }))
    await user.click(within(secondGroup).getByRole("button", { name: "Thêm vào bản nháp" }))

    for (const mutation of [
      rpc.createGroup,
      rpc.updateGroup,
      rpc.deleteGroup,
      rpc.reorderGroups,
      rpc.createCriterion,
      rpc.updateCriterion,
      rpc.deleteCriterion,
      rpc.reorderCriteria,
      rpc.previewBulk,
    ]) {
      expect(mutation).not.toHaveBeenCalled()
    }

    await user.click(screen.getByRole("button", { name: "Lưu" }))

    await waitFor(() => expect(rpc.createCriterion).toHaveBeenCalledTimes(2))
    expect(rpc.createCriterion).toHaveBeenNthCalledWith(1, {
      p_group_id: "group-2",
      p_title: null,
      p_requirement_text: "Nguồn điện ổn định",
      p_expected_revision: 4,
    })
    expect(rpc.createCriterion).toHaveBeenNthCalledWith(2, {
      p_group_id: "group-2",
      p_title: null,
      p_requirement_text: "Áp lực vận hành ≥ 3 bar",
      p_expected_revision: 5,
    })
    expect(rpc.previewBulk).not.toHaveBeenCalled()
    expect(await screen.findByText("Đã lưu")).toBeInTheDocument()
  })

  it("preserves the selected new group when save replaces its client key with a server id", async () => {
    const user = userEvent.setup()
    rpc.createGroup.mockResolvedValue({
      data: {
        ...groupMutation(5, "Nhóm mới"),
        id: "group-5",
        sort_order: 5,
      },
    })
    renderTab()

    await user.click(await screen.findByRole("button", { name: "Thêm nhóm" }))
    await user.type(screen.getByLabelText("Tên nhóm V"), "Nhóm mới")
    await user.click(screen.getByRole("button", { name: "Lưu" }))

    expect(await screen.findByText("Đã lưu")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Thu gọn nhóm V: Nhóm mới" })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
    expect(screen.getByDisplayValue("Nhóm mới")).toBeInTheDocument()
  })

  it("preserves accepted-row highlights across unrelated criterion actions", async () => {
    const user = userEvent.setup()
    const { container } = renderTab()

    const firstGroup = await screen.findByRole("region", { name: "Nhóm tiêu chí I" })
    await user.click(within(firstGroup).getByRole("button", { name: /Nhập nhiều dòng/ }))
    await user.type(
      within(firstGroup).getByLabelText("Nội dung nhập nhanh"),
      "Yêu cầu mới 1\nYêu cầu mới 2"
    )
    await user.click(within(firstGroup).getByRole("button", { name: "Xem trước" }))
    await user.click(within(firstGroup).getByRole("button", { name: "Thêm vào bản nháp" }))

    expect(container.querySelectorAll('[data-recently-accepted="true"]')).toHaveLength(2)

    await user.click(screen.getByRole("button", { name: "Thêm tiêu chí vào nhóm I" }))
    expect(container.querySelectorAll('[data-recently-accepted="true"]')).toHaveLength(2)

    await user.click(screen.getByRole("button", { name: "Xóa tiêu chí trực tiếp 1 của nhóm I" }))
    expect(container.querySelectorAll('[data-recently-accepted="true"]')).toHaveLength(2)
  })
})
