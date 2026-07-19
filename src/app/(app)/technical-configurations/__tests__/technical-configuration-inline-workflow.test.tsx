import "@testing-library/jest-dom"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationBaselineTab } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import type { TechnicalConfigurationBaselineEditorDraft } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"

const baseline = vi.hoisted(() => {
  const selectedVersion: TechnicalConfigurationBaselineDraftWire = {
    id: "draft-1",
    dossier_id: "dossier-1",
    version_number: 1,
    status: "draft",
    source_baseline_version_id: null,
    source_version_number: null,
    next_criterion_number: 2,
    revision: 4,
    locked_at: null,
    locked_by: null,
    created_at: "2026-07-13T00:00:00.000Z",
    created_by: 1,
    updated_at: "2026-07-13T00:00:00.000Z",
    updated_by: 1,
    groups: [],
  }

  return {
    versions: [selectedVersion],
    selectedVersion,
    baseDraft: null,
    editorDraft: {
      id: "draft-1",
      dossierId: "dossier-1",
      status: "draft",
      revision: 4,
      groups: [
        {
          key: "group-1",
          id: "group-1",
          name: "Yêu cầu chung",
          criteria: [
            {
              key: "criterion-1",
              id: "criterion-1",
              criterionCode: "TC-0001",
              title: "",
              requirementText: "Nguồn điện ổn định",
            },
          ],
        },
        {
          key: "group-2",
          id: "group-2",
          name: "Yêu cầu kỹ thuật",
          criteria: [
            {
              key: "criterion-2",
              id: null,
              criterionCode: null,
              title: "Áp lực",
              requirementText: "Áp lực tối thiểu 3 bar",
            },
          ],
        },
      ],
    } as TechnicalConfigurationBaselineEditorDraft,
    validation: { groupErrors: {}, criterionErrors: {} },
    isDirty: false,
    isConflict: false,
    saveStatus: "idle" as const,
    saveError: null,
    lifecycleError: null,
    isSaving: false,
    isReloading: false,
    isCreating: false,
    isLocking: false,
    isCopying: false,
    isLoadingMoreVersions: false,
    createError: null,
    queryError: null,
    isLoading: false,
    isMissing: false,
    hasDraft: true,
    hasMoreVersions: false,
    onEditorChange: vi.fn(),
    onSave: vi.fn(),
    onCreate: vi.fn(),
    onLock: vi.fn(),
    onCopy: vi.fn(),
    onSelectVersion: vi.fn(),
    onLoadMoreVersions: vi.fn(),
    onRetryQuery: vi.fn(),
    onRefreshVersions: vi.fn(),
    onReloadFromServer: vi.fn(),
  }
})

vi.mock(
  "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineEditor",
  () => ({
    useTechnicalConfigurationBaselineEditor: () => baseline,
  })
)

const dossier: TechnicalConfigurationDossierWire = {
  id: "dossier-1",
  device_type_name: "Máy lọc thận",
  name: "Cấu hình máy lọc thận",
  description: null,
  revision: 3,
  archived_at: null,
  archived_by: null,
  created_at: "2026-07-13T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-13T00:00:00.000Z",
  updated_by: 1,
}

