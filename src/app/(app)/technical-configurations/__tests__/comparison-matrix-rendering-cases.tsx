import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationCriterionPanel } from "../_components/comparison/TechnicalConfigurationCriterionPanel"
import { TechnicalConfigurationMatrix } from "../_components/comparison/TechnicalConfigurationMatrix"
import { TechnicalConfigurationMatrixToolbar } from "../_components/comparison/TechnicalConfigurationMatrixToolbar"
import type { TechnicalConfigurationBaselineDraftWire } from "../baseline-types"
import type { TechnicalConfigurationOptionWire } from "../supplier-option-types"

import {
  ComparisonDetailHarness,
  ComparisonQueryProvider,
  createComparisonResult,
  LONG_REQUIREMENT,
  LONG_RESPONSE,
} from "./comparison-matrix-test-fixtures"

export function registerComparisonMatrixRenderingTests() {
  describe("P10B1 core comparison matrix rendering", () => {
    it("renders desktop request controls and preserves selected option order", async () => {
      const user = userEvent.setup()
      const onAddOption = vi.fn()
      const onRemoveOption = vi.fn()
      const versions = [
        {
          id: "baseline-2",
          dossier_id: "dossier-1",
          version_number: 2,
          status: "locked",
          source_baseline_version_id: null,
          source_version_number: null,
          next_criterion_number: 1,
          revision: 2,
          locked_at: "2026-07-28T00:00:00Z",
          locked_by: 1,
          created_at: "2026-07-28T00:00:00Z",
          created_by: 1,
          updated_at: "2026-07-28T00:00:00Z",
          updated_by: 1,
          groups: [],
        },
      ] satisfies TechnicalConfigurationBaselineDraftWire[]
      const optionA = {
        id: "option-a",
        dossier_id: "dossier-1",
        supplier_id: "supplier-a",
        supplier_name: "Nhà cung cấp A",
        model: "A-100",
        manufacturer: null,
        option_name: null,
        notes: null,
        display_label: "Nhà cung cấp A · A-100",
        created_at: "2026-07-28T00:00:00Z",
        created_by: 1,
        updated_at: "2026-07-28T00:00:00Z",
        updated_by: 1,
        revision: 1,
      } satisfies TechnicalConfigurationOptionWire
      const optionB = {
        ...optionA,
        id: "option-b",
        supplier_id: "supplier-b",
        supplier_name: "Nhà cung cấp B",
        model: "B-200",
        display_label: "Nhà cung cấp B · B-200",
      }
      const optionC = {
        ...optionA,
        id: "option-c",
        supplier_id: "supplier-c",
        supplier_name: "Nhà cung cấp C",
        model: "C-300",
        display_label: "Nhà cung cấp C · C-300",
      }

      const toolbarProps = {
        baselineVersionId: versions[0].id,
        versions,
        versionsQuery: { isLoading: false, isError: false, hasNextPage: false },
        options: [optionA, optionB, optionC],
        optionsQuery: { isLoading: false, isError: false },
        selectedOptions: [optionB, optionA],
        visibleOptionIds: [optionB.id, optionA.id],
        pinnedOptionIds: [],
        focusedOptionId: null,
        onSelectBaselineVersion: vi.fn(),
        onLoadMoreVersions: vi.fn(),
        onRetryVersions: vi.fn(),
        onRetryOptions: vi.fn(),
        onAddOption,
        onRemoveOption,
        onToggleOptionVisibility: vi.fn(),
        onToggleOptionPin: vi.fn(),
        onFocusOption: vi.fn(),
        onExitFocus: vi.fn(),
      }
      const { rerender } = render(
        <TechnicalConfigurationMatrixToolbar {...toolbarProps} isSelectionLimitReached={false} />
      )

      expect(
        screen.getAllByTestId("selected-option-label").map((label) => label.textContent)
      ).toEqual(["1. Nhà cung cấp B · B-200", "2. Nhà cung cấp A · A-100"])

      await user.click(
        screen.getByRole("button", { name: "Bỏ phương án 1: Nhà cung cấp B · B-200" })
      )
      expect(onRemoveOption).toHaveBeenCalledWith(optionB.id)

      await user.click(screen.getByRole("button", { name: /Chọn phương án/ }))
      await user.click(screen.getByRole("button", { name: optionC.display_label }))
      expect(onAddOption).toHaveBeenCalledWith(optionC.id)

      rerender(<TechnicalConfigurationMatrixToolbar {...toolbarProps} isSelectionLimitReached />)
      expect(screen.getByRole("button", { name: optionC.display_label })).toBeInTheDocument()

      rerender(
        <TechnicalConfigurationMatrixToolbar
          {...toolbarProps}
          versionsQuery={{
            ...toolbarProps.versionsQuery,
            isError: true,
            error: new Error("Không thể tải thêm lịch sử"),
          }}
          isSelectionLimitReached={false}
        />
      )
      expect(screen.getByLabelText("Chọn phiên bản cấu hình cơ sở")).toBeEnabled()
      expect(screen.getByText("Không thể tải thêm lịch sử")).toBeInTheDocument()
    })

    it("renders canonical rows and frozen columns in request order", () => {
      render(
        <TechnicalConfigurationMatrix
          hasRequest
          result={createComparisonResult()}
          onOpenDetail={vi.fn()}
          onPageChange={vi.fn()}
          onRetry={vi.fn()}
        />
      )

      expect(
        screen.getAllByTestId("comparison-option-header").map((header) => header.textContent)
      ).toEqual(["Nhà cung cấp B · Phương án B", "Nhà cung cấp A · A-100"])
      expect(
        screen.getAllByTestId("comparison-criterion-row").map((row) => row.dataset.criterionId)
      ).toEqual(["criterion-2", "criterion-1", "criterion-3"])
      expect(screen.getByTestId("comparison-matrix-scroll")).toHaveClass("overflow-auto")
      expect(screen.getByTestId("comparison-criterion-header")).toHaveClass(
        "sticky",
        "left-0",
        "w-[220px]",
        "min-w-[220px]",
        "max-w-[220px]"
      )
      expect(screen.getByTestId("comparison-baseline-header")).toHaveClass(
        "sticky",
        "left-[220px]",
        "w-[360px]",
        "min-w-[360px]",
        "max-w-[360px]"
      )
      screen
        .getAllByTestId("comparison-option-header")
        .forEach((header) =>
          expect(header).toHaveClass("w-[320px]", "min-w-[320px]", "max-w-[320px]")
        )
    })

    it("renders each logical group as a semantic row group", () => {
      const { container } = render(
        <TechnicalConfigurationMatrix
          hasRequest
          result={createComparisonResult()}
          onOpenDetail={vi.fn()}
          onPageChange={vi.fn()}
          onRetry={vi.fn()}
        />
      )

      const groupBodies = container.querySelectorAll('tbody[data-testid="comparison-group-body"]')
      expect(groupBodies).toHaveLength(2)
      expect(groupBodies[0].querySelector('th[scope="rowgroup"]')).toHaveTextContent(
        "Thông số chính"
      )
      expect(
        groupBodies[0].querySelectorAll(
          'tr[data-testid="comparison-criterion-row"] > th[scope="row"]'
        )
      ).toHaveLength(2)
      expect(groupBodies[1].querySelector('th[scope="rowgroup"]')).toHaveTextContent("Phụ kiện")
      expect(
        groupBodies[1].querySelectorAll(
          'tr[data-testid="comparison-criterion-row"] > th[scope="row"]'
        )
      ).toHaveLength(1)
    })

    it("keeps cells concise and exposes full text through keyboard interaction", async () => {
      const user = userEvent.setup()
      const onOpenDetail = vi.fn()
      render(
        <TechnicalConfigurationMatrix
          hasRequest
          result={createComparisonResult()}
          onOpenDetail={onOpenDetail}
          onPageChange={vi.fn()}
          onRetry={vi.fn()}
        />
      )

      expect(screen.getAllByText("Chưa có phản hồi")).not.toHaveLength(0)
      expect(screen.getByText("Có thông tin bổ sung")).toBeInTheDocument()
      expect(screen.getByText("1 tài liệu · 1 trích dẫn")).toBeInTheDocument()
      expect(screen.getByText(LONG_RESPONSE)).toHaveClass("line-clamp-4")

      const detailButton = screen.getByRole("button", {
        name: "Xem chi tiết TS-02 · Nhà cung cấp B · Phương án B",
      })
      detailButton.focus()
      await user.keyboard("{Enter}")

      expect(onOpenDetail).toHaveBeenCalledWith(
        expect.objectContaining({
          criterionCode: "TS-02",
          requirementText: LONG_REQUIREMENT,
          responseText: LONG_RESPONSE,
          supplementaryInformation: "Có đầu dò bổ sung.",
        })
      )
    })

    it("restores focus to the matrix cell after closing keyboard-opened detail", async () => {
      const user = userEvent.setup()
      render(<ComparisonDetailHarness />)
      const detailButton = screen.getByRole("button", {
        name: "Xem chi tiết TS-02 · Nhà cung cấp B · Phương án B",
      })

      detailButton.focus()
      await user.keyboard("{Enter}")
      expect(screen.getByRole("dialog")).toBeInTheDocument()

      await user.keyboard("{Escape}")
      await waitFor(() => expect(detailButton).toHaveFocus())
    })

    it("renders no-selection, loading, error, retry, and empty-page states", async () => {
      const user = userEvent.setup()
      const onRetry = vi.fn()
      const { rerender } = render(
        <TechnicalConfigurationMatrix
          hasRequest={false}
          onOpenDetail={vi.fn()}
          onPageChange={vi.fn()}
          onRetry={onRetry}
        />
      )
      expect(
        screen.getByText("Chọn phiên bản cơ sở và ít nhất một phương án để bắt đầu so sánh.")
      ).toBeInTheDocument()

      rerender(
        <TechnicalConfigurationMatrix
          hasRequest
          isLoading
          onOpenDetail={vi.fn()}
          onPageChange={vi.fn()}
          onRetry={onRetry}
        />
      )
      expect(screen.getByText("Đang tải ma trận so sánh...")).toBeInTheDocument()

      rerender(
        <TechnicalConfigurationMatrix
          error={new Error("Không thể tải ma trận")}
          hasRequest
          isError
          onOpenDetail={vi.fn()}
          onPageChange={vi.fn()}
          onRetry={onRetry}
        />
      )
      await user.click(screen.getByRole("button", { name: "Thử lại" }))
      expect(onRetry).toHaveBeenCalledTimes(1)

      const emptyResult = createComparisonResult()
      emptyResult.data.criteria = []
      rerender(
        <TechnicalConfigurationMatrix
          hasRequest
          result={emptyResult}
          onOpenDetail={vi.fn()}
          onPageChange={vi.fn()}
          onRetry={onRetry}
        />
      )
      expect(screen.getByText("Trang này chưa có tiêu chí để so sánh.")).toBeInTheDocument()
    })

    it("renders a text-only detail without authoring or assessment controls", () => {
      const detail: TechnicalConfigurationCriterionDetail = {
        criterionCode: "TS-02",
        criterionTitle: "Độ phân giải",
        optionLabel: "Nhà cung cấp B · Phương án B",
        requirementText: LONG_REQUIREMENT,
        responseText: LONG_RESPONSE,
        supplementaryInformation: "Có đầu dò bổ sung.",
        evidence: { documentCount: 1, citationCount: 1, hasEvidence: true },
        evidenceTarget: {
          kind: "option",
          baselineVersionId: "baseline-1",
          optionId: "option-b",
          criterionId: "criterion-2",
        },
      }
      render(
        <ComparisonQueryProvider>
          <TechnicalConfigurationCriterionPanel detail={detail} open onOpenChange={vi.fn()} />
        </ComparisonQueryProvider>
      )

      expect(screen.getByText(LONG_REQUIREMENT)).toBeInTheDocument()
      expect(screen.getByText(LONG_RESPONSE)).toBeInTheDocument()
      expect(
        screen.getByText("Không dùng thông tin bổ sung để chấm điểm hoặc xác định mức đáp ứng.")
      ).toBeInTheDocument()
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
      expect(screen.queryByText("Sao chép từ cấu hình cơ sở")).not.toBeInTheDocument()
      expect(screen.queryByText("Lưu")).not.toBeInTheDocument()
      expect(screen.queryByText("Đánh giá")).not.toBeInTheDocument()
    })
  })
}
