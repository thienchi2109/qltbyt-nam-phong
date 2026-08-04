import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useTechnicalConfigurationBulkEntrySessions } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import { useTechnicalConfigurationInlineEditor } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationInlineEditor"
import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

const emptyValidation: TechnicalConfigurationBaselineEditorValidation = {
  groupErrors: {},
  criterionErrors: {},
}

const clientDraft: TechnicalConfigurationBaselineEditorDraft = {
  id: "draft-1",
  dossierId: "dossier-1",
  status: "draft",
  revision: 4,
  groups: [
    {
      key: "client-group-1",
      id: null,
      name: "Nhóm mới",
      criteria: [],
    },
  ],
}

const serverDraft: TechnicalConfigurationBaselineEditorDraft = {
  ...clientDraft,
  revision: 5,
  groups: [
    {
      ...clientDraft.groups[0],
      key: "group-5",
      id: "group-5",
    },
  ],
}

const multiGroupDraft: TechnicalConfigurationBaselineEditorDraft = {
  ...clientDraft,
  groups: [
    {
      key: "group-a",
      id: "group-a",
      name: "Nhóm A",
      criteria: [
        {
          key: "criterion-a-first",
          id: "criterion-a-first",
          criterionCode: "TC-0001",
          title: "Tiêu chí đầu",
          requirementText: "Yêu cầu đầu",
        },
        {
          key: "criterion-a-error",
          id: "criterion-a-error",
          criterionCode: "TC-0002",
          title: "Tiêu chí lỗi",
          requirementText: "",
        },
      ],
    },
    {
      key: "group-b",
      id: "group-b",
      name: "Nhóm B",
      criteria: [
        {
          key: "criterion-b-first",
          id: "criterion-b-first",
          criterionCode: "TC-0003",
          title: "Tiêu chí B",
          requirementText: "Yêu cầu B",
        },
      ],
    },
    {
      key: "group-c",
      id: "group-c",
      name: "Nhóm C",
      criteria: [],
    },
  ],
}

const validationWithCriterionError: TechnicalConfigurationBaselineEditorValidation = {
  groupErrors: {},
  criterionErrors: {
    "criterion-a-error": "Nội dung yêu cầu là bắt buộc.",
  },
}

function renderInlineEditor(
  initialDraft: TechnicalConfigurationBaselineEditorDraft,
  validation: TechnicalConfigurationBaselineEditorValidation = emptyValidation
) {
  const onEditorChange = vi.fn()
  const hook = renderHook(
    ({
      draft,
      currentValidation,
    }: {
      draft: TechnicalConfigurationBaselineEditorDraft
      currentValidation: TechnicalConfigurationBaselineEditorValidation
    }) => {
      const bulkSessions = useTechnicalConfigurationBulkEntrySessions()
      const editor = useTechnicalConfigurationInlineEditor({
        draft,
        validation: currentValidation,
        saveStatus: "idle",
        bulkSessions,
        onEditorChange,
      })
      return { bulkSessions, editor }
    },
    { initialProps: { draft: initialDraft, currentValidation: validation } }
  )

  return { ...hook, onEditorChange }
}

