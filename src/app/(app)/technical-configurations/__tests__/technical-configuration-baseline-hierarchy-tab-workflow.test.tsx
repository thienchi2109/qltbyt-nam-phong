import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"
import { within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"

import {
  baselineVersionsResponse,
  createDraft,
  createLockedVersion,
  dossier,
  getBaselineRpcMock,
  mockVersions,
  renderTab,
} from "./technical-configuration-baseline-tab-fixtures"

const rpc = getBaselineRpcMock()

function createSubgroupOnlyDraft() {
  const draft = createDraft()
  const directCriterion = draft.groups[0].criteria[0]
  const firstGroup = draft.groups[0]

  return createDraft({
    groups: [
      {
        ...firstGroup,
        criteria: [],
        subgroups: [
          {
            id: "subgroup-1",
            baseline_version_id: draft.id,
            group_id: firstGroup.id,
            name: "Hạ tầng",
            sort_order: 1,
            created_at: firstGroup.created_at,
            created_by: firstGroup.created_by,
            updated_at: firstGroup.updated_at,
            updated_by: firstGroup.updated_by,
            criteria: [{ ...directCriterion, subgroup_id: "subgroup-1" }],
          },
        ],
      },
      ...draft.groups.slice(1),
    ],
  })
}

describe("technical configuration baseline hierarchy tab workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getDossier.mockResolvedValue({ data: dossier })
  })

  it("mounts production authoring and allows locking a subgroup-only criterion draft", async () => {
    const user = userEvent.setup()
    const draft = createSubgroupOnlyDraft()
    mockVersions([draft])
    rpc.lockVersion.mockResolvedValue({ data: createLockedVersion() })

    renderTab()

    expect(await screen.findByDisplayValue("Hạ tầng")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Thao tác cho nhóm I" })).toBeEnabled()
    await user.click(screen.getByRole("button", { name: /Thao tác cho tiêu chí/i }))
    expect(await screen.findByRole("menuitem", { name: "Chuyển đến..." })).toBeInTheDocument()
    await user.keyboard("{Escape}")

    await user.click(screen.getByRole("button", { name: "Thao tác phiên bản" }))
    const lockAction = screen.getByRole("menuitem", { name: "Khóa phiên bản" })
    expect(lockAction).not.toHaveAttribute("data-disabled")
    await user.click(lockAction)
    await user.click(screen.getByRole("button", { name: "Khóa vĩnh viễn" }))

    expect(rpc.lockVersion).toHaveBeenCalledWith({
      p_baseline_version_id: draft.id,
      p_expected_revision: draft.revision,
    })
  })

  it("blocks lock for hierarchy drafts with dirty or pending input", async () => {
    const user = userEvent.setup()
    const draft = createSubgroupOnlyDraft()
    mockVersions([draft])

    renderTab()

    const groupName = await screen.findByDisplayValue("Yêu cầu chung")
    await user.type(groupName, " đã sửa")
    await user.click(screen.getByRole("button", { name: "Thao tác phiên bản" }))
    expect(screen.getByRole("menuitem", { name: "Khóa phiên bản" })).toHaveAttribute(
      "data-disabled"
    )
    expect(screen.getByText("Lưu thay đổi trước khi khóa phiên bản.")).toBeInTheDocument()
    await user.keyboard("{Escape}")

    await user.clear(groupName)
    await user.type(groupName, "Yêu cầu chung")
    await user.click(
      screen.getByRole("button", {
        name: "Nhập nhiều dòng cho nhóm I: Yêu cầu chung",
      })
    )
    await user.type(screen.getByRole("textbox", { name: "Nội dung nhập nhanh" }), "Đang chờ")

    await user.click(screen.getByRole("button", { name: "Thao tác phiên bản" }))
    expect(screen.getByRole("menuitem", { name: "Khóa phiên bản" })).toHaveAttribute(
      "data-disabled"
    )
    expect(
      screen.getByText("Hoàn tất hoặc hủy nội dung nhập nhanh trước khi khóa.")
    ).toBeInTheDocument()
  })

  it("reloads a concurrently locked hierarchy snapshot into read-only history", async () => {
    const user = userEvent.setup()
    const draft = createSubgroupOnlyDraft()
    const locked = createLockedVersion({
      id: draft.id,
      groups: draft.groups,
    })
    mockVersions([draft])
    rpc.lockVersion.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, { message: "locked_version" })
    )

    renderTab()
    await screen.findByDisplayValue("Hạ tầng")
    await user.click(screen.getByRole("button", { name: "Thao tác phiên bản" }))
    await user.click(screen.getByRole("menuitem", { name: "Khóa phiên bản" }))
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Khóa vĩnh viễn",
      })
    )

    expect(await screen.findByText("Xung đột dữ liệu")).toBeInTheDocument()
    rpc.listVersions.mockResolvedValueOnce(baselineVersionsResponse([locked]))
    await user.click(screen.getByRole("button", { name: "Tải lại từ máy chủ" }))

    expect(
      await screen.findByRole("region", { name: "Nội dung phiên bản đã khóa" })
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId("technical-configuration-locked-report-body")).getByRole(
        "heading",
        { name: "Hạ tầng" }
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })
})
