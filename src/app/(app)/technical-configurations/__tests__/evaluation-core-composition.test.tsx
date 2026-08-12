import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"
import * as React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationAssessmentControls } from "../_components/evaluation/TechnicalConfigurationAssessmentControls"
import { TechnicalConfigurationCriterionList } from "../_components/evaluation/TechnicalConfigurationCriterionList"
import { TechnicalConfigurationEvaluationPanel } from "../_components/evaluation/TechnicalConfigurationEvaluationPanel"
import { buildTechnicalConfigurationEvaluationHierarchyRows } from "../_components/evaluation/technical-configuration-evaluation-hierarchy"
import type { TechnicalConfigurationCriterionDetail } from "../_components/comparison/TechnicalConfigurationCriterionPanel"
import { assessment } from "./assessment-test-fixtures"
import { createComparisonResult } from "./comparison-matrix-test-fixtures"

const evaluationDetail: TechnicalConfigurationCriterionDetail = {
  criterionCode: "TS-02",
  criterionTitle: "Độ phân giải",
  optionLabel: "Nhà cung cấp B · Phương án B",
  requirementText: "Yêu cầu tối thiểu",
  responseText: "Phản hồi hiện tại",
  supplementaryInformation: "Thông tin tham khảo, không dùng để chấm điểm.",
  evidence: {
    documentCount: 0,
    citationCount: 0,
    hasEvidence: false,
  },
  evidenceTarget: {
    kind: "option",
    baselineVersionId: "baseline-1",
    optionId: "option-b",
    criterionId: "criterion-2",
  },
}

const originalScrollIntoView = Element.prototype.scrollIntoView

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : collectTypeScriptFiles(entryPath)
    }
    return /\.[jt]sx?$/.test(entry.name) ? [entryPath] : []
  })
}

beforeAll(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  })
})

afterAll(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: originalScrollIntoView,
  })
})