describe("technical configuration inline workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uses current-draft validation for summaries without exposing field errors before save", async () => {
    const originalDraft = baseline.editorDraft
    baseline.editorDraft = {
      ...originalDraft,
      groups: originalDraft.groups.map((group, index) =>
        index === 0
          ? {
              ...group,
              name: " ",
              criteria: group.criteria.map((criterion) => ({
                ...criterion,
                requirementText: " ",
              })),
            }
          : group
      ),
    }

    try {
      render(<TechnicalConfigurationBaselineTab dossier={dossier} onDirtyChange={vi.fn()} />)

      expect(await screen.findByRole("tab", { name: /Nhóm 1.*2 lỗi/ })).toBeInTheDocument()
      expect(screen.getByLabelText("Tên nhóm 1")).not.toHaveAttribute("aria-invalid", "true")
      expect(screen.queryByText("Tên nhóm là bắt buộc.")).not.toBeInTheDocument()
      expect(screen.getByLabelText("Nội dung yêu cầu 1.1")).not.toHaveAttribute(
        "aria-invalid",
        "true"
      )
    } finally {
      baseline.editorDraft = originalDraft
    }
  })

  it("associates a visible group-name error with its input", async () => {
    const originalValidation = baseline.validation
    baseline.validation = {
      groupErrors: { "group-1": "Tên nhóm là bắt buộc." },
      criterionErrors: {},
    }

    try {
      render(<TechnicalConfigurationBaselineTab dossier={dossier} onDirtyChange={vi.fn()} />)

      const groupInput = await screen.findByLabelText("Tên nhóm 1")
      const groupError = screen.getByText("Tên nhóm là bắt buộc.")
      expect(groupError).toHaveAttribute("id")
      expect(groupInput).toHaveAttribute("aria-describedby", groupError.id)
    } finally {
      baseline.validation = originalValidation
    }
  })

  it("preserves group buffers and treats clean-draft bulk input as unsafe", async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    const addEventListener = vi.spyOn(window, "addEventListener")
    render(<TechnicalConfigurationBaselineTab dossier={dossier} onDirtyChange={onDirtyChange} />)

    await user.click(await screen.findByRole("tab", { name: "Nhập nhiều dòng" }))
    await user.type(screen.getByLabelText("Nội dung nhập nhanh"), "Buffer nhóm 1")

    expect(screen.getByText("Hoàn tất hoặc hủy phần nhập nhiều dòng trước khi lưu.")).toBeVisible()
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    const beforeUnloadHandler = addEventListener.mock.calls
      .filter(([eventName]) => eventName === "beforeunload")
      .at(-1)?.[1]
    expect(beforeUnloadHandler).toBeTypeOf("function")
    const unsafeEvent = new Event("beforeunload", { cancelable: true })
    ;(beforeUnloadHandler as EventListener)(unsafeEvent)
    expect(unsafeEvent.defaultPrevented).toBe(true)

    await user.click(screen.getByRole("tab", { name: /Yêu cầu kỹ thuật/ }))
    expect(screen.getByLabelText("Nội dung nhập nhanh")).toHaveValue("")
    await user.type(screen.getByLabelText("Nội dung nhập nhanh"), "Buffer nhóm 2")

    await user.click(screen.getByRole("tab", { name: /Yêu cầu chung/ }))
    expect(screen.getByLabelText("Nội dung nhập nhanh")).toHaveValue("Buffer nhóm 1")
    expect(baseline.onSave).not.toHaveBeenCalled()
    addEventListener.mockRestore()
  })

  it("keeps pending-buffer delete and reload controls focusable while blocking actions", async () => {
    const user = userEvent.setup()
    const originalConflict = baseline.isConflict
    const confirmSpy = vi.spyOn(window, "confirm")
    baseline.isConflict = true

    try {
      render(<TechnicalConfigurationBaselineTab dossier={dossier} onDirtyChange={vi.fn()} />)

      await user.click(await screen.findByRole("tab", { name: "Nhập nhiều dòng" }))
      await user.type(screen.getByLabelText("Nội dung nhập nhanh"), "Buffer chưa xử lý")

      const pendingExplanation = screen.getByText(
        "Hoàn tất hoặc hủy phần nhập nhiều dòng trước khi lưu."
      )
      const deleteButton = screen.getByRole("button", { name: "Xóa nhóm 1" })
      expect(deleteButton).not.toBeDisabled()
      expect(deleteButton).toHaveAttribute("aria-disabled", "true")
      expect(deleteButton).toHaveAttribute("aria-describedby", pendingExplanation.id)
      deleteButton.focus()
      expect(deleteButton).toHaveFocus()
      await user.click(deleteButton)
      expect(baseline.onEditorChange).not.toHaveBeenCalled()

      const reloadButton = screen.getByRole("button", { name: "Tải lại từ máy chủ" })
      expect(reloadButton).not.toBeDisabled()
      expect(reloadButton).toHaveAttribute("aria-disabled", "true")
      expect(reloadButton).toHaveAttribute("aria-describedby", pendingExplanation.id)
      reloadButton.focus()
      expect(reloadButton).toHaveFocus()
      await user.click(reloadButton)
      expect(confirmSpy).not.toHaveBeenCalled()
      expect(baseline.onReloadFromServer).not.toHaveBeenCalled()
    } finally {
      baseline.isConflict = originalConflict
      confirmSpy.mockRestore()
    }
  })

  it("opens an overview criterion in row mode and focuses its requirement cell", async () => {
    const user = userEvent.setup()
    render(<TechnicalConfigurationBaselineTab dossier={dossier} onDirtyChange={vi.fn()} />)

    const groupTab = await screen.findByRole("tab", { name: /Yêu cầu chung/ })
    const groupPanelId = groupTab.getAttribute("aria-controls")
    expect(groupPanelId).toBeTruthy()
    expect(document.getElementById(groupPanelId!)).toHaveAttribute("role", "tabpanel")

    const rowModeTab = screen.getByRole("tab", { name: "Chỉnh từng dòng" })
    const rowPanelId = rowModeTab.getAttribute("aria-controls")
    expect(rowPanelId).toBeTruthy()
    expect(document.getElementById(rowPanelId!)).toHaveAttribute("role", "tabpanel")

    await user.click(await screen.findByRole("tab", { name: "Xem tất cả nhóm" }))
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Xem tất cả nhóm" })).toHaveFocus()
    )

    await user.click(
      screen.getByRole("button", {
        name: /Mới.*Áp lực.*Áp lực tối thiểu 3 bar.*Chưa lưu/,
      })
    )
    expect(screen.getByRole("tab", { name: "Chỉnh từng dòng" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.getByLabelText("Nội dung yêu cầu 2.1")).toHaveFocus()
  })

  it("returns from cancel to row mode and keeps focus on the bulk mode trigger", async () => {
    const user = userEvent.setup()
    render(<TechnicalConfigurationBaselineTab dossier={dossier} onDirtyChange={vi.fn()} />)

    const bulkModeTab = await screen.findByRole("tab", { name: "Nhập nhiều dòng" })
    await user.click(bulkModeTab)
    await user.type(screen.getByLabelText("Nội dung nhập nhanh"), "Tiêu chí chưa nhận")
    await user.click(screen.getByRole("button", { name: "Hủy nhập" }))

    expect(screen.getByRole("tab", { name: "Chỉnh từng dòng" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(bulkModeTab).toHaveFocus()
  })
})
