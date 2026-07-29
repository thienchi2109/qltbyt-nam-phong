import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationCriterionPanel } from "../_components/comparison/TechnicalConfigurationCriterionPanel"
import { TechnicalConfigurationMatrix } from "../_components/comparison/TechnicalConfigurationMatrix"

import { ComparisonQueryProvider, createComparisonResult } from "./comparison-matrix-test-fixtures"

export function registerComparisonMatrixReviewRegressionTests() {
  describe("P10B1 review regressions", () => {
    it("lets users return from an empty later page", async () => {
      const user = userEvent.setup()
      const onPageChange = vi.fn()
      const emptyLaterPage = createComparisonResult()
      emptyLaterPage.data.criteria = []
      emptyLaterPage.total = 40
      emptyLaterPage.page = 2

      render(
        <TechnicalConfigurationMatrix
          hasRequest
          result={emptyLaterPage}
          onOpenDetail={vi.fn()}
          onPageChange={onPageChange}
          onRetry={vi.fn()}
        />
      )

      expect(screen.getByText("Trang này chưa có tiêu chí để so sánh.")).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Trang trước" }))
      expect(onPageChange).toHaveBeenCalledWith(1)
    })

    it("shows only baseline-relevant fields in baseline detail", () => {
      render(
        <ComparisonQueryProvider>
          <TechnicalConfigurationCriterionPanel
            detail={{
              criterionCode: "TS-01",
              criterionTitle: "Độ phân giải",
              optionLabel: null,
              requirementText: "Độ phân giải tối thiểu 1920 x 1080",
              responseText: null,
              supplementaryInformation: null,
              evidence: { documentCount: 2, citationCount: 1, hasEvidence: true },
              evidenceTarget: {
                kind: "baseline",
                baselineVersionId: "baseline-1",
                criterionId: "criterion-1",
              },
            }}
            open
            onOpenChange={vi.fn()}
          />
        </ComparisonQueryProvider>
      )

      expect(screen.getByText("Yêu cầu cơ sở")).toBeInTheDocument()
      expect(screen.getByText("Độ phân giải tối thiểu 1920 x 1080")).toBeInTheDocument()
      expect(screen.queryByText("Phản hồi phương án")).not.toBeInTheDocument()
      expect(screen.queryByText("Thông tin bổ sung")).not.toBeInTheDocument()
    })
  })
}