describe("useTechnicalConfigurationInlineEditor", () => {
  it("opens multiline mode atomically for the specified group", async () => {
    const { result } = renderInlineEditor(multiGroupDraft)

    await waitFor(() => expect(result.current.editor.activeValue).toBe("group-a"))
    act(() => result.current.editor.setGroupMode("group-b", "bulk"))

    expect(result.current.editor.activeValue).toBe("group-b")
    expect(result.current.editor.entryMode).toBe("bulk")
    expect(result.current.editor.focusTarget).toMatchObject({ kind: "bulk-input" })
  })

  it("returns the specified group to row mode using its validation-aware focus fallback", async () => {
    const { result } = renderInlineEditor(multiGroupDraft, validationWithCriterionError)

    await waitFor(() => expect(result.current.editor.activeValue).toBe("group-a"))

    act(() => result.current.editor.setGroupMode("group-a", "bulk"))
    act(() => result.current.editor.setGroupMode("group-a", "row"))
    expect(result.current.editor.focusTarget).toMatchObject({
      kind: "criterion",
      key: "criterion-a-error",
    })

    act(() => result.current.editor.setGroupMode("group-b", "bulk"))
    act(() => result.current.editor.setGroupMode("group-b", "row"))
    expect(result.current.editor.focusTarget).toMatchObject({
      kind: "criterion",
      key: "criterion-b-first",
    })

    act(() => result.current.editor.setGroupMode("group-c", "bulk"))
    act(() => result.current.editor.setGroupMode("group-c", "row"))
    expect(result.current.editor.focusTarget).toMatchObject({
      kind: "add-criterion",
      key: "group-c",
    })
  })

  it("targets the non-active group after deleting its final criterion", async () => {
    const { result } = renderInlineEditor(multiGroupDraft)

    await waitFor(() => expect(result.current.editor.activeValue).toBe("group-a"))
    act(() => result.current.editor.deleteCriterion("group-b", "criterion-b-first"))

    expect(result.current.editor.activeValue).toBe("group-a")
    expect(result.current.editor.focusTarget).toMatchObject({
      kind: "add-criterion",
      key: "group-b",
    })
  })

  it("clears recent highlights but preserves both bulk buffers when switching groups", async () => {
    const { result } = renderInlineEditor(multiGroupDraft)

    await waitFor(() => expect(result.current.editor.activeValue).toBe("group-a"))
    act(() => result.current.editor.setGroupMode("group-a", "bulk"))
    act(() => {
      result.current.bulkSessions.setInput("group-a", "A-1")
      result.current.bulkSessions.setInput("group-b", "B-1")
      result.current.bulkSessions.setRecentlyAccepted(["criterion-a-first"])
    })

    expect(result.current.bulkSessions.recentlyAcceptedCriterionKeys).toContain("criterion-a-first")

    act(() => result.current.editor.setGroupMode("group-b", "bulk"))

    expect(result.current.bulkSessions.recentlyAcceptedCriterionKeys).toHaveLength(0)
    expect(result.current.bulkSessions.getSession("group-a").input).toBe("A-1")
    expect(result.current.bulkSessions.getSession("group-b").input).toBe("B-1")
  })

  it("preserves the active group by ordered position and clears stale focus after save", async () => {
    const { result, rerender } = renderInlineEditor(clientDraft)

    await waitFor(() => expect(result.current.editor.activeValue).toBe("client-group-1"))
    act(() => result.current.editor.setGroupMode("client-group-1", "bulk"))
    expect(result.current.editor.focusTarget).toMatchObject({ kind: "bulk-input" })

    rerender({ draft: serverDraft, currentValidation: emptyValidation })

    await waitFor(() => expect(result.current.editor.activeValue).toBe("group-5"))
    expect(result.current.editor.focusTarget).toBeNull()
  })

  it("focuses the next group disclosure after deleting a group", async () => {
    const { result } = renderInlineEditor(multiGroupDraft)

    await waitFor(() => expect(result.current.editor.activeValue).toBe("group-a"))
    act(() => result.current.editor.deleteGroup("group-a"))

    expect(result.current.editor.activeValue).toBe("group-b")
    expect(result.current.editor.focusTarget).toMatchObject({
      kind: "group-disclosure",
      key: "group-b",
    })
  })

  it("focuses Add group after deleting the final group", async () => {
    const { result } = renderInlineEditor(clientDraft)

    await waitFor(() => expect(result.current.editor.activeValue).toBe("client-group-1"))
    act(() => result.current.editor.deleteGroup("client-group-1"))

    expect(result.current.editor.activeValue).toBe("")
    expect(result.current.editor.focusTarget).toMatchObject({ kind: "add-group" })
  })

  it("focuses the specified group mode action after cancelling multiline input", async () => {
    const { result } = renderInlineEditor(multiGroupDraft)

    await waitFor(() => expect(result.current.editor.activeValue).toBe("group-a"))
    act(() => result.current.editor.setGroupMode("group-b", "bulk"))
    act(() => result.current.editor.cancelBulk())

    expect(result.current.editor.activeValue).toBe("group-b")
    expect(result.current.editor.entryMode).toBe("row")
    expect(result.current.editor.focusTarget).toMatchObject({
      kind: "group-mode-action",
      key: "group-b",
    })
  })

  it("focuses the first reloaded group disclosure after conflict reload", () => {
    const { result } = renderInlineEditor(multiGroupDraft)

    act(() => result.current.editor.prepareForReload("group-b"))

    expect(result.current.editor.activeValue).toBe("group-b")
    expect(result.current.editor.focusTarget).toMatchObject({
      kind: "group-disclosure",
      key: "group-b",
    })
  })

  it("does not expose or activate all-groups and overview navigation state", async () => {
    const { result } = renderInlineEditor(multiGroupDraft)

    await waitFor(() => expect(result.current.editor.activeValue).toBe("group-a"))
    act(() => {
      result.current.bulkSessions.setRecentlyAccepted(["criterion-a-first"])
    })
    act(() => result.current.editor.setGroupMode("__all-groups__", "row"))

    expect(result.current.editor.activeValue).toBe("group-a")
    expect(result.current.bulkSessions.recentlyAcceptedCriterionKeys).toContain("criterion-a-first")
    expect(result.current.editor).not.toHaveProperty("activateOverviewCriterion")
    expect(result.current.editor).not.toHaveProperty("navigate")
    expect(result.current.editor).not.toHaveProperty("changeMode")
  })
})
