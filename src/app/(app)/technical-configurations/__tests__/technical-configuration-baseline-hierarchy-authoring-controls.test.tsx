import { useState } from "react"
import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationBaselineEditor } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import {
  appendTechnicalConfigurationBaselineEditorSubgroup,
  moveTechnicalConfigurationBaselineEditorCriterionToOwner,
  moveTechnicalConfigurationBaselineEditorSubgroup,
  removeTechnicalConfigurationBaselineEditorSubgroup,
  type TechnicalConfigurationBaselineEditorCriterionOwner,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

const emptyValidation: TechnicalConfigurationBaselineEditorValidation = {
  groupErrors: {},
  subgroupErrors: {},
  criterionErrors: {},
}

const initialDraft: TechnicalConfigurationBaselineEditorDraft = {
  id: "draft-authoring",
  dossierId: "dossier-1",
  status: "draft",
  revision: 7,
  groups: [
    {
      key: "section-a",
      id: "section-a",
      name: "Yêu cầu chung",
      criteria: [
        {
          key: "criterion-direct",
          id: "criterion-direct",
          criterionCode: "TC-0001",
          title: "Nguồn điện",
          requirementText: "Nguồn điện ổn định",
        },
      ],
      subgroups: [
        {
          key: "subgroup-a",
          id: "subgroup-a",
          name: "Hạ tầng",
          criteria: [
            {
              key: "criterion-subgroup",
              id: "criterion-subgroup",
              criterionCode: "TC-0002",
              title: "Tiếp địa",
              requirementText: "Có hệ thống tiếp địa riêng",
            },
          ],
        },
        {
          key: "subgroup-b",
          id: "subgroup-b",
          name: "Môi trường",
          criteria: [],
        },
      ],
    },
    {
      key: "section-b",
      id: "section-b",
      name: "Yêu cầu bổ sung",
      criteria: [],
      subgroups: [],
    },
  ],
}

type SelectUser = {
  click: (element: Element) => Promise<void>
  keyboard: (text: string) => Promise<void>
}

async function openCriterionOwnerSelect(user: SelectUser, name: string | RegExp) {
  const trigger = screen.getByRole("combobox", { name })
  act(() => trigger.focus())
  await user.keyboard("{ArrowDown}")
}

async function selectCriterionOwnerOption(
  user: SelectUser,
  name: string | RegExp,
  optionName: string
) {
  await openCriterionOwnerSelect(user, name)
  await user.click(await screen.findByRole("option", { name: optionName }))
}

function AuthoringHarness(): React.JSX.Element {
  const [draft, setDraft] = useState(initialDraft)

  const setSubgroupName = (groupKey: string, subgroupKey: string, name: string) => {
    setDraft((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              subgroups: group.subgroups.map((subgroup) =>
                subgroup.key === subgroupKey ? { ...subgroup, name } : subgroup
              ),
            }
          : group
      ),
    }))
  }

  const moveCriterion = (
    sourceOwner: TechnicalConfigurationBaselineEditorCriterionOwner,
    criterionKey: string,
    targetOwner: TechnicalConfigurationBaselineEditorCriterionOwner
  ) => {
    setDraft((current) =>
      moveTechnicalConfigurationBaselineEditorCriterionToOwner(
        current,
        sourceOwner,
        criterionKey,
        targetOwner
      )
    )
  }

  return (
    <TechnicalConfigurationBaselineEditor
      draft={draft}
      validation={emptyValidation}
      summaryValidation={emptyValidation}
      status={{
        dirty: true,
        saving: false,
        editingDisabled: false,
        conflict: false,
        saveStatus: "idle",
        hasPendingBulkInput: false,
      }}
      isFocusMode={false}
      activeValue="section-a"
      entryMode="row"
      getBulkSession={() => ({ input: "", preview: null })}
      focusTarget={null}
      recentlyAcceptedCriterionKeys={new Set()}
      onGroupModeChange={vi.fn()}
      onAddGroup={vi.fn()}
      onGroupNameChange={vi.fn()}
      onMoveGroup={vi.fn()}
      onDeleteGroup={vi.fn()}
      onCriterionTextChange={vi.fn()}
      onMoveCriterion={vi.fn()}
      onDeleteCriterion={vi.fn()}
      onAddCriterion={vi.fn()}
      onBulkInputChange={vi.fn()}
      onBulkPreview={vi.fn()}
      onBulkCancel={vi.fn()}
      onBulkAccept={vi.fn()}
      onSave={vi.fn()}
      hierarchyAuthoring={{
        activeOwnerKey: "section-a",
        entryMode: "row",
        getBulkSession: () => ({ input: "", preview: null }),
        onOwnerModeChange: vi.fn(),
        onAddSubgroup: (groupKey) =>
          setDraft((current) =>
            appendTechnicalConfigurationBaselineEditorSubgroup(current, groupKey)
          ),
        onSubgroupNameChange: setSubgroupName,
        onMoveSubgroup: (groupKey, subgroupIndex, offset) =>
          setDraft((current) =>
            moveTechnicalConfigurationBaselineEditorSubgroup(
              current,
              groupKey,
              subgroupIndex,
              offset
            )
          ),
        onDeleteSubgroup: (groupKey, subgroupKey) =>
          setDraft((current) =>
            removeTechnicalConfigurationBaselineEditorSubgroup(current, groupKey, subgroupKey)
          ),
        onCriterionTextChange: vi.fn(),
        onMoveCriterionWithinOwner: vi.fn(),
        onMoveCriterionToOwner: moveCriterion,
        onDeleteCriterion: vi.fn(),
        onAddCriterion: vi.fn(),
        onBulkInputChange: vi.fn(),
        onBulkPreview: vi.fn(),
        onBulkCancel: vi.fn(),
        onBulkAccept: vi.fn(),
      }}
    />
  )
}

