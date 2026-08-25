import { describe, expect, it } from "vitest"

import type { TechnicalConfigurationBaselineDndCommand } from "@/app/(app)/technical-configurations/technical-configuration-baseline-dnd"
import * as baselineDnd from "@/app/(app)/technical-configurations/technical-configuration-baseline-dnd"

type DragEndCommandProjector = (input: {
  canceled: boolean
  projectedIndex?: number
  sourceData: unknown
  targetData: unknown
}) => TechnicalConfigurationBaselineDndCommand | null

function getDragEndCommandProjector(): DragEndCommandProjector {
  const projector = (
    baselineDnd as typeof baselineDnd & {
      projectTechnicalConfigurationBaselineDndDragEndCommand?: DragEndCommandProjector
    }
  ).projectTechnicalConfigurationBaselineDndDragEndCommand

  expect(projector).toEqual(expect.any(Function))
  return projector as DragEndCommandProjector
}

describe("technical configuration baseline DnD drag-end integration", () => {
  it.each(["pointer", "keyboard"])("projects a %s drop into an empty direct-group owner", () => {
    const projectDragEndCommand = getDragEndCommandProjector()
    const sourceOwner = { groupKey: "group-1", subgroupKey: "subgroup-1" }
    const targetOwner = { groupKey: "group-2", subgroupKey: null }

    expect(
      projectDragEndCommand({
        canceled: false,
        sourceData: {
          active: {
            kind: "criterion",
            owner: sourceOwner,
            criterionKey: "criterion-1",
            index: 0,
          },
          label: "Tiêu chí nguồn",
        },
        targetData: {
          target: { kind: "criterion", owner: targetOwner, index: 0 },
          targetMode: "owner",
        },
      })
    ).toEqual({
      type: "move-criterion",
      sourceOwner,
      criterionKey: "criterion-1",
      targetOwner,
      targetIndex: 0,
    })
  })

  it.each(["pointer", "keyboard"])("projects a %s drop into an empty subgroup owner", () => {
    const projectDragEndCommand = getDragEndCommandProjector()
    const sourceOwner = { groupKey: "group-1", subgroupKey: null }
    const targetOwner = { groupKey: "group-2", subgroupKey: "subgroup-2" }

    expect(
      projectDragEndCommand({
        canceled: false,
        sourceData: {
          active: {
            kind: "criterion",
            owner: sourceOwner,
            criterionKey: "criterion-1",
            index: 1,
          },
          label: "Tiêu chí nguồn",
        },
        targetData: {
          target: { kind: "criterion", owner: targetOwner, index: 0 },
          targetMode: "owner",
        },
      })
    ).toMatchObject({
      type: "move-criterion",
      targetOwner,
      targetIndex: 0,
    })
  })

  it("uses the sortable projected index while preserving group and subgroup boundaries", () => {
    const projectDragEndCommand = getDragEndCommandProjector()

    expect(
      projectDragEndCommand({
        canceled: false,
        projectedIndex: 2,
        sourceData: {
          active: { kind: "group", groupKey: "group-1", index: 0 },
          label: "Nhóm I",
        },
        targetData: {
          target: { kind: "group", index: 2 },
          targetMode: "sortable",
        },
      })
    ).toEqual({
      type: "move-group",
      groupKey: "group-1",
      targetIndex: 2,
    })

    expect(
      projectDragEndCommand({
        canceled: false,
        projectedIndex: 0,
        sourceData: {
          active: {
            kind: "subgroup",
            groupKey: "group-1",
            subgroupKey: "subgroup-1",
            index: 1,
          },
          label: "Nhóm con 2",
        },
        targetData: {
          target: { kind: "subgroup", groupKey: "group-2", index: 0 },
          targetMode: "sortable",
        },
      })
    ).toBeNull()
  })

  it("returns no command for cancel, invalid data, and sortable no-op events", () => {
    const projectDragEndCommand = getDragEndCommandProjector()
    const sourceData = {
      active: { kind: "group" as const, groupKey: "group-1", index: 1 },
      label: "Nhóm II",
    }
    const targetData = {
      target: { kind: "group" as const, index: 1 },
      targetMode: "sortable" as const,
    }

    expect(
      projectDragEndCommand({
        canceled: true,
        sourceData,
        targetData,
      })
    ).toBeNull()
    expect(
      projectDragEndCommand({
        canceled: false,
        sourceData: {},
        targetData,
      })
    ).toBeNull()
    expect(
      projectDragEndCommand({
        canceled: false,
        projectedIndex: 1,
        sourceData,
        targetData,
      })
    ).toBeNull()
  })
})
