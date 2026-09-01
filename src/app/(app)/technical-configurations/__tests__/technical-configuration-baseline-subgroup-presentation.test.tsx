import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import {
  HierarchyHarness,
  hierarchyDraft,
  installSubgroupPresentationScrollMock,
  restoreSubgroupPresentationScrollMock,
  scrollIntoViewMock,
} from "./technical-configuration-baseline-subgroup-presentation-fixtures"

beforeEach(() => {
  installSubgroupPresentationScrollMock()
})

afterAll(() => {
  restoreSubgroupPresentationScrollMock()
})

describe("technical configuration baseline subgroup presentation", () => {
  it("renders the canonical section, direct criterion, subgroup, and subgroup criterion order", () => {
    render(<HierarchyHarness />)

    const sectionName = screen.getByLabelText("Tên nhóm I")
    const directRequirement = screen.getByLabelText(
      "Nội dung yêu cầu tiêu chí trực tiếp 1 của nhóm I"
    )
    const subgroupDisclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm con 1 của nhóm I: Hạ tầng",
    })
    const subgroupRequirement = screen.getByLabelText(
      "Nội dung yêu cầu tiêu chí 1 của nhóm con 1, nhóm I"
    )

    expect(sectionName.compareDocumentPosition(directRequirement)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(directRequirement.compareDocumentPosition(subgroupDisclosure)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(subgroupDisclosure.compareDocumentPosition(subgroupRequirement)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(
      screen.getByRole("region", { name: "Nhóm con 1 của nhóm I: Hạ tầng" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Thu gọn nhóm II: Yêu cầu bổ sung" })
    ).toBeInTheDocument()
    expect(screen.queryByLabelText("Nội dung yêu cầu 1.1")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Nội dung yêu cầu 1.1.1")).not.toBeInTheDocument()
  })

  it("presents group, subgroup, and criterion levels as one indented tree-grid", () => {
    render(<HierarchyHarness />)

    const groupRegion = screen.getByRole("region", { name: "Nhóm tiêu chí I" })
    const subgroupRegion = screen.getByRole("region", {
      name: "Nhóm con 1 của nhóm I: Hạ tầng",
    })
    const directRow = screen.getByTestId("criterion-row-criterion-direct")
    const subgroupRow = screen.getByTestId("criterion-row-criterion-subgroup")

    expect(groupRegion).toHaveAttribute("data-hierarchy-level", "group")
    expect(subgroupRegion).toHaveAttribute("data-hierarchy-level", "subgroup")
    expect(subgroupRegion).toHaveClass("ml-6", "border-l")
    expect(screen.getByText("I.1")).toBeInTheDocument()
    expect(directRow).toHaveAttribute("data-owner-kind", "group")
    expect(subgroupRow).toHaveAttribute("data-owner-kind", "subgroup")
    expect(directRow).toHaveAttribute("data-grid-template")
    expect(subgroupRow).toHaveAttribute(
      "data-grid-template",
      directRow.getAttribute("data-grid-template")
    )
    expect(screen.queryByText("Vị trí")).not.toBeInTheDocument()
    expect(screen.queryByText("Hợp lệ")).not.toBeInTheDocument()
  })

  it("renders stable criterion drop zones for empty group and subgroup owners", () => {
    render(
      <HierarchyHarness
        draft={{
          ...hierarchyDraft,
          groups: [
            {
              ...hierarchyDraft.groups[0],
              criteria: [],
              subgroups: [{ ...hierarchyDraft.groups[0].subgroups![0], criteria: [] }],
            },
          ],
        }}
      />
    )

    const groupDropZone = screen.getByTestId("criterion-drop-zone-group-section-a")
    const subgroupDropZone = screen.getByTestId("criterion-drop-zone-subgroup-subgroup-a")

    expect(groupDropZone).toHaveAttribute("data-owner-kind", "group")
    expect(groupDropZone).toHaveAttribute("data-owner-group-key", "section-a")
    expect(groupDropZone).toHaveAttribute("data-drop-slot", "criterion")
    expect(subgroupDropZone).toHaveAttribute("data-owner-kind", "subgroup")
    expect(subgroupDropZone).toHaveAttribute("data-owner-group-key", "section-a")
    expect(subgroupDropZone).toHaveAttribute("data-owner-subgroup-key", "subgroup-a")
    expect(subgroupDropZone).toHaveAttribute("data-drop-slot", "criterion")
  })

  it("keeps section and subgroup disclosure independent with native keyboard controls", async () => {
    const user = userEvent.setup()
    render(<HierarchyHarness />)

    const sectionDisclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm I: Yêu cầu chung",
    })
    const subgroupDisclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm con 1 của nhóm I: Hạ tầng",
    })

    subgroupDisclosure.focus()
    await user.keyboard("{Enter}")

    expect(subgroupDisclosure).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.getByLabelText("Nội dung yêu cầu tiêu chí trực tiếp 1 của nhóm I")
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText("Nội dung yêu cầu tiêu chí 1 của nhóm con 1, nhóm I")
    ).not.toBeInTheDocument()

    await user.click(sectionDisclosure)
    expect(sectionDisclosure).toHaveAttribute("aria-expanded", "false")
    await user.click(sectionDisclosure)

    const restoredSubgroupDisclosure = screen.getByRole("button", {
      name: "Mở rộng nhóm con 1 của nhóm I: Hạ tầng",
    })
    expect(restoredSubgroupDisclosure).toHaveAttribute("aria-expanded", "false")

    restoredSubgroupDisclosure.focus()
    await user.keyboard(" ")
    expect(restoredSubgroupDisclosure).toHaveAttribute("aria-expanded", "true")
    expect(
      screen.getByLabelText("Nội dung yêu cầu tiêu chí 1 của nhóm con 1, nhóm I")
    ).toBeInTheDocument()
  })

  it("expands both structural levels and focuses a subgroup criterion target", async () => {
    const user = userEvent.setup()
    render(<HierarchyHarness />)

    await user.click(
      screen.getByRole("button", {
        name: "Thu gọn nhóm con 1 của nhóm I: Hạ tầng",
      })
    )
    const sectionDisclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm I: Yêu cầu chung",
    })
    await user.click(sectionDisclosure)
    await user.click(screen.getByRole("button", { name: "Tập trung tiêu chí nhóm con" }))

    await waitFor(() => expect(sectionDisclosure).toHaveAttribute("aria-expanded", "true"))
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Thu gọn nhóm con 1 của nhóm I: Hạ tầng",
        })
      ).toHaveAttribute("aria-expanded", "true")
    )

    const subgroupRequirement = screen.getByLabelText(
      "Nội dung yêu cầu tiêu chí 1 của nhóm con 1, nhóm I"
    )
    await waitFor(() => expect(subgroupRequirement).toHaveFocus())
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: "nearest" })

    const subgroupDisclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm con 1 của nhóm I: Hạ tầng",
    })
    await user.click(subgroupDisclosure)
    expect(subgroupDisclosure).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.queryByLabelText("Nội dung yêu cầu tiêu chí 1 của nhóm con 1, nhóm I")
    ).not.toBeInTheDocument()

    await user.click(sectionDisclosure)
    await user.click(sectionDisclosure)
    const restoredCollapsedSubgroupDisclosure = screen.getByRole("button", {
      name: "Mở rộng nhóm con 1 của nhóm I: Hạ tầng",
    })
    expect(restoredCollapsedSubgroupDisclosure).toHaveAttribute("aria-expanded", "false")

    await user.click(screen.getByRole("button", { name: "Tập trung tiêu chí nhóm con" }))
    await waitFor(() =>
      expect(restoredCollapsedSubgroupDisclosure).toHaveAttribute("aria-expanded", "true")
    )
    await waitFor(() =>
      expect(
        screen.getByLabelText("Nội dung yêu cầu tiêu chí 1 của nhóm con 1, nhóm I")
      ).toHaveFocus()
    )
  })

  it("associates subgroup validation and renders its locked row without edit or drag affordances", () => {
    render(
      <HierarchyHarness
        validation={{
          groupErrors: {},
          subgroupErrors: { "subgroup-a": "Tên nhóm con là bắt buộc." },
          criterionErrors: {
            "criterion-subgroup": "Nội dung nhóm con là bắt buộc.",
          },
        }}
      />
    )

    const subgroupDisclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm con 1 của nhóm I: Hạ tầng",
    })
    const subgroupRequirement = screen.getByLabelText(
      "Nội dung yêu cầu tiêu chí 1 của nhóm con 1, nhóm I"
    )
    const subgroupRegion = screen.getByTestId("baseline-subgroup-subgroup-a")
    const criterionGrid = screen.getByTestId("criterion-row-criterion-subgroup")

    expect(subgroupDisclosure).toHaveAccessibleDescription("Tên nhóm con là bắt buộc.")
    expect(subgroupRequirement).toHaveAccessibleDescription("Nội dung nhóm con là bắt buộc.")
    expect(subgroupRequirement).toHaveTextContent("Có hệ thống tiếp địa riêng")
    expect(subgroupRequirement).not.toBeInstanceOf(HTMLTextAreaElement)
    expect(subgroupRegion).toHaveClass("min-w-0")
    expect(criterionGrid).toHaveAttribute("data-locked", "true")
    expect(criterionGrid).toHaveAttribute("data-owner-kind", "subgroup")
    expect(
      within(criterionGrid).queryByLabelText("Kéo để sắp xếp tiêu chí 1 của nhóm con 1, nhóm I")
    ).not.toBeInTheDocument()
    expect(within(criterionGrid).queryByRole("button")).not.toBeInTheDocument()
    expect(screen.getAllByText("2 lỗi")).toHaveLength(2)

    expect(screen.queryByRole("button", { name: /Thêm nhóm con/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Xóa nhóm con/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Di chuyển nhóm con/i })).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Thêm tiêu chí vào nhóm con/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Phản hồi|Đánh giá/i)).not.toBeInTheDocument()
  })

  it("keeps editing-disabled fields and row action controls mounted but disabled", () => {
    render(<HierarchyHarness editingDisabled />)

    expect(screen.getByRole("textbox", { name: "Tên nhóm I" })).toBeDisabled()
    expect(
      screen.getByRole("textbox", {
        name: "Nội dung yêu cầu tiêu chí trực tiếp 1 của nhóm I",
      })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", {
        name: "Thao tác cho tiêu chí trực tiếp 1 của nhóm I",
      })
    ).toBeDisabled()
    expect(screen.getByLabelText("Kéo để sắp xếp tiêu chí trực tiếp 1 của nhóm I")).toBeDisabled()
  })

  it("preserves a pending direct multiline buffer across section collapse and restore", async () => {
    const user = userEvent.setup()
    render(
      <HierarchyHarness initialMode="bulk" initialPendingInput={"Yêu cầu mới\nDòng tiếp theo"} />
    )

    const sectionDisclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm I: Yêu cầu chung",
    })
    const bulkInput = screen.getByRole("textbox", { name: "Nội dung nhập nhanh" })
    expect(bulkInput).toHaveValue("Yêu cầu mới\nDòng tiếp theo")

    await user.click(sectionDisclosure)
    expect(screen.queryByRole("textbox", { name: "Nội dung nhập nhanh" })).not.toBeInTheDocument()
    await user.click(sectionDisclosure)

    expect(screen.getByRole("textbox", { name: "Nội dung nhập nhanh" })).toHaveValue(
      "Yêu cầu mới\nDòng tiếp theo"
    )
    expect(
      screen.getByText("Hoàn tất hoặc hủy phần nhập nhiều dòng trước khi lưu.")
    ).toBeInTheDocument()
  })
})
