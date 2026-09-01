"use client"

import * as React from "react"
import { Maximize2, Minimize2, Plus } from "lucide-react"

import { TechnicalConfigurationBaselineColumnHeader } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineColumnHeader"
import { TechnicalConfigurationBaselineDndProvider } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineDndProvider"
import { TechnicalConfigurationBaselineGroupSection } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineGroupSection"
import type { TechnicalConfigurationBulkEntrySession } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import { useTechnicalConfigurationGroupDisclosure } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationGroupDisclosure"
import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import type { HierarchicalEditorSectionDescriptor } from "@/components/hierarchical-editor/HierarchicalEditorTypes"
import { HierarchicalEditorStructureSidebar } from "@/components/hierarchical-editor/HierarchicalEditorStructureSidebar"
import { HierarchicalEditorToolbar } from "@/components/hierarchical-editor/HierarchicalEditorToolbar"
import { HierarchicalEditorWorkspace } from "@/components/hierarchical-editor/HierarchicalEditorWorkspace"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatTechnicalConfigurationBaselineSectionOrdinal } from "@/app/(app)/technical-configurations/technical-configuration-baseline-ordinals"

import {
  getTechnicalConfigurationBaselineCriterionOwnerOptions,
  type TechnicalConfigurationBaselineHierarchyAuthoring,
} from "./TechnicalConfigurationBaselineHierarchyAuthoring"
import {
  countTechnicalConfigurationGroupValidationErrors,
  getTechnicalConfigurationFocusTargetGroupKey,
  getTechnicalConfigurationFocusTargetForGroup,
  type TechnicalConfigurationFocusTarget,
} from "./TechnicalConfigurationBaselineEditorUtils"
import { useTechnicalConfigurationBaselineStructure } from "./useTechnicalConfigurationBaselineStructure"

export type TechnicalConfigurationEntryMode = "row" | "bulk"
export type { TechnicalConfigurationFocusTarget } from "./TechnicalConfigurationBaselineEditorUtils"

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
  isFocusMode: boolean
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
  onToggleFocusMode?: () => void
  hierarchyAuthoring?: TechnicalConfigurationBaselineHierarchyAuthoring
  commandBarContext?: React.ReactNode
}>

const PENDING_BULK_STATUS_ID = "technical-configuration-pending-bulk-status"

