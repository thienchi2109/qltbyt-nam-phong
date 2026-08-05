"use client"

import * as React from "react"
import { LoaderCircle, Plus, Save } from "lucide-react"

import { TechnicalConfigurationBaselineGroupSection } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineGroupSection"
import type { TechnicalConfigurationBulkEntrySession } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import { useTechnicalConfigurationGroupDisclosure } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationGroupDisclosure"
import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorGroup,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export type TechnicalConfigurationEntryMode = "row" | "bulk"
export type TechnicalConfigurationFocusTarget =
  | { kind: "criterion"; key: string; token: number }
  | { kind: "group-name"; key: string; token: number }
  | { kind: "group-disclosure"; key: string; token: number }
  | { kind: "group-mode-action"; key: string; token: number }
  | { kind: "bulk-input"; token: number }
  | { kind: "add-group"; token: number }
  | { kind: "add-criterion"; key: string; token: number }
  | null

type CriterionTextField = "title" | "requirementText"

type TechnicalConfigurationBaselineEditorStatus = {
  dirty: boolean
  saving: boolean
  editingDisabled: boolean
  conflict: boolean
  saveStatus: "idle" | "saved"
  hasPendingBulkInput: boolean
}

type TechnicalConfigurationBaselineEditorProps = Readonly<{
  draft: TechnicalConfigurationBaselineEditorDraft
  validation: TechnicalConfigurationBaselineEditorValidation
  summaryValidation: TechnicalConfigurationBaselineEditorValidation
  status: TechnicalConfigurationBaselineEditorStatus
  activeValue: string
  entryMode: TechnicalConfigurationEntryMode
  getBulkSession: (groupKey: string) => TechnicalConfigurationBulkEntrySession
  focusTarget: TechnicalConfigurationFocusTarget
  recentlyAcceptedCriterionKeys: ReadonlySet<string>
  onGroupModeChange: (groupKey: string, mode: TechnicalConfigurationEntryMode) => void
  onAddGroup: () => void
  onGroupNameChange: (groupKey: string, name: string) => void
  onMoveGroup: (groupIndex: number, offset: -1 | 1) => void
  onDeleteGroup: (groupKey: string) => void
  onCriterionTextChange: (
    groupKey: string,
    criterionKey: string,
    field: CriterionTextField,
    value: string
  ) => void
  onMoveCriterion: (groupKey: string, criterionIndex: number, offset: -1 | 1) => void
  onDeleteCriterion: (groupKey: string, criterionKey: string) => void
  onAddCriterion: (groupKey: string) => void
  onBulkInputChange: (input: string) => void
  onBulkPreview: () => void
  onBulkCancel: () => void
  onBulkAccept: () => void
  onSave: () => void
}>

const PENDING_BULK_STATUS_ID = "technical-configuration-pending-bulk-status"

function getFocusTargetForGroup(
  focusTarget: TechnicalConfigurationFocusTarget,
  group: TechnicalConfigurationBaselineEditorGroup,
  activeValue: string
): TechnicalConfigurationFocusTarget | null {
  if (!focusTarget || focusTarget.kind === "add-group") return null
  if (focusTarget.kind === "criterion") {
    return group.criteria.some((criterion) => criterion.key === focusTarget.key)
      ? focusTarget
      : null
  }
  if (focusTarget.kind === "bulk-input") {
    return activeValue === group.key ? focusTarget : null
  }
  return focusTarget.key === group.key ? focusTarget : null
}

