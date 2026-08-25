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
  subgroupErrors: {},
  criterionErrors: {},
}

const hierarchyDraft: TechnicalConfigurationBaselineEditorDraft = {
  id: "draft-hierarchy-entry",
  dossierId: "dossier-1",
  status: "draft",
  revision: 3,
  groups: [
    {
      key: "section-a",
      id: "section-a",
      name: "Yêu cầu chung",
      criteria: [],
      subgroups: [
        {
          key: "subgroup-a",
          id: "subgroup-a",
          name: "Hạ tầng",
          criteria: [],
        },
      ],
    },
  ],
}

function renderHierarchyEditor(initialDraft = hierarchyDraft) {
  const onEditorChange = vi.fn()
  const rendered = renderHook(
    ({ draft }: { draft: TechnicalConfigurationBaselineEditorDraft }) => {
      const bulkSessions = useTechnicalConfigurationBulkEntrySessions()
      const editor = useTechnicalConfigurationInlineEditor({
        draft,
        validation: emptyValidation,
        saveStatus: "idle",
        bulkSessions,
        onEditorChange,
      })
      return { bulkSessions, editor }
    },
    { initialProps: { draft: initialDraft } }
  )

  return { ...rendered, onEditorChange }
}

describe("technical configuration baseline hierarchy authoring entry", () => {
  it("adds and edits one subgroup criterion through the canonical owner", async () => {
    const { result, rerender, onEditorChange } = renderHierarchyEditor()
    await waitFor(() => expect(result.current.editor.activeValue).toBe("section-a"))

    act(() =>
      result.current.editor.hierarchyAuthoring.onAddCriterion({
        groupKey: "section-a",
        subgroupKey: "subgroup-a",
      })
    )

    const addedDraft = onEditorChange.mock
      .lastCall?.[0] as TechnicalConfigurationBaselineEditorDraft
    const addedCriterion = addedDraft.groups[0].subgroups[0].criteria[0]
    expect(addedCriterion).toMatchObject({
      id: null,
      criterionCode: null,
      title: "",
      requirementText: "",
    })
    expect(result.current.editor.focusTarget).toMatchObject({
      kind: "criterion",
      key: addedCriterion.key,
    })

    rerender({ draft: addedDraft })
    onEditorChange.mockClear()
    act(() =>
      result.current.editor.hierarchyAuthoring.onCriterionTextChange(
        { groupKey: "section-a", subgroupKey: "subgroup-a" },
        addedCriterion.key,
        "requirementText",
        "Yêu cầu tiếp địa"
      )
    )
    const editedDraft = onEditorChange.mock
      .lastCall?.[0] as TechnicalConfigurationBaselineEditorDraft
    expect(editedDraft.groups[0].subgroups[0].criteria[0].requirementText).toBe("Yêu cầu tiếp địa")
  })

  it("keeps direct and subgroup multiline buffers independent and accepts only the active owner", async () => {
    const { result, onEditorChange } = renderHierarchyEditor()
    await waitFor(() => expect(result.current.editor.activeValue).toBe("section-a"))

    act(() => {
      result.current.bulkSessions.setInput("section-a", "Yêu cầu trực tiếp đang chờ")
      result.current.editor.hierarchyAuthoring.onOwnerModeChange("subgroup-a", "bulk")
      result.current.editor.hierarchyAuthoring.onBulkInputChange(
        "subgroup-a",
        "Tiếp địa riêng\nNhiệt độ phòng phù hợp"
      )
    })

    act(() => result.current.editor.hierarchyAuthoring.onBulkPreview("subgroup-a"))
    expect(result.current.bulkSessions.getSession("section-a").input).toBe(
      "Yêu cầu trực tiếp đang chờ"
    )
    expect(result.current.bulkSessions.getSession("subgroup-a").preview?.rows).toHaveLength(2)

    act(() =>
      result.current.editor.hierarchyAuthoring.onBulkAccept({
        groupKey: "section-a",
        subgroupKey: "subgroup-a",
      })
    )

    const acceptedDraft = onEditorChange.mock
      .lastCall?.[0] as TechnicalConfigurationBaselineEditorDraft
    expect(
      acceptedDraft.groups[0].subgroups[0].criteria.map((criterion) => criterion.requirementText)
    ).toEqual(["Tiếp địa riêng", "Nhiệt độ phòng phù hợp"])
    expect(result.current.bulkSessions.getSession("section-a").input).toBe(
      "Yêu cầu trực tiếp đang chờ"
    )
    expect(result.current.bulkSessions.getSession("subgroup-a")).toEqual({
      input: "",
      preview: null,
    })
  })

  it("uses group-scoped focus targets for direct-owner bulk transitions", async () => {
    const { result } = renderHierarchyEditor()
    await waitFor(() => expect(result.current.editor.activeValue).toBe("section-a"))

    act(() => result.current.editor.hierarchyAuthoring.onOwnerModeChange("section-a", "bulk"))
    expect(result.current.editor.focusTarget).toMatchObject({
      kind: "bulk-input",
      key: "section-a",
    })

    act(() => result.current.editor.hierarchyAuthoring.onBulkCancel("section-a"))
    expect(result.current.editor.focusTarget).toMatchObject({
      kind: "group-mode-action",
      key: "section-a",
    })
  })

  it("removes only the deleted subgroup buffer during owner synchronization", async () => {
    const { result, rerender } = renderHierarchyEditor()
    await waitFor(() => expect(result.current.editor.activeValue).toBe("section-a"))

    act(() => {
      result.current.bulkSessions.setInput("section-a", "Giữ lại")
      result.current.bulkSessions.setInput("subgroup-a", "Xóa cùng nhóm con")
    })

    rerender({
      draft: {
        ...hierarchyDraft,
        groups: [{ ...hierarchyDraft.groups[0], subgroups: [] }],
      },
    })

    await waitFor(() => expect(result.current.bulkSessions.getSession("subgroup-a").input).toBe(""))
    expect(result.current.bulkSessions.getSession("section-a").input).toBe("Giữ lại")
  })

  it("uses one hierarchy command transition for DnD and menu criterion moves", async () => {
    const sourceCriterion = {
      key: "criterion-source",
      id: "criterion-source",
      criterionCode: "TC-0001",
      title: "-",
      requirementText: "Nguồn điện ổn định",
    }
    const commandDraft: TechnicalConfigurationBaselineEditorDraft = {
      ...hierarchyDraft,
      groups: [
        {
          ...hierarchyDraft.groups[0],
          criteria: [sourceCriterion],
        },
      ],
    }
    const dnd = renderHierarchyEditor(commandDraft)
    const menu = renderHierarchyEditor(commandDraft)
    await waitFor(() => expect(dnd.result.current.editor.activeValue).toBe("section-a"))
    await waitFor(() => expect(menu.result.current.editor.activeValue).toBe("section-a"))

    const hierarchyCommand = (
      dnd.result.current.editor
        .hierarchyAuthoring as typeof dnd.result.current.editor.hierarchyAuthoring & {
        onHierarchyCommand?: (command: {
          type: "move-criterion"
          sourceOwner: { groupKey: string; subgroupKey: string | null }
          criterionKey: string
          targetOwner: { groupKey: string; subgroupKey: string | null }
          targetIndex: number
        }) => void
      }
    ).onHierarchyCommand
    expect(hierarchyCommand).toEqual(expect.any(Function))

    act(() =>
      hierarchyCommand?.({
        type: "move-criterion",
        sourceOwner: { groupKey: "section-a", subgroupKey: null },
        criterionKey: sourceCriterion.key,
        targetOwner: { groupKey: "section-a", subgroupKey: "subgroup-a" },
        targetIndex: 0,
      })
    )
    act(() =>
      menu.result.current.editor.hierarchyAuthoring.onMoveCriterionToOwner(
        { groupKey: "section-a", subgroupKey: null },
        sourceCriterion.key,
        { groupKey: "section-a", subgroupKey: "subgroup-a" }
      )
    )

    const dndDraft = dnd.onEditorChange.mock.lastCall?.[0]
    const menuDraft = menu.onEditorChange.mock.lastCall?.[0]
    expect(dndDraft).toEqual(menuDraft)
    expect(dnd.result.current.editor.activeValue).toBe("subgroup-a")
    expect(menu.result.current.editor.activeValue).toBe("subgroup-a")
    expect(dnd.result.current.editor.focusTarget).toMatchObject({
      kind: "criterion",
      key: sourceCriterion.key,
    })
    expect(menu.result.current.editor.focusTarget).toMatchObject({
      kind: "criterion",
      key: sourceCriterion.key,
    })
  })
})
