import "@testing-library/jest-dom"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import type {
  TechnicalConfigurationBaselineDraftWire,
  TechnicalConfigurationBaselineGroupWire,
} from "@/app/(app)/technical-configurations/baseline-types"

import { TechnicalConfigurationBaselineLockedReport } from "../_components/TechnicalConfigurationBaselineLockedReport"

const timestamp = "2026-07-13T00:00:00.000Z"

function criterion(
  id: string,
  groupId: string,
  criterionCode: string,
  title: string | null,
  sortOrder: number
): TechnicalConfigurationBaselineDraftWire["groups"][number]["criteria"][number] {
  return {
    id,
    baseline_version_id: "locked-1",
    group_id: groupId,
    subgroup_id: null,
    criterion_code: criterionCode,
    title,
    requirement_text: `Yêu cầu ${criterionCode}`,
    sort_order: sortOrder,
    source_criterion_id: null,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
  }
}

function group(
  overrides: Partial<TechnicalConfigurationBaselineGroupWire>
): TechnicalConfigurationBaselineGroupWire {
  return {
    id: "group-1",
    baseline_version_id: "locked-1",
    name: "Nhóm chưa đặt tên",
    sort_order: 1,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    criteria: [],
    ...overrides,
  }
}

function lockedVersion(
  groups: TechnicalConfigurationBaselineGroupWire[]
): TechnicalConfigurationBaselineDraftWire {
  return {
    id: "locked-1",
    dossier_id: "dossier-1",
    version_number: 2,
    status: "locked",
    source_baseline_version_id: null,
    source_version_number: null,
    next_criterion_number: 4,
    revision: 7,
    locked_at: "2026-07-14T08:30:00.000Z",
    locked_by: 42,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    groups,
  }
}

const sampleGroups = [
  group({
    id: "group-1",
    name: "Yêu cầu chung",
    criteria: [criterion("criterion-1", "group-1", "TC-0001", "Nguồn điện", 1)],
    subgroups: [
      {
        id: "subgroup-1",
        baseline_version_id: "locked-1",
        group_id: "group-1",
        name: "Nhóm con an toàn",
        sort_order: 1,
        created_at: timestamp,
        created_by: 1,
        updated_at: timestamp,
        updated_by: 1,
        criteria: [criterion("criterion-2", "group-1", "TC-0002", null, 2)],
      },
    ],
  }),
  group({
    id: "group-2",
    name: "Yêu cầu kỹ thuật",
    sort_order: 2,
    criteria: [
      criterion("criterion-3", "group-2", "TC-0003", "Độ chính xác", 1),
      criterion("criterion-4", "group-2", "TC-0004", null, 2),
    ],
  }),
]

describe("technical configuration baseline locked report", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows the first group without duplicating the version bar chrome", () => {
    render(<TechnicalConfigurationBaselineLockedReport version={lockedVersion(sampleGroups)} />)

    expect(screen.getByRole("region", { name: "Nội dung phiên bản đã khóa" })).toBeInTheDocument()
    expect(screen.queryByText("Nội dung chỉ đọc")).not.toBeInTheDocument()
    expect(screen.queryByText("Đã khóa")).not.toBeInTheDocument()
    expect(screen.queryByText(/Phiên bản/)).not.toBeInTheDocument()

    const pane = within(screen.getByTestId("technical-configuration-locked-report-body"))
    expect(pane.getByRole("heading", { name: /Yêu cầu chung/ })).toBeInTheDocument()
    expect(pane.getByText("TC-0001")).toBeInTheDocument()
    expect(pane.queryByRole("heading", { name: /Yêu cầu kỹ thuật/ })).not.toBeInTheDocument()
    expect(pane.getByText("2 tiêu chí")).toBeInTheDocument()
  })

  it("keeps the report body scrollable inside the fixed-height shell", () => {
    render(<TechnicalConfigurationBaselineLockedReport version={lockedVersion(sampleGroups)} />)

    const body = screen.getByTestId("technical-configuration-locked-report-body")
    expect(body).toHaveClass("min-h-0", "overflow-y-auto")
  })

  it("keeps the table of contents independently scrollable so long outlines cannot stretch the grid row", () => {
    render(<TechnicalConfigurationBaselineLockedReport version={lockedVersion(sampleGroups)} />)

    const toc = screen.getByRole("navigation", { name: "Mục lục nhóm" })
    expect(toc).toHaveClass("min-h-0", "overflow-y-auto")
  })

  it("lists subgroups under their parent group in the table of contents", () => {
    render(<TechnicalConfigurationBaselineLockedReport version={lockedVersion(sampleGroups)} />)

    const groupItem = screen.getByRole("button", { name: "Yêu cầu chung" }).closest("li")
    expect(groupItem).toContainElement(screen.getByRole("button", { name: "Nhóm con an toàn" }))
  })

  it("switches the reading pane when a table-of-contents group entry is activated", async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => {})

    render(<TechnicalConfigurationBaselineLockedReport version={lockedVersion(sampleGroups)} />)

    await user.click(screen.getByRole("button", { name: "Yêu cầu kỹ thuật" }))

    const pane = within(screen.getByTestId("technical-configuration-locked-report-body"))
    expect(pane.getByRole("heading", { name: /Yêu cầu kỹ thuật/ })).toBeInTheDocument()
    expect(pane.queryByRole("heading", { name: /Yêu cầu chung/ })).not.toBeInTheDocument()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it("scrolls to a subgroup inside the active pane when its table-of-contents entry is activated", async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => {})

    render(<TechnicalConfigurationBaselineLockedReport version={lockedVersion(sampleGroups)} />)

    await user.click(screen.getByRole("button", { name: "Nhóm con an toàn" }))

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    const scrolledElement = scrollIntoView.mock.contexts[0] as HTMLElement | undefined
    expect(scrolledElement?.dataset.subgroupId).toBe("subgroup-1")
  })

  it("paginates groups with previous and next controls at both ends", async () => {
    const user = userEvent.setup()

    render(<TechnicalConfigurationBaselineLockedReport version={lockedVersion(sampleGroups)} />)

    const previous = screen.getByRole("button", { name: /Nhóm trước/ })
    const next = screen.getByRole("button", { name: /Nhóm sau/ })
    expect(previous).toBeDisabled()
    expect(screen.getByText("Nhóm 1/2")).toBeInTheDocument()

    await user.click(next)

    const pane = within(screen.getByTestId("technical-configuration-locked-report-body"))
    expect(pane.getByRole("heading", { name: /Yêu cầu kỹ thuật/ })).toBeInTheDocument()
    expect(next).toBeDisabled()
    expect(previous).toBeEnabled()
    expect(screen.getByText("Nhóm 2/2")).toBeInTheDocument()

    await user.click(previous)

    expect(pane.getByRole("heading", { name: /Yêu cầu chung/ })).toBeInTheDocument()
  })

  it("marks the active table-of-contents entry as the current one", async () => {
    const user = userEvent.setup()

    render(<TechnicalConfigurationBaselineLockedReport version={lockedVersion(sampleGroups)} />)

    const firstEntry = screen.getByRole("button", { name: "Yêu cầu chung" })
    const secondEntry = screen.getByRole("button", { name: "Yêu cầu kỹ thuật" })
    expect(firstEntry).toHaveAttribute("aria-current", "true")
    expect(secondEntry).not.toHaveAttribute("aria-current")

    await user.click(secondEntry)

    expect(secondEntry).toHaveAttribute("aria-current", "true")
    expect(firstEntry).not.toHaveAttribute("aria-current")
  })
})
