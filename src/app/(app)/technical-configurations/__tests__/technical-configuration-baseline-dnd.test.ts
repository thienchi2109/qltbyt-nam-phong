import { describe, expect, it } from "vitest"

import {
  moveTechnicalConfigurationBaselineEditorCriterionToOwner,
  moveTechnicalConfigurationBaselineEditorGroupToIndex,
  moveTechnicalConfigurationBaselineEditorSubgroupToIndex,
  toTechnicalConfigurationBaselineEditorDraft,
  type TechnicalConfigurationBaselineEditorDraft,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import {
  projectTechnicalConfigurationBaselineDndCommand,
  type TechnicalConfigurationBaselineDndCommand,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-dnd"

import {
  group,
  subgroup,
  wireDraft,
} from "./technical-configuration-baseline-hierarchy-editor-state-fixtures"

function applyCommand(
  draft: TechnicalConfigurationBaselineEditorDraft,
  command: TechnicalConfigurationBaselineDndCommand | null
): TechnicalConfigurationBaselineEditorDraft {
  if (!command) return draft

  switch (command.type) {
    case "move-group":
      return moveTechnicalConfigurationBaselineEditorGroupToIndex(
        draft,
        command.groupKey,
        command.targetIndex
      )
    case "move-subgroup":
      return moveTechnicalConfigurationBaselineEditorSubgroupToIndex(
        draft,
        command.groupKey,
        command.subgroupKey,
        command.targetIndex
      )
    case "move-criterion":
      return moveTechnicalConfigurationBaselineEditorCriterionToOwner(
        draft,
        command.sourceOwner,
        command.criterionKey,
        command.targetOwner,
        command.targetIndex
      )
  }
}

describe("technical configuration baseline DnD projection", () => {
  it("creates stable-key group and same-parent subgroup commands", () => {
    expect(
      projectTechnicalConfigurationBaselineDndCommand(
        { kind: "group", groupKey: "group-1", index: 0 },
        { kind: "group", index: 3 }
      )
    ).toEqual({
      type: "move-group",
      groupKey: "group-1",
      targetIndex: 2,
    })
    expect(
      projectTechnicalConfigurationBaselineDndCommand(
        {
          kind: "subgroup",
          groupKey: "group-1",
          subgroupKey: "subgroup-1",
          index: 2,
        },
        { kind: "subgroup", groupKey: "group-1", index: 0 }
      )
    ).toEqual({
      type: "move-subgroup",
      groupKey: "group-1",
      subgroupKey: "subgroup-1",
      targetIndex: 0,
    })
  })

  it("rejects a cross-parent subgroup drop before canonical mutation", () => {
    const draft = toTechnicalConfigurationBaselineEditorDraft(
      wireDraft({
        groups: [
          group(),
          group({
            id: "group-2",
            name: "Group 2",
            criteria: [],
            subgroups: [
              subgroup({
                id: "subgroup-2",
                group_id: "group-2",
                name: "Subgroup 2",
                criteria: [],
              }),
            ],
          }),
        ],
      })
    )
    const command = projectTechnicalConfigurationBaselineDndCommand(
      {
        kind: "subgroup",
        groupKey: "group-1",
        subgroupKey: "subgroup-1",
        index: 0,
      },
      { kind: "subgroup", groupKey: "group-2", index: 0 }
    )

    expect(command).toBeNull()
    expect(applyCommand(draft, command)).toBe(draft)
  })

  it("creates a criterion move command from the active item, target owner, and target index", () => {
    const directOwner = { groupKey: "group-1", subgroupKey: null }
    const subgroupOwner = { groupKey: "group-2", subgroupKey: "subgroup-2" }

    expect(
      projectTechnicalConfigurationBaselineDndCommand(
        {
          kind: "criterion",
          owner: directOwner,
          criterionKey: "criterion-direct",
          index: 1,
        },
        { kind: "criterion", owner: subgroupOwner, index: 2 }
      )
    ).toEqual({
      type: "move-criterion",
      sourceOwner: directOwner,
      criterionKey: "criterion-direct",
      targetOwner: subgroupOwner,
      targetIndex: 2,
    })
  })

  it("adjusts criterion target indexes for same-owner downward and upward movement", () => {
    const owner = { groupKey: "group-1", subgroupKey: null }

    expect(
      projectTechnicalConfigurationBaselineDndCommand(
        {
          kind: "criterion",
          owner,
          criterionKey: "criterion-first",
          index: 0,
        },
        { kind: "criterion", owner, index: 4 }
      )
    ).toMatchObject({
      type: "move-criterion",
      criterionKey: "criterion-first",
      targetIndex: 3,
    })
    expect(
      projectTechnicalConfigurationBaselineDndCommand(
        {
          kind: "criterion",
          owner,
          criterionKey: "criterion-last",
          index: 3,
        },
        { kind: "criterion", owner, index: 1 }
      )
    ).toMatchObject({
      type: "move-criterion",
      criterionKey: "criterion-last",
      targetIndex: 1,
    })
  })

  it("returns no command for cancel, invalid targets, and no-op drops", () => {
    const draft = toTechnicalConfigurationBaselineEditorDraft(wireDraft())
    const owner = { groupKey: "group-1", subgroupKey: null }
    const active = {
      kind: "criterion" as const,
      owner,
      criterionKey: "criterion-direct",
      index: 0,
    }
    const commands = [
      projectTechnicalConfigurationBaselineDndCommand(active, null),
      projectTechnicalConfigurationBaselineDndCommand(active, { kind: "group", index: 0 }),
      projectTechnicalConfigurationBaselineDndCommand(active, {
        kind: "criterion",
        owner,
        index: 1,
      }),
      projectTechnicalConfigurationBaselineDndCommand(active, {
        kind: "criterion",
        owner,
        index: -1,
      }),
    ]

    expect(commands).toEqual([null, null, null, null])
    for (const command of commands) {
      expect(applyCommand(draft, command)).toBe(draft)
    }
  })
})