/** Composes all editable baseline groups in one definite-height hierarchy. */
export function TechnicalConfigurationBaselineEditor({
  draft,
  validation,
  summaryValidation,
  status,
  isFocusMode,
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
  onToggleFocusMode,
  hierarchyAuthoring,
  commandBarContext,
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
  const ownerOptions = React.useMemo(
    () => getTechnicalConfigurationBaselineCriterionOwnerOptions(draft),
    [draft]
  )
  const disclosure = useTechnicalConfigurationGroupDisclosure(groupKeys)
  const addGroupRef = React.useRef<HTMLButtonElement>(null)
  const bodyRef = React.useRef<HTMLDivElement>(null)
  const sectionRefs = React.useRef(new Map<string, React.RefObject<HTMLElement | null>>())
  const [selectedSectionKey, setSelectedSectionKey] = React.useState<string | null>(null)
  const structure = useTechnicalConfigurationBaselineStructure(bodyRef)
  const focusSectionKey =
    (focusTarget
      ? getTechnicalConfigurationFocusTargetGroupKey(focusTarget, draft.groups, activeValue)
      : null) ??
    (activeValue || null)
  const activeSectionKey =
    selectedSectionKey && groupKeys.includes(selectedSectionKey)
      ? selectedSectionKey
      : focusSectionKey
  const getSectionRef = React.useCallback((groupKey: string) => {
    const existingRef = sectionRefs.current.get(groupKey)
    if (existingRef) return existingRef

    const nextRef = React.createRef<HTMLElement>()
    sectionRefs.current.set(groupKey, nextRef)
    return nextRef
  }, [])
  const structureSections = React.useMemo<readonly HierarchicalEditorSectionDescriptor[]>(
    () =>
      draft.groups.map((group, groupIndex) => ({
        key: group.key,
        label:
          group.name.trim() ||
          `Nhóm ${formatTechnicalConfigurationBaselineSectionOrdinal(groupIndex + 1)}`,
        ordinal: formatTechnicalConfigurationBaselineSectionOrdinal(groupIndex + 1),
        summary: `${group.criteria.length + (group.subgroups ?? []).reduce((count, subgroup) => count + subgroup.criteria.length, 0)} tiêu chí`,
        targetRef: getSectionRef(group.key),
      })),
    [draft.groups, getSectionRef]
  )

  React.useEffect(() => {
    if (!focusTarget) return
    if (focusTarget.kind === "add-group") {
      const timeoutId = window.setTimeout(() => {
        addGroupRef.current?.scrollIntoView?.({ block: "nearest" })
        addGroupRef.current?.focus()
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }

    const targetGroupKey = getTechnicalConfigurationFocusTargetGroupKey(
      focusTarget,
      draft.groups,
      activeValue
    )

    if (targetGroupKey) disclosure.expand(targetGroupKey)
  }, [activeValue, disclosure.expand, draft.groups, focusTarget])

  return (
    <TechnicalConfigurationBaselineDndProvider
      onHierarchyCommand={hierarchyAuthoring?.onHierarchyCommand}
    >
      <HierarchicalEditorWorkspace
        ariaLabel="Trình soạn cấu hình cơ sở"
        bodyAriaLabel="Các nhóm cấu hình cơ sở"
        workspaceTestId="baseline-editor-workspace"
        bodyTestId="baseline-editor-body"
        bodyRef={bodyRef}
        bodyDataAttributes={{ "data-structure-layout": structure.layout }}
        bodyStyle={{
          gridTemplateColumns:
            structure.layout === "panel" ? "220px minmax(0, 1fr)" : "48px minmax(0, 1fr)",
        }}
        sidebar={
          <HierarchicalEditorStructureSidebar
            sections={structureSections}
            activeKey={activeSectionKey}
            expanded={structure.expanded}
            overlay={structure.layout === "overlay"}
            onToggle={structure.toggle}
            onSectionSelect={setSelectedSectionKey}
            testId="baseline-structure-sidebar"
          />
        }
        toolbar={
          <HierarchicalEditorToolbar
            testId="baseline-editor-toolbar"
            leading={
              commandBarContext ?? (
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-base font-semibold">Bản nháp cấu hình cơ sở</h2>
                  <Badge variant="secondary">Bản nháp</Badge>
                </div>
              )
            }
            status={
              hasPendingBulkInput ? null : isDirty ? (
                <p className="text-sm font-medium text-amber-700">Có thay đổi chưa lưu</p>
              ) : saveStatus === "saved" ? (
                <p className="text-sm font-medium text-emerald-700">Đã lưu</p>
              ) : null
            }
            pendingInputDescription={
              hasPendingBulkInput
                ? "Hoàn tất hoặc hủy phần nhập nhiều dòng trước khi lưu."
                : undefined
            }
            pendingInputDescriptionId={PENDING_BULK_STATUS_ID}
            actions={
              onToggleFocusMode ? (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-9"
                        aria-label={
                          isFocusMode ? "Thu nhỏ vùng chỉnh sửa" : "Mở rộng vùng chỉnh sửa"
                        }
                        aria-pressed={isFocusMode}
                        onClick={onToggleFocusMode}
                      >
                        {isFocusMode ? (
                          <Minimize2 className="size-4" aria-hidden="true" />
                        ) : (
                          <Maximize2 className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isFocusMode ? "Thu nhỏ vùng chỉnh sửa" : "Mở rộng vùng chỉnh sửa"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : undefined
            }
            saveDisabled={isEditingDisabled || !isDirty || isConflict}
            isSaving={isSaving}
            onSave={onSave}
          />
        }
      >
        <TechnicalConfigurationBaselineColumnHeader />

        {draft.groups.length === 0 ? (
          <p className="border-b px-4 py-10 text-center text-sm text-muted-foreground">
            Chưa có nhóm tiêu chí.
          </p>
        ) : (
          draft.groups.map((group, groupIndex) => {
            const mode = activeValue === group.key && entryMode === "bulk" ? "bulk" : "row"
            const summaryErrorCount = countTechnicalConfigurationGroupValidationErrors(
              group,
              summaryValidation
            )

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
                subgroupErrors={validation.subgroupErrors ?? {}}
                criterionErrors={validation.criterionErrors}
                summaryErrorCount={summaryErrorCount}
                pendingInputDescriptionId={PENDING_BULK_STATUS_ID}
                disabled={false}
                focusTarget={getTechnicalConfigurationFocusTargetForGroup(
                  focusTarget,
                  group,
                  activeValue
                )}
                recentlyAcceptedCriterionKeys={recentlyAcceptedCriterionKeys}
                ownerOptions={ownerOptions}
                hierarchyAuthoring={hierarchyAuthoring}
                sectionRef={getSectionRef(group.key)}
                interactionDisabled={isEditingDisabled}
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
      </HierarchicalEditorWorkspace>
    </TechnicalConfigurationBaselineDndProvider>
  )
}