describe("technical configuration baseline hierarchy authoring controls", () => {
  it("creates, renames, reorders, and deletes subgroups with normalized ordinals", async () => {
    const user = userEvent.setup()
    render(<AuthoringHarness />)

    const firstSection = screen.getByRole("region", { name: "Nhóm tiêu chí I" })
    await user.click(within(firstSection).getByRole("button", { name: "Thêm nhóm con vào nhóm I" }))

    const newSubgroupName = within(firstSection).getByRole("textbox", {
      name: "Tên nhóm con 3 của nhóm I",
    })
    await user.clear(newSubgroupName)
    await user.type(newSubgroupName, "An toàn")

    expect(
      within(firstSection).getByRole("region", {
        name: "Nhóm con 3 của nhóm I: An toàn",
      })
    ).toBeInTheDocument()

    await user.click(
      within(firstSection).getByRole("button", {
        name: "Di chuyển nhóm con 3 của nhóm I lên",
      })
    )

    expect(
      within(firstSection).getByRole("textbox", { name: "Tên nhóm con 2 của nhóm I" })
    ).toHaveValue("An toàn")

    await user.click(
      within(firstSection).getByRole("button", { name: "Xóa nhóm con 2 của nhóm I" })
    )

    expect(
      within(firstSection).queryByRole("textbox", { name: "Tên nhóm con 3 của nhóm I" })
    ).not.toBeInTheDocument()
    expect(
      within(firstSection).getByRole("textbox", { name: "Tên nhóm con 2 của nhóm I" })
    ).toHaveValue("Môi trường")
  })

  it("moves a criterion between direct and subgroup owners without changing identity", async () => {
    const user = userEvent.setup()
    render(<AuthoringHarness />)

    await selectCriterionOwnerOption(user, "Chuyển tiêu chí trực tiếp 1 của nhóm I", "I.1 Hạ tầng")

    const subgroup = screen.getByRole("region", {
      name: "Nhóm con 1 của nhóm I: Hạ tầng",
    })
    expect(within(subgroup).getByDisplayValue("Nguồn điện ổn định")).toBeInTheDocument()
    expect(within(subgroup).getByText("TC-0001")).toBeInTheDocument()

    await selectCriterionOwnerOption(
      user,
      "Chuyển tiêu chí 2 của nhóm con 1, nhóm I",
      "II. Yêu cầu bổ sung - Trực tiếp"
    )

    const secondSection = screen.getByRole("region", { name: "Nhóm tiêu chí II" })
    expect(within(secondSection).getByDisplayValue("Nguồn điện ổn định")).toBeInTheDocument()
    expect(within(secondSection).getByText("TC-0001")).toBeInTheDocument()
  })

  it("keeps hierarchy authoring controls absent unless the capability is provided", () => {
    render(
      <TechnicalConfigurationBaselineEditor
        draft={initialDraft}
        validation={emptyValidation}
        summaryValidation={emptyValidation}
        status={{
          dirty: false,
          saving: false,
          editingDisabled: false,
          conflict: false,
          saveStatus: "idle",
          hasPendingBulkInput: false,
        }}
        isFocusMode={false}
        activeValue="section-a"
        entryMode="row"
        getBulkSession={() => ({ input: "", preview: null })}
        focusTarget={null}
        recentlyAcceptedCriterionKeys={new Set()}
        onGroupModeChange={vi.fn()}
        onAddGroup={vi.fn()}
        onGroupNameChange={vi.fn()}
        onMoveGroup={vi.fn()}
        onDeleteGroup={vi.fn()}
        onCriterionTextChange={vi.fn()}
        onMoveCriterion={vi.fn()}
        onDeleteCriterion={vi.fn()}
        onAddCriterion={vi.fn()}
        onBulkInputChange={vi.fn()}
        onBulkPreview={vi.fn()}
        onBulkCancel={vi.fn()}
        onBulkAccept={vi.fn()}
        onSave={vi.fn()}
      />
    )

    expect(screen.queryByRole("button", { name: /Thêm nhóm con/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: /Chuyển tiêu chí/i })).not.toBeInTheDocument()
  })
})
