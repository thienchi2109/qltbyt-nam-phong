"use client"

import { useSortable } from "@dnd-kit/react/sortable"
import * as React from "react"
import { ChevronDown, ClipboardPaste, GripVertical, ListChecks, Plus } from "lucide-react"

import { useTechnicalConfigurationGroupDisclosure } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationGroupDisclosure"
import type { TechnicalConfigurationBaselineEditorGroup } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import type {
  TechnicalConfigurationBaselineDndSourceData,
  TechnicalConfigurationBaselineDndTargetData,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-dnd"
import { formatTechnicalConfigurationBaselineSectionOrdinal } from "@/app/(app)/technical-configurations/technical-configuration-baseline-ordinals"
import { hasTechnicalConfigurationBulkEntryInput } from "@/app/(app)/technical-configurations/bulk-entry-utils"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible"

import { focusTechnicalConfigurationBaselineElement } from "./TechnicalConfigurationBaselineFocus"
import { TechnicalConfigurationBaselineGroupContent } from "./TechnicalConfigurationBaselineGroupContent"
import type { TechnicalConfigurationBaselineGroupSectionProps } from "./TechnicalConfigurationBaselineGroupSectionTypes"
import { TechnicalConfigurationBaselineHierarchyActionsMenu } from "./TechnicalConfigurationBaselineHierarchyActionsMenu"
import { TechnicalConfigurationBaselineHierarchyNameField } from "./TechnicalConfigurationBaselineHierarchyNameField"
import { TechnicalConfigurationBaselineHierarchySummary } from "./TechnicalConfigurationBaselineHierarchySummary"

const EMPTY_SUBGROUPS: TechnicalConfigurationBaselineEditorGroup["subgroups"] = []

export type { TechnicalConfigurationBaselineGroupSectionProps } from "./TechnicalConfigurationBaselineGroupSectionTypes"

/** Renders one disclosed hierarchy group and its criterion and subgroup authoring controls. */
export function TechnicalConfigurationBaselineGroupSection({
  group,
  groupIndex,
  groupCount,
  expanded,
  mode,
  bulkSession,
  groupError,
  subgroupErrors,
  criterionErrors,
  summaryErrorCount,
  pendingInputDescriptionId,
  disabled,
  interactionDisabled = false,
  focusTarget,
  recentlyAcceptedCriterionKeys,
  ownerOptions,
  hierarchyAuthoring,
  onExpandedChange,
  onModeChange,
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
}: TechnicalConfigurationBaselineGroupSectionProps): React.JSX.Element {
  const controlsDisabled = disabled || interactionDisabled
  const ordinal = groupIndex + 1
  const sectionOrdinal = formatTechnicalConfigurationBaselineSectionOrdinal(ordinal)
  const groupLabel = group.name.trim() || `Nhóm ${sectionOrdinal}`
  const groupErrorId = groupError ? `baseline-group-${group.key}-error` : undefined
  const modeActionLabel = mode === "row" ? "Nhập nhiều dòng" : "Chỉnh từng dòng"
  const subgroups = group.subgroups ?? EMPTY_SUBGROUPS
  const hasPendingBulkInput =
    hasTechnicalConfigurationBulkEntryInput(bulkSession.input) ||
    (hierarchyAuthoring?.getBulkSession
      ? subgroups.some((subgroup) =>
          hasTechnicalConfigurationBulkEntryInput(
            hierarchyAuthoring.getBulkSession(subgroup.key).input
          )
        )
      : false)
  const subgroupKeys = React.useMemo(() => subgroups.map((subgroup) => subgroup.key), [subgroups])
  const {
    expandedGroupKeys: expandedSubgroupKeys,
    setExpanded: setSubgroupExpanded,
    expand: expandSubgroup,
  } = useTechnicalConfigurationGroupDisclosure(subgroupKeys)
  const targetSubgroupKey =
    focusTarget?.kind === "criterion"
      ? (subgroups.find((subgroup) =>
          subgroup.criteria.some((criterion) => criterion.key === focusTarget.key)
        )?.key ?? null)
      : null
  const targetSubgroupFocusRequest =
    targetSubgroupKey && focusTarget?.kind === "criterion"
      ? `${focusTarget.key}:${focusTarget.token}`
      : null
  const handledSubgroupFocusRequestRef = React.useRef<string | null>(null)
  const totalCriterionCount =
    group.criteria.length +
    subgroups.reduce((count, subgroup) => count + subgroup.criteria.length, 0)
  const disclosureRef = React.useRef<HTMLButtonElement>(null)
  const groupNameRef = React.useRef<HTMLInputElement>(null)
  const modeActionRef = React.useRef<HTMLButtonElement>(null)
  const addCriterionRef = React.useRef<HTMLButtonElement>(null)
  const addSubgroupRef = React.useRef<HTMLDivElement>(null)
  const [isActionsMenuOpen, setIsActionsMenuOpen] = React.useState(false)
  const sortable = useSortable<
    TechnicalConfigurationBaselineDndSourceData & TechnicalConfigurationBaselineDndTargetData
  >({
    id: `baseline-group-${group.key}`,
    type: "baseline-group",
    group: "baseline-groups",
    index: groupIndex,
    data: {
      active: { kind: "group", groupKey: group.key, index: groupIndex },
      label: `Nhóm ${sectionOrdinal}: ${groupLabel}`,
      target: { kind: "group", index: groupIndex },
      targetMode: "sortable",
    },
    disabled: controlsDisabled,
  })

  React.useLayoutEffect(() => {
    if (!targetSubgroupKey || !targetSubgroupFocusRequest) return
    if (handledSubgroupFocusRequestRef.current === targetSubgroupFocusRequest) return

    handledSubgroupFocusRequestRef.current = targetSubgroupFocusRequest
    expandSubgroup(targetSubgroupKey)
  }, [expandSubgroup, targetSubgroupFocusRequest, targetSubgroupKey])

  React.useEffect(() => {
    if (!focusTarget) return
    const timeoutId = window.setTimeout(() => {
      if (focusTarget.kind === "group-name" && focusTarget.key === group.key) {
        focusTechnicalConfigurationBaselineElement(groupNameRef.current)
      } else if (focusTarget.kind === "group-disclosure" && focusTarget.key === group.key) {
        focusTechnicalConfigurationBaselineElement(disclosureRef.current)
      } else if (focusTarget.kind === "group-mode-action" && focusTarget.key === group.key) {
        focusTechnicalConfigurationBaselineElement(modeActionRef.current)
      } else if (focusTarget.kind === "add-criterion" && focusTarget.key === group.key) {
        focusTechnicalConfigurationBaselineElement(addCriterionRef.current)
      } else if (focusTarget.kind === "add-subgroup" && focusTarget.key === group.key) {
        setIsActionsMenuOpen(true)
      }
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [focusTarget, group.key])

  React.useLayoutEffect(() => {
    if (
      !isActionsMenuOpen ||
      focusTarget?.kind !== "add-subgroup" ||
      focusTarget.key !== group.key
    ) {
      return
    }

    focusTechnicalConfigurationBaselineElement(addSubgroupRef.current)
  }, [focusTarget, group.key, isActionsMenuOpen])

  return (
    <Collapsible open={expanded} onOpenChange={onExpandedChange}>
      <section
        ref={sortable.ref}
        className="border-b border-border/70"
        aria-label={`Nhóm tiêu chí ${sectionOrdinal}`}
        data-hierarchy-level="group"
        data-drag-source={sortable.isDragSource ? "true" : undefined}
        data-drop-target={sortable.isDropTarget ? "true" : undefined}
      >
        <div className="grid gap-2 border-y border-border/70 bg-background px-3 py-2 lg:grid-cols-[auto_minmax(12rem,1fr)_auto] lg:items-start">
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button
                ref={disclosureRef}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`${expanded ? "Thu gọn" : "Mở rộng"} nhóm ${sectionOrdinal}: ${groupLabel}`}
                title={expanded ? "Thu gọn nhóm" : "Mở rộng nhóm"}
              >
                <ChevronDown
                  className={`size-4 transition-transform ${expanded ? "" : "-rotate-90"}`}
                  aria-hidden="true"
                />
              </Button>
            </CollapsibleTrigger>
            {disabled ? null : (
              <Button
                ref={sortable.handleRef}
                type="button"
                variant="ghost"
                size="icon"
                disabled={interactionDisabled}
                className="shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
                aria-label={`Kéo để sắp xếp nhóm ${sectionOrdinal}`}
                title="Kéo để sắp xếp nhóm"
              >
                <GripVertical className="size-4" aria-hidden="true" />
              </Button>
            )}
            <span className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-primary/25 bg-primary/5 text-sm font-semibold text-primary">
              {sectionOrdinal}
            </span>
          </div>

          <div className="min-w-0">
            <TechnicalConfigurationBaselineHierarchyNameField
              level="group"
              inputRef={groupNameRef}
              id={`baseline-group-${group.key}`}
              ariaLabel={`Tên nhóm ${sectionOrdinal}`}
              value={group.name}
              displayValue={groupLabel}
              locked={disabled}
              disabled={interactionDisabled}
              invalid={Boolean(groupError)}
              describedBy={groupErrorId}
              onChange={(value) => onGroupNameChange(group.key, value)}
            />
            {groupError ? (
              <p id={groupErrorId} className="mt-1 text-sm text-destructive">
                {groupError}
              </p>
            ) : null}
            <TechnicalConfigurationBaselineHierarchySummary
              criterionCount={totalCriterionCount}
              errorCount={summaryErrorCount}
              hasPendingBulkInput={hasPendingBulkInput}
            />
          </div>

          {disabled ? null : (
            <div className="flex flex-nowrap items-center gap-1 lg:justify-end">
              <Button
                ref={modeActionRef}
                type="button"
                variant="outline"
                size="sm"
                disabled={interactionDisabled}
                aria-label={`${modeActionLabel} cho nhóm ${sectionOrdinal}: ${groupLabel}`}
                onClick={() => onModeChange(group.key, mode === "row" ? "bulk" : "row")}
              >
                {mode === "row" ? (
                  <ClipboardPaste className="size-4" aria-hidden="true" />
                ) : (
                  <ListChecks className="size-4" aria-hidden="true" />
                )}
                {modeActionLabel}
              </Button>
              <Button
                ref={addCriterionRef}
                type="button"
                variant="outline"
                size="sm"
                disabled={interactionDisabled}
                aria-label={`Thêm tiêu chí vào nhóm ${sectionOrdinal}`}
                onClick={() => {
                  if (!expanded) onExpandedChange(true)
                  onAddCriterion(group.key)
                }}
              >
                <Plus className="size-4" aria-hidden="true" />
                Thêm tiêu chí
              </Button>
              <TechnicalConfigurationBaselineHierarchyActionsMenu
                triggerLabel={`Thao tác cho nhóm ${sectionOrdinal}`}
                disabled={controlsDisabled}
                moveUpDisabled={controlsDisabled || groupIndex === 0}
                moveDownDisabled={controlsDisabled || groupIndex === groupCount - 1}
                deleteLabel="Xóa nhóm"
                deleteBlocked={hasPendingBulkInput}
                deleteDescribedBy={pendingInputDescriptionId}
                open={isActionsMenuOpen}
                onOpenChange={setIsActionsMenuOpen}
                additionalAction={
                  hierarchyAuthoring
                    ? {
                        label: "Thêm nhóm con",
                        itemRef: addSubgroupRef,
                        onSelect: () => hierarchyAuthoring.onAddSubgroup(group.key),
                      }
                    : undefined
                }
                onMove={(offset) => onMoveGroup(groupIndex, offset)}
                onDelete={() => onDeleteGroup(group.key)}
              />
            </div>
          )}
        </div>

        <TechnicalConfigurationBaselineGroupContent
          group={group}
          ordinal={ordinal}
          sectionOrdinal={sectionOrdinal}
          groupLabel={groupLabel}
          mode={disabled ? "row" : mode}
          bulkSession={bulkSession}
          subgroups={subgroups}
          expandedSubgroupKeys={expandedSubgroupKeys}
          subgroupErrors={subgroupErrors}
          criterionErrors={criterionErrors}
          disabled={disabled}
          interactionDisabled={interactionDisabled}
          focusTarget={focusTarget}
          recentlyAcceptedCriterionKeys={recentlyAcceptedCriterionKeys}
          ownerOptions={ownerOptions}
          hierarchyAuthoring={hierarchyAuthoring}
          pendingInputDescriptionId={pendingInputDescriptionId}
          onCriterionTextChange={onCriterionTextChange}
          onMoveCriterion={onMoveCriterion}
          onDeleteCriterion={onDeleteCriterion}
          onBulkInputChange={onBulkInputChange}
          onBulkPreview={onBulkPreview}
          onBulkCancel={onBulkCancel}
          onBulkAccept={onBulkAccept}
          onSubgroupExpandedChange={setSubgroupExpanded}
        />
      </section>
    </Collapsible>
  )
}
