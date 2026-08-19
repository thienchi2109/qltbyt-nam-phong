import "@testing-library/jest-dom"

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationBaselineCrossDossierCopyDialog } from "../_components/TechnicalConfigurationBaselineCrossDossierCopyDialog"
import type { UseTechnicalConfigurationBaselineCrossDossierCopyResult } from "../_hooks/useTechnicalConfigurationBaselineCrossDossierCopy"

function createWorkflow(
  overrides: Partial<UseTechnicalConfigurationBaselineCrossDossierCopyResult> = {}
): UseTechnicalConfigurationBaselineCrossDossierCopyResult {
  return {
    open: true,
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    search: "",
    setSearch: vi.fn(),
    sources: [
      {
        baseline_version_id: "source-1",
        dossier_id: "source-dossier-1",
        device_type_name: "Máy thở",
        dossier_name: "Hồ sơ nguồn",
        dossier_archived_at: "2026-08-18T00:00:00.000Z",
        version_number: 3,
        locked_at: "2026-08-18T01:00:00.000Z",
        main_section_count: 2,
        subgroup_count: 4,
        criterion_count: 12,
      },
    ],
    total: 1,
    isSourcesLoading: false,
    isLoadingMoreSources: false,
    hasMoreSources: false,
    loadMoreSources: vi.fn(),
    sourcesError: null,
    selectedSourceId: "source-1",
    selectSource: vi.fn(),
    preview: {
      mode: "replace",
      requires_replacement_confirmation: true,
      preview_fingerprint: "c".repeat(64),
      source: {
        baseline_version_id: "source-1",
        dossier_id: "source-dossier-1",
        device_type_name: "Máy thở",
        dossier_name: "Hồ sơ nguồn",
        dossier_archived_at: "2026-08-18T00:00:00.000Z",
        version_number: 3,
        locked_at: "2026-08-18T01:00:00.000Z",
      },
      target: {
        dossier_id: "target-1",
        dossier_revision: 7,
        baseline_version_id: "draft-1",
        baseline_revision: 4,
        version_number: 2,
      },
      copy_counts: {
        main_sections: 2,
        subgroups: 4,
        criteria: 12,
        reference_products: 1,
        reference_responses: 1,
        baseline_documents: 1,
        baseline_citations: 1,
        reference_documents: 1,
        reference_citations: 1,
      },
      delete_counts: {
        main_sections: 1,
        subgroups: 1,
        criteria: 2,
        reference_products: 0,
        reference_responses: 0,
        baseline_documents: 0,
        baseline_citations: 0,
        reference_documents: 0,
        reference_citations: 0,
        option_responses: 3,
        option_citations: 2,
        manual_assessments: 4,
      },
      preserved_counts: {
        suppliers: 2,
        options: 3,
        option_documents: 1,
        comparison_sets: 1,
      },
    },
    isPreviewing: false,
    replacementConfirmed: false,
    setReplacementConfirmed: vi.fn(),
    operationError: null,
    isApplying: false,
    canApply: false,
    apply: vi.fn(),
    ...overrides,
  } as UseTechnicalConfigurationBaselineCrossDossierCopyResult
}

describe("technical configuration cross-dossier copy dialog", () => {
  it("shows the locked-source warning, archived state, and dependent deletion counts", () => {
    render(<TechnicalConfigurationBaselineCrossDossierCopyDialog workflow={createWorkflow()} />)

    expect(screen.getByText(/Chỉ có thể sao chép phiên bản cấu hình đã khóa/)).toBeInTheDocument()
    expect(screen.getByText("Đã lưu trữ")).toBeInTheDocument()
    expect(screen.getByText("Phản hồi phương án")).toBeInTheDocument()
    expect(screen.getByText("Trích dẫn phương án")).toBeInTheDocument()
    expect(screen.getByText("Đánh giá thủ công")).toBeInTheDocument()
  })

  it("requires explicit replacement confirmation and cancels without applying", async () => {
    const user = userEvent.setup()
    const workflow = createWorkflow()
    render(<TechnicalConfigurationBaselineCrossDossierCopyDialog workflow={workflow} />)

    expect(screen.getByRole("button", { name: "Thay thế bản nháp" })).toBeDisabled()
    await user.click(
      screen.getByRole("checkbox", {
        name: /Tôi hiểu bản nháp hiện tại sẽ bị thay thế/,
      })
    )
    expect(workflow.setReplacementConfirmed).toHaveBeenCalledWith(true)

    await user.click(screen.getByRole("button", { name: "Hủy" }))
    expect(workflow.closeDialog).toHaveBeenCalled()
    expect(workflow.apply).not.toHaveBeenCalled()
  })

  it("preserves recoverable server errors in the open dialog", () => {
    render(
      <TechnicalConfigurationBaselineCrossDossierCopyDialog
        workflow={createWorkflow({
          operationError:
            "Dữ liệu đã thay đổi. Hệ thống đã tải bản xem trước mới; vui lòng kiểm tra lại.",
        })}
      />
    )

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText(/bản xem trước mới/)).toBeInTheDocument()
  })

  it("blocks every close path while preview or apply is pending", async () => {
    const user = userEvent.setup()
    const workflow = createWorkflow({ isPreviewing: true })
    render(<TechnicalConfigurationBaselineCrossDossierCopyDialog workflow={workflow} />)

    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(workflow.closeDialog).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled()
  })
})