describe("P12A1 evaluation core composition", () => {
  it("renders a prebuilt canonical criterion sequence with only the current status badge", async () => {
    const user = userEvent.setup()
    const onSelectCriterion = vi.fn()
    const comparison = createComparisonResult()
    const canonicalCriteria = [...comparison.data.criteria].sort(
      (left, right) =>
        left.group.sortOrder - right.group.sortOrder ||
        left.group.id.localeCompare(right.group.id) ||
        left.criterion.sortOrder - right.criterion.sortOrder ||
        left.criterion.id.localeCompare(right.criterion.id)
    )
    const rows = buildTechnicalConfigurationEvaluationHierarchyRows(canonicalCriteria)

    render(
      <TechnicalConfigurationCriterionList
        rows={rows}
        assessmentsByCriterionId={{
          "criterion-2": {
            ...assessment,
            criterion_id: "criterion-2",
            technical_axis: "meets",
            evidence_axis: "complete",
          },
          "criterion-3": {
            ...assessment,
            criterion_id: "criterion-3",
            technical_axis: "fails",
            evidence_axis: "complete",
          },
        }}
        currentCriterionId="criterion-2"
        onSelectCriterion={onSelectCriterion}
      />
    )

    const criterionButtons = screen.getAllByTestId("evaluation-criterion")
    expect(criterionButtons.map((button) => button.getAttribute("data-criterion-id"))).toEqual([
      "criterion-1",
      "criterion-2",
      "criterion-3",
    ])
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)
    ).toEqual(["Thông số chính", "Phụ kiện"])
    expect(within(criterionButtons[0]).getByText("Chưa đánh giá")).toBeInTheDocument()
    expect(within(criterionButtons[1]).getByText("Đạt")).toBeInTheDocument()
    expect(within(criterionButtons[2]).getByText("Không đạt")).toBeInTheDocument()
    expect(criterionButtons[1]).toHaveAttribute("aria-current", "true")
    expect(screen.queryByText(/tiến độ|tổng|bộ lọc/i)).not.toBeInTheDocument()

    await user.click(criterionButtons[0])
    expect(onSelectCriterion).toHaveBeenCalledWith("criterion-1")
  })

  it("uses the canonical P11A axis labels and derives status without scoring supplementary text", async () => {
    const user = userEvent.setup()

    const { rerender } = render(
      <TechnicalConfigurationAssessmentControls
        technicalAxis="meets"
        evidenceAxis="partial"
        notes="Giữ nguyên đánh giá thủ công."
        onTechnicalAxisChange={vi.fn()}
        onEvidenceAxisChange={vi.fn()}
        onNotesChange={vi.fn()}
      />
    )

    expect(screen.getByRole("status")).toHaveTextContent("Chưa đủ bằng chứng")
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Giữ nguyên đánh giá thủ công.")

    screen.getByRole("combobox", { name: "Mức đáp ứng kỹ thuật" }).focus()
    await user.keyboard("{Enter}")
    for (const label of [
      "Chưa chọn",
      "Vượt yêu cầu",
      "Đạt",
      "Không đạt",
      "Chưa rõ",
      "Không áp dụng",
    ]) {
      expect(await screen.findByRole("option", { name: label })).toBeInTheDocument()
    }
    await user.keyboard("{Escape}")

    screen.getByRole("combobox", { name: "Mức đầy đủ bằng chứng" }).focus()
    await user.keyboard("{Enter}")
    for (const label of ["Chưa chọn", "Đầy đủ", "Một phần", "Thiếu", "Không yêu cầu"]) {
      expect(await screen.findByRole("option", { name: label })).toBeInTheDocument()
    }

    await user.keyboard("{Escape}")
    rerender(
      <TechnicalConfigurationAssessmentControls
        technicalAxis="meets"
        evidenceAxis="partial"
        notes="Giữ nguyên đánh giá thủ công."
        errorMessage="Không thể lưu đánh giá."
        onTechnicalAxisChange={vi.fn()}
        onEvidenceAxisChange={vi.fn()}
        onNotesChange={vi.fn()}
      />
    )

    expect(screen.getByRole("alert")).toHaveTextContent("Không thể lưu đánh giá.")
    expect(screen.getByLabelText("Ghi chú")).not.toHaveAttribute("aria-invalid")
  })

  it("composes assessment controls into the shared criterion detail exactly once", () => {
    const { rerender } = render(
      <TechnicalConfigurationEvaluationPanel
        detail={evaluationDetail}
        open
        onOpenChange={vi.fn()}
        technicalAxis="meets"
        evidenceAxis="complete"
        notes="Đánh giá độc lập với nội dung nguồn."
        onTechnicalAxisChange={vi.fn()}
        onEvidenceAxisChange={vi.fn()}
        onNotesChange={vi.fn()}
      />
    )

    expect(screen.getAllByText("Yêu cầu tối thiểu")).toHaveLength(1)
    expect(screen.getAllByText("Phản hồi hiện tại")).toHaveLength(1)
    expect(screen.getAllByText("Thông tin tham khảo, không dùng để chấm điểm.")).toHaveLength(1)
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Đánh giá độc lập với nội dung nguồn.")

    rerender(
      <TechnicalConfigurationEvaluationPanel
        detail={{
          ...evaluationDetail,
          responseText: "Phản hồi nguồn đã thay đổi",
          supplementaryInformation: "Thông tin bổ sung đã thay đổi",
          evidence: { documentCount: 1, citationCount: 1, hasEvidence: false },
        }}
        open
        onOpenChange={vi.fn()}
        technicalAxis="meets"
        evidenceAxis="complete"
        notes="Đánh giá độc lập với nội dung nguồn."
        onTechnicalAxisChange={vi.fn()}
        onEvidenceAxisChange={vi.fn()}
        onNotesChange={vi.fn()}
      />
    )

    expect(screen.getByText("Phản hồi nguồn đã thay đổi")).toBeInTheDocument()
    expect(screen.getByText("Thông tin bổ sung đã thay đổi")).toBeInTheDocument()
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Đánh giá độc lập với nội dung nguồn.")
  })

  it("keeps evaluation core activation scoped to the P12 workspace and navigator", () => {
    const repoRoot = process.cwd()
    const sourceRoot = join(repoRoot, "src")
    const featureRoot = join(repoRoot, "src/app/(app)/technical-configurations")
    const evaluationCoreFiles = new Set(
      [
        "_components/evaluation/TechnicalConfigurationAssessmentControls.tsx",
        "_components/evaluation/TechnicalConfigurationCriterionList.tsx",
        "_components/evaluation/TechnicalConfigurationEvaluationPanel.tsx",
        "_hooks/useTechnicalConfigurationEvaluationDraft.ts",
        "technical-configuration-evaluation-state.ts",
      ].map((file) => join(featureRoot, file))
    )
    const evaluationCoreReference =
      /TechnicalConfiguration(?:AssessmentControls|CriterionList|EvaluationPanel)|useTechnicalConfigurationEvaluationDraft|technical-configuration-evaluation-state|_components\/evaluation\//
    const productionReferences = collectTypeScriptFiles(sourceRoot)
      .filter((file) => !evaluationCoreFiles.has(file))
      .filter((file) => evaluationCoreReference.test(readFileSync(file, "utf8")))
      .map((file) => relative(repoRoot, file))

    expect(productionReferences).toEqual(
      [
        "src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationActiveWorkspace.tsx",
        "src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationNavigatorPane.tsx",
        "src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationEvaluationHierarchyPresentation.ts",
        "src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationEvaluationNavigator.ts",
        "src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationEvaluationWorkspaceActions.ts",
      ].sort()
    )
  })
})
