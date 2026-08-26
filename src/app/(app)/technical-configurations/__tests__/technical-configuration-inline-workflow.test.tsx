import "@testing-library/jest-dom"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationBaselineTab } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import type { TechnicalConfigurationBaselineEditorDraft } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"

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

function renderBaselineTab(
  props: Partial<ComponentProps<typeof TechnicalConfigurationBaselineTab>> = {}
) {
  const queryClient = createTestQueryClient()
  return render(
    <TechnicalConfigurationBaselineTab dossier={dossier} onDirtyChange={vi.fn()} {...props} />,
    { wrapper: createReactQueryWrapper(queryClient) }
  )
}

describe("technical configuration inline workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("keeps the baseline tab shrinkable so the group list owns vertical scrolling", async () => {
    renderBaselineTab()

    const baselineTab = await screen.findByTestId("technical-configuration-baseline-tab")
    const editor = screen.getByTestId("baseline-editor-workspace")

    expect(baselineTab).toHaveClass("flex", "min-h-0", "flex-1", "flex-col")
    expect(editor).toHaveClass("min-h-0", "flex-1")
  })

  it("replaces the version toolbar with compact dossier context in focus mode", async () => {
    const user = userEvent.setup()
    const onToggleFocusMode = vi.fn()

    renderBaselineTab({ isFocusMode: true, onToggleFocusMode })

    expect(
      await screen.findByRole("region", { name: "Ngữ cảnh cấu hình đang chỉnh sửa" })
    ).toHaveTextContent("Cấu hình máy lọc thận")
    expect(
      screen.getByRole("region", { name: "Ngữ cảnh cấu hình đang chỉnh sửa" })
    ).toHaveTextContent("Phiên bản 1 · Bản nháp")
    expect(
      screen.queryByRole("region", { name: "Lịch sử phiên bản cấu hình cơ sở" })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Thu nhỏ vùng chỉnh sửa" }))
    expect(onToggleFocusMode).toHaveBeenCalledOnce()
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
      renderBaselineTab()

      const firstGroup = await screen.findByRole("region", { name: "Nhóm tiêu chí I" })
      expect(within(firstGroup).getByText("2 lỗi")).toBeInTheDocument()
      expect(screen.getByLabelText("Tên nhóm I")).not.toHaveAttribute("aria-invalid", "true")
      expect(screen.queryByText("Tên nhóm là bắt buộc.")).not.toBeInTheDocument()
      expect(
        screen.getByLabelText("Nội dung yêu cầu tiêu chí trực tiếp 1 của nhóm I")
      ).not.toHaveAttribute("aria-invalid", "true")
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
      renderBaselineTab()

      const groupInput = await screen.findByLabelText("Tên nhóm I")
      const groupError = screen.getByText("Tên nhóm là bắt buộc.")
      expect(groupError).toHaveAttribute("id")
      expect(groupInput).toHaveAttribute("aria-describedby", groupError.id)
    } finally {
      baseline.validation = originalValidation
    }
  })

  it("disables Save while a dirty draft is reloading", async () => {
    const user = userEvent.setup()
    const originalDirty = baseline.isDirty
    const originalReloading = baseline.isReloading
    baseline.isDirty = true
    baseline.isReloading = true

    try {
      renderBaselineTab()

      const saveButton = await screen.findByRole("button", { name: "Lưu" })
      expect(saveButton).toBeDisabled()
      await user.click(saveButton)
      expect(baseline.onSave).not.toHaveBeenCalled()
    } finally {
      baseline.isDirty = originalDirty
      baseline.isReloading = originalReloading
    }
  })

  it("preserves group buffers and treats clean-draft bulk input as unsafe", async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    const addEventListener = vi.spyOn(window, "addEventListener")

    try {
      renderBaselineTab({ onDirtyChange })

      const firstGroup = await screen.findByRole("region", { name: "Nhóm tiêu chí I" })
      const secondGroup = screen.getByRole("region", { name: "Nhóm tiêu chí II" })
      await user.click(within(firstGroup).getByRole("button", { name: /Nhập nhiều dòng/ }))
      await user.type(within(firstGroup).getByLabelText("Nội dung nhập nhanh"), "Buffer nhóm 1")

      expect(
        screen.getByText("Hoàn tất hoặc hủy phần nhập nhiều dòng trước khi lưu.")
      ).toBeVisible()
      expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()
      expect(onDirtyChange).toHaveBeenLastCalledWith(true)
      const beforeUnloadHandler = addEventListener.mock.calls
        .filter(([eventName]) => eventName === "beforeunload")
        .at(-1)?.[1]
      expect(beforeUnloadHandler).toBeTypeOf("function")
      const unsafeEvent = new Event("beforeunload", { cancelable: true })
      ;(beforeUnloadHandler as EventListener)(unsafeEvent)
      expect(unsafeEvent.defaultPrevented).toBe(true)

      await user.click(within(secondGroup).getByRole("button", { name: /Nhập nhiều dòng/ }))
      expect(within(secondGroup).getByLabelText("Nội dung nhập nhanh")).toHaveValue("")
      await user.type(within(secondGroup).getByLabelText("Nội dung nhập nhanh"), "Buffer nhóm 2")

      await user.click(within(firstGroup).getByRole("button", { name: /Nhập nhiều dòng/ }))
      expect(within(firstGroup).getByLabelText("Nội dung nhập nhanh")).toHaveValue("Buffer nhóm 1")
      expect(baseline.onSave).not.toHaveBeenCalled()
    } finally {
      addEventListener.mockRestore()
    }
  })

  it("keeps pending-buffer delete and reload controls focusable while blocking actions", async () => {
    const user = userEvent.setup()
    const originalConflict = baseline.isConflict
    const confirmSpy = vi.spyOn(window, "confirm")
    baseline.isConflict = true

    try {
      renderBaselineTab()

      const firstGroup = await screen.findByRole("region", { name: "Nhóm tiêu chí I" })
      await user.click(within(firstGroup).getByRole("button", { name: /Nhập nhiều dòng/ }))
      await user.type(within(firstGroup).getByLabelText("Nội dung nhập nhanh"), "Buffer chưa xử lý")

      const pendingExplanation = screen.getByText(
        "Hoàn tất hoặc hủy phần nhập nhiều dòng trước khi lưu."
      )
      const deleteButton = screen.getByRole("button", { name: "Xóa nhóm I" })
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

  it("renders every group inline and keeps requirement cells directly focusable", async () => {
    const user = userEvent.setup()
    renderBaselineTab()

    const firstGroup = await screen.findByRole("region", { name: "Nhóm tiêu chí I" })
    const secondGroup = screen.getByRole("region", { name: "Nhóm tiêu chí II" })
    expect(
      within(firstGroup).getByLabelText("Nội dung yêu cầu tiêu chí trực tiếp 1 của nhóm I")
    ).toBeInTheDocument()

    const secondRequirement = within(secondGroup).getByLabelText(
      "Nội dung yêu cầu tiêu chí trực tiếp 1 của nhóm II"
    )
    await user.click(secondRequirement)
    expect(secondRequirement).toHaveFocus()
  })

  it("returns from cancel to row mode and keeps focus on the bulk mode trigger", async () => {
    const user = userEvent.setup()
    renderBaselineTab()

    const firstGroup = await screen.findByRole("region", { name: "Nhóm tiêu chí I" })
    await user.click(within(firstGroup).getByRole("button", { name: /Nhập nhiều dòng/ }))
    await user.type(within(firstGroup).getByLabelText("Nội dung nhập nhanh"), "Tiêu chí chưa nhận")
    await user.click(within(firstGroup).getByRole("button", { name: "Hủy nhập" }))

    expect(
      within(firstGroup).getByLabelText("Nội dung yêu cầu tiêu chí trực tiếp 1 của nhóm I")
    ).toBeInTheDocument()
    expect(within(firstGroup).getByRole("button", { name: /Nhập nhiều dòng/ })).toHaveFocus()
  })
})
