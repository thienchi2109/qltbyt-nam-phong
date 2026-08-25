import { useState } from "react"
import { vi } from "vitest"

import {
  TechnicalConfigurationBaselineEditor,
  type TechnicalConfigurationFocusTarget,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

export const hierarchyDraft: TechnicalConfigurationBaselineEditorDraft = {
  id: "draft-hierarchy",
  dossierId: "dossier-1",
  status: "draft",
  revision: 4,
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

const emptyValidation: TechnicalConfigurationBaselineEditorValidation = {
  groupErrors: {},
  subgroupErrors: {},
  criterionErrors: {},
}

export const scrollIntoViewMock = vi.fn()
const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollIntoView"
)

export function installSubgroupPresentationScrollMock(): void {
  scrollIntoViewMock.mockClear()
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoViewMock,
  })
}

export function restoreSubgroupPresentationScrollMock(): void {
  if (originalScrollIntoViewDescriptor) {
    Object.defineProperty(Element.prototype, "scrollIntoView", originalScrollIntoViewDescriptor)
  } else {
    Reflect.deleteProperty(Element.prototype, "scrollIntoView")
  }
}

export function HierarchyHarness({
  draft = hierarchyDraft,
  validation = emptyValidation,
  initialMode = "row",
  initialPendingInput = "",
  editingDisabled = false,
}: {
  draft?: TechnicalConfigurationBaselineEditorDraft
  validation?: TechnicalConfigurationBaselineEditorValidation
  initialMode?: "row" | "bulk"
  initialPendingInput?: string
  editingDisabled?: boolean
}): React.JSX.Element {
  const [focusTarget, setFocusTarget] = useState<TechnicalConfigurationFocusTarget>(null)
  const [entryMode, setEntryMode] = useState<"row" | "bulk">(initialMode)
  const [pendingInput, setPendingInput] = useState(initialPendingInput)

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setFocusTarget((current) => ({
            kind: "criterion",
            key: "criterion-subgroup",
            token: current?.kind === "criterion" ? current.token + 1 : 1,
          }))
        }
      >
        Tập trung tiêu chí nhóm con
      </button>
      <TechnicalConfigurationBaselineEditor
        draft={draft}
        validation={validation}
        summaryValidation={validation}
        status={{
          dirty: false,
          saving: false,
          editingDisabled,
          conflict: false,
          saveStatus: "idle",
          hasPendingBulkInput: pendingInput.trim().length > 0,
        }}
        isFocusMode={false}
        activeValue="section-a"
        entryMode={entryMode}
        getBulkSession={() => ({ input: pendingInput, preview: null })}
        focusTarget={focusTarget}
        recentlyAcceptedCriterionKeys={new Set()}
        onGroupModeChange={(_, mode) => setEntryMode(mode)}
        onAddGroup={vi.fn()}
        onGroupNameChange={vi.fn()}
        onMoveGroup={vi.fn()}
        onDeleteGroup={vi.fn()}
        onCriterionTextChange={vi.fn()}
        onMoveCriterion={vi.fn()}
        onDeleteCriterion={vi.fn()}
        onAddCriterion={vi.fn()}
        onBulkInputChange={setPendingInput}
        onBulkPreview={vi.fn()}
        onBulkCancel={() => setPendingInput("")}
        onBulkAccept={vi.fn()}
        onSave={vi.fn()}
      />
    </>
  )
}
