import "@testing-library/jest-dom"

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TechnicalConfigurationBaselineHierarchyImportPreview } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineHierarchyImportPreview"
import type { TechnicalConfigurationBaselineHierarchyImportPreviewWireResponse } from "@/app/(app)/technical-configurations/technical-configuration-baseline-hierarchy-import-types"

function createLargePreview(
  rowCount: number
): TechnicalConfigurationBaselineHierarchyImportPreviewWireResponse {
  return {
    data: {
      metadata: {
        template_kind: "technical_configuration_baseline",
        template_version: 2,
        dossier_id: "dossier-1",
        baseline_version_id: "draft-1",
        baseline_revision: 11,
        generated_at: "2026-08-10T00:00:00.000Z",
      },
      rows: Array.from({ length: rowCount }, (_, index) => ({
        row: index + 2,
        row_type: "CRITERION" as const,
        criterion_id: null,
        criterion_code: `TC-${String(index + 1).padStart(4, "0")}`,
        existing_title: null,
        requirement_text: `Tiêu chí preview ${index + 1}`,
        original_group_id: null,
        original_subgroup_id: null,
        original_criterion_order: null,
        target_group_id: "group-1",
        target_subgroup_id: null,
        target_group_order: 1,
        target_subgroup_order: null,
        target_criterion_order: index + 1,
        identity_fallback: true,
      })),
      counts: { groups: 1, subgroups: 0, criteria: rowCount },
      effects: {
        groups: { create: 0, update: 0, move: 0, delete: 0 },
        subgroups: { create: 0, update: 0, move: 0, delete: 0 },
        criteria: { create: rowCount, update: 0, move: 0, delete: 0 },
      },
    },
    errors: [],
  }
}

describe("technical configuration hierarchy import large preview", () => {
  it("keeps every normalized row reachable through bounded pagination", async () => {
    const user = userEvent.setup()
    render(
      <TechnicalConfigurationBaselineHierarchyImportPreview preview={createLargePreview(205)} />
    )

    expect(screen.getByText("Tiêu chí preview 1")).toBeInTheDocument()
    expect(screen.getByText("Tiêu chí preview 100")).toBeInTheDocument()
    expect(screen.queryByText("Tiêu chí preview 101")).not.toBeInTheDocument()
    expect(screen.queryByText("Tiêu chí preview 205")).not.toBeInTheDocument()
    expect(screen.getByText("Trang 1 / 3")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Trang 1 / 3")

    await user.click(screen.getByRole("button", { name: "Trang sau" }))

    expect(screen.queryByText("Tiêu chí preview 100")).not.toBeInTheDocument()
    expect(screen.getByText("Tiêu chí preview 101")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Trang sau" }))

    expect(screen.getByText("Trang 3 / 3")).toBeInTheDocument()
    expect(screen.getByText("Tiêu chí preview 205")).toBeInTheDocument()
    expect(screen.queryByText("Tiêu chí preview 1")).not.toBeInTheDocument()
  })

  it("resets to the first page when the authoritative preview changes", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <TechnicalConfigurationBaselineHierarchyImportPreview preview={createLargePreview(205)} />
    )

    await user.click(screen.getByRole("button", { name: "Trang sau" }))
    await user.click(screen.getByRole("button", { name: "Trang sau" }))
    expect(screen.getByRole("status")).toHaveTextContent("Trang 3 / 3")

    rerender(
      <TechnicalConfigurationBaselineHierarchyImportPreview
        key="preview-2"
        preview={createLargePreview(150)}
      />
    )
    expect(screen.getByRole("status")).toHaveTextContent("Trang 1 / 2")
    expect(screen.getByText("Tiêu chí preview 1")).toBeInTheDocument()
  })
})
