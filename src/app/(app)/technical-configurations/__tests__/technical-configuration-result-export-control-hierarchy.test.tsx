import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationResultExportControl } from "../_components/evaluation/TechnicalConfigurationResultExportControl"
import {
  createBaselineGroups,
  createOption,
} from "./technical-configuration-evaluation-workspace.test-support"

const mocks = vi.hoisted(() => ({
  reset: vi.fn(),
  retry: vi.fn(),
  startExport: vi.fn(),
}))

vi.mock("../_hooks/useTechnicalConfigurationResultExport", () => ({
  useTechnicalConfigurationResultExport: () => ({
    status: "idle",
    error: null,
    reset: mocks.reset,
    retry: mocks.retry,
    startExport: mocks.startExport,
  }),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        full_name: "Nguyễn Văn A",
      },
    },
  }),
}))

describe("TechnicalConfigurationResultExportControl hierarchy scope", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("counts subgroup criteria in the all-criteria export scope", async () => {
    const user = userEvent.setup()
    const baselineGroups = createBaselineGroups()
    const group = baselineGroups[0]
    if (!group) throw new Error("Expected baseline group fixture.")
    const subgroupCriterion = {
      ...group.criteria[0],
      id: "criterion-4",
      subgroup_id: "subgroup-1",
      criterion_code: "TC-04",
      sort_order: 4,
    }
    group.subgroups = [
      {
        id: "subgroup-1",
        baseline_version_id: "baseline-1",
        group_id: group.id,
        name: "Phân nhóm 1",
        sort_order: 1,
        created_at: "2026-07-30T00:00:00.000Z",
        created_by: 1,
        updated_at: "2026-07-30T00:00:00.000Z",
        updated_by: 1,
        criteria: [subgroupCriterion],
      },
    ]

    render(
      <TechnicalConfigurationResultExportControl
        dossierId="dossier-1"
        baselineVersionId="baseline-1"
        baselineRevision={3}
        options={[createOption("option-1", "Nhà cung cấp A · Model A")]}
        baselineGroups={baselineGroups}
        activeOptionId="option-1"
        currentCriteria={[{ criterion: { id: "criterion-1" } }]}
      />
    )

    await user.click(screen.getByRole("button", { name: "Xuất kết quả Excel" }))

    expect(screen.getByRole("radio", { name: "Tất cả 4 tiêu chí" })).toBeInTheDocument()
  })
})