/** Composes all editable baseline groups in one definite-height hierarchy. */
export function TechnicalConfigurationBaselineEditor({
  draft,
  validation,
  summaryValidation,
  status,
  activeValue,
  entryMode,
  getBulkSession,
  focusTarget,
  recentlyAcceptedCriterionKeys,
  onGroupModeChange,
  onAddGroup,
  onGroupNameChange,
  onMoveGroup,
  onDeleteGroup,
  onCriterionTextChange,
  onMoveCriterion,
  onDeleteCriterion,
  onAddCriterion,
  onBulkInputChange,
  onBulkPreview,
  onBulkCancel,
  onBulkAccept,
  onSave,
}: TechnicalConfigurationBaselineEditorProps): React.JSX.Element {
  const {
    dirty: isDirty,
    saving: isSaving,
    editingDisabled: isEditingDisabled,
    conflict: isConflict,
    saveStatus,
    hasPendingBulkInput,
  } = status
  const groupKeys = React.useMemo(() => draft.groups.map((group) => group.key), [draft.groups])
  const disclosure = useTechnicalConfigurationGroupDisclosure(groupKeys)
  const addGroupRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (!focusTarget) return
    if (focusTarget.kind === "add-group") {
      const timeoutId = window.setTimeout(() => {
        addGroupRef.current?.scrollIntoView?.({ block: "nearest" })
        addGroupRef.current?.focus()
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }

    let targetGroupKey: string | null = null
    if (focusTarget.kind === "criterion") {
      targetGroupKey =
        draft.groups.find((group) =>
          group.criteria.some((criterion) => criterion.key === focusTarget.key)
        )?.key ?? null
    } else if (focusTarget.kind === "bulk-input") {
      targetGroupKey = activeValue
    } else {
      targetGroupKey = focusTarget.key
    }

    if (targetGroupKey) disclosure.expand(targetGroupKey)
  }, [activeValue, disclosure.expand, draft.groups, focusTarget])

  return (
    <section
      aria-label="Trình soạn cấu hình cơ sở"
      data-testid="baseline-editor-workspace"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div
        data-testid="baseline-editor-toolbar"
        className="flex shrink-0 flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Bản nháp cấu hình cơ sở</h2>
            <Badge variant="secondary">Bản nháp</Badge>
          </div>
          {hasPendingBulkInput ? (
            <p id={PENDING_BULK_STATUS_ID} className="mt-1 text-sm font-medium text-amber-700">
              Hoàn tất hoặc hủy phần nhập nhiều dòng trước khi lưu.
            </p>
          ) : isDirty ? (
            <p className="mt-1 text-sm font-medium text-amber-700">Có thay đổi chưa lưu</p>
          ) : saveStatus === "saved" ? (
            <p className="mt-1 text-sm font-medium text-emerald-700">Đã lưu</p>
          ) : null}
        </div>

        <Button
          type="button"
          disabled={isEditingDisabled || !isDirty || isSaving || isConflict || hasPendingBulkInput}
          aria-describedby={hasPendingBulkInput ? PENDING_BULK_STATUS_ID : undefined}
          onClick={onSave}
        >
          {isSaving ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {isSaving ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>

      <div
        role="region"
        aria-label="Các nhóm cấu hình cơ sở"
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {draft.groups.length === 0 ? (
          <p className="border-b px-4 py-10 text-center text-sm text-muted-foreground">
            Chưa có nhóm tiêu chí.
          </p>
        ) : (
          draft.groups.map((group, groupIndex) => {
            const mode = activeValue === group.key && entryMode === "bulk" ? "bulk" : "row"
            const summaryErrorCount =
              (summaryValidation.groupErrors[group.key] ? 1 : 0) +
              group.criteria.filter((criterion) => summaryValidation.criterionErrors[criterion.key])
                .length

            return (
              <TechnicalConfigurationBaselineGroupSection
                key={group.key}
                group={group}
                groupIndex={groupIndex}
                groupCount={draft.groups.length}
                expanded={disclosure.expandedGroupKeys.has(group.key)}
                mode={mode}
                bulkSession={getBulkSession(group.key)}
                groupError={validation.groupErrors[group.key]}
                criterionErrors={validation.criterionErrors}
                summaryErrorCount={summaryErrorCount}
                pendingInputDescriptionId={PENDING_BULK_STATUS_ID}
                disabled={isEditingDisabled}
                focusTarget={getFocusTargetForGroup(focusTarget, group, activeValue)}
                recentlyAcceptedCriterionKeys={recentlyAcceptedCriterionKeys}
                onExpandedChange={(expanded) => disclosure.setExpanded(group.key, expanded)}
                onModeChange={onGroupModeChange}
                onGroupNameChange={onGroupNameChange}
                onMoveGroup={onMoveGroup}
                onDeleteGroup={onDeleteGroup}
                onCriterionTextChange={onCriterionTextChange}
                onMoveCriterion={onMoveCriterion}
                onDeleteCriterion={onDeleteCriterion}
                onAddCriterion={onAddCriterion}
                onBulkInputChange={onBulkInputChange}
                onBulkPreview={onBulkPreview}
                onBulkCancel={onBulkCancel}
                onBulkAccept={onBulkAccept}
              />
            )
          })
        )}

        <div className="flex justify-center px-3 py-4">
          <Button
            ref={addGroupRef}
            type="button"
            variant="outline"
            disabled={isEditingDisabled}
            onClick={onAddGroup}
          >
            <Plus className="size-4" aria-hidden="true" />
            Thêm nhóm
          </Button>
        </div>
      </div>
    </section>
  )
}
