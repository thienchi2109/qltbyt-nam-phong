import { useState } from "react"
import { render } from "@testing-library/react"
import { vi } from "vitest"

import {
  TechnicalConfigurationBaselineGroupSection,
  type TechnicalConfigurationBaselineGroupSectionProps,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineGroupSection"
import type {
  TechnicalConfigurationEntryMode,
  TechnicalConfigurationFocusTarget,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import type { TechnicalConfigurationBulkEntrySession } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import type { TechnicalConfigurationBaselineEditorGroup } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

export const group: TechnicalConfigurationBaselineEditorGroup = {
  key: "group-2",
  id: "group-2",
  name: "Yêu cầu kỹ thuật",
  criteria: [
    {
      key: "criterion-1",
      id: "criterion-1",
      criterionCode: "TC-0001",
      title: "Nguồn điện",
      requirementText: "Nguồn điện ổn định",
    },
    {
      key: "criterion-2",
      id: "criterion-2",
      criterionCode: "TC-0002",
      title: "Áp lực",
      requirementText: "",
    },
  ],
}

export const pendingBulkSession: TechnicalConfigurationBulkEntrySession = {
  input: "Yêu cầu thứ nhất\nYêu cầu thứ hai",
  preview: null,
}

type RenderGroupSectionOptions = {
  groupValue?: TechnicalConfigurationBaselineEditorGroup
  initialExpanded?: boolean
  initialMode?: TechnicalConfigurationEntryMode
  focusTarget?: TechnicalConfigurationFocusTarget
  disabled?: boolean
  groupError?: string
  bulkSession?: TechnicalConfigurationBulkEntrySession
  hierarchyAuthoring?: TechnicalConfigurationBaselineGroupSectionProps["hierarchyAuthoring"]
}

type RenderGroupSectionResult = {
  callbacks: Record<string, ReturnType<typeof vi.fn>>
  events: string[]
}

export function renderGroupSection({
  groupValue = group,
  initialExpanded = true,
  initialMode = "row",
  focusTarget = null,
  disabled = false,
  groupError = "Tên nhóm là bắt buộc.",
  bulkSession = pendingBulkSession,
  hierarchyAuthoring,
}: RenderGroupSectionOptions = {}): RenderGroupSectionResult {
  const events: string[] = []
  const callbacks = {
    onExpandedChange: vi.fn(),
    onModeChange: vi.fn(),
    onGroupNameChange: vi.fn(),
    onMoveGroup: vi.fn(),
    onDeleteGroup: vi.fn(),
    onCriterionTextChange: vi.fn(),
    onMoveCriterion: vi.fn(),
    onDeleteCriterion: vi.fn(),
    onAddCriterion: vi.fn(),
    onBulkInputChange: vi.fn(),
    onBulkPreview: vi.fn(),
    onBulkCancel: vi.fn(),
    onBulkAccept: vi.fn(),
  }

  function Harness(): React.JSX.Element {
    const [expanded, setExpanded] = useState(initialExpanded)
    const [mode, setMode] = useState<TechnicalConfigurationEntryMode>(initialMode)
    const props: TechnicalConfigurationBaselineGroupSectionProps = {
      group: groupValue,
      groupIndex: 1,
      groupCount: 3,
      expanded,
      mode,
      bulkSession,
      groupError,
      subgroupErrors: {},
      criterionErrors: { "criterion-2": "Nội dung yêu cầu là bắt buộc." },
      summaryErrorCount: 2,
      pendingInputDescriptionId: "pending-bulk-status",
      disabled,
      focusTarget,
      recentlyAcceptedCriterionKeys: new Set(["criterion-1"]),
      ownerOptions: [],
      hierarchyAuthoring,
      onExpandedChange: (nextExpanded) => {
        events.push(`expanded:${nextExpanded}`)
        callbacks.onExpandedChange(nextExpanded)
        setExpanded(nextExpanded)
      },
      onModeChange: (groupKey, nextMode) => {
        callbacks.onModeChange(groupKey, nextMode)
        setMode(nextMode)
      },
      onGroupNameChange: callbacks.onGroupNameChange,
      onMoveGroup: callbacks.onMoveGroup,
      onDeleteGroup: callbacks.onDeleteGroup,
      onCriterionTextChange: callbacks.onCriterionTextChange,
      onMoveCriterion: callbacks.onMoveCriterion,
      onDeleteCriterion: callbacks.onDeleteCriterion,
      onAddCriterion: (groupKey) => {
        events.push(`add:${groupKey}`)
        callbacks.onAddCriterion(groupKey)
      },
      onBulkInputChange: callbacks.onBulkInputChange,
      onBulkPreview: callbacks.onBulkPreview,
      onBulkCancel: callbacks.onBulkCancel,
      onBulkAccept: callbacks.onBulkAccept,
    }

    return <TechnicalConfigurationBaselineGroupSection {...props} />
  }

  render(<Harness />)
  return { callbacks, events }
}
