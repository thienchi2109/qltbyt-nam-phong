"use client"

import { useSortable } from "@dnd-kit/react/sortable"
import * as React from "react"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ClipboardPaste,
  GripVertical,
  ListChecks,
  Plus,
  Trash2,
} from "lucide-react"

import type { TechnicalConfigurationFocusTarget } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import { TechnicalConfigurationBaselineSubgroupCriteria } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineSubgroupCriteria"
import { TechnicalConfigurationBulkEntryWorkbench } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBulkEntryWorkbench"
import type {
  TechnicalConfigurationBaselineEditorCriterionOwner,
  TechnicalConfigurationBaselineEditorSubgroup,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import type {
  TechnicalConfigurationBaselineDndSourceData,
  TechnicalConfigurationBaselineDndTargetData,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-dnd"
import { hasTechnicalConfigurationBulkEntryInput } from "@/app/(app)/technical-configurations/bulk-entry-utils"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

import { TechnicalConfigurationBaselineEditorIconButton as IconButton } from "./TechnicalConfigurationBaselineEditorControls"
import type {
  TechnicalConfigurationBaselineCriterionOwnerOption,
  TechnicalConfigurationBaselineHierarchyAuthoring,
} from "./TechnicalConfigurationBaselineHierarchyAuthoring"
import { focusTechnicalConfigurationBaselineElement } from "./TechnicalConfigurationBaselineFocus"
import { TechnicalConfigurationBaselineHierarchyNameField } from "./TechnicalConfigurationBaselineHierarchyNameField"
import { TechnicalConfigurationBaselineHierarchySummary } from "./TechnicalConfigurationBaselineHierarchySummary"

type TechnicalConfigurationBaselineSubgroupSectionProps = Readonly<{
  groupKey: string
  subgroup: TechnicalConfigurationBaselineEditorSubgroup
  sectionOrdinal: string
  subgroupIndex: number
  subgroupCount: number
  expanded: boolean
  subgroupError?: string
  criterionErrors: Record<string, string>
  focusTarget: TechnicalConfigurationFocusTarget
  readOnly: boolean
  disabled: boolean
  ownerOptions: readonly TechnicalConfigurationBaselineCriterionOwnerOption[]
  pendingInputDescriptionId?: string
  authoring?: TechnicalConfigurationBaselineHierarchyAuthoring
  onExpandedChange: (expanded: boolean) => void
}>

/** Renders one subgroup row with optional P4C authoring controls. */
export function TechnicalConfigurationBaselineSubgroupSection({
  groupKey,
  subgroup,
  sectionOrdinal,
  subgroupIndex,
  subgroupCount,
  expanded,
  subgroupError,
  criterionErrors,
  focusTarget,
  readOnly,
  disabled,
  ownerOptions,
  pendingInputDescriptionId,
  authoring,
  onExpandedChange,
}: TechnicalConfigurationBaselineSubgroupSectionProps): React.JSX.Element {
  const subgroupOrdinal = subgroupIndex + 1
  const subgroupLabel = subgroup.name.trim() || `Nhóm con ${subgroupOrdinal}`
  const subgroupContext = `nhóm con ${subgroupOrdinal} của nhóm ${sectionOrdinal}`
  const contentId = `baseline-subgroup-${subgroup.key}-content`
  const subgroupErrorId = subgroupError ? `baseline-subgroup-${subgroup.key}-error` : undefined
  const targetCriterion =
    focusTarget?.kind === "criterion" &&
    subgroup.criteria.some((criterion) => criterion.key === focusTarget.key)
      ? focusTarget
      : null
  const targetCriterionKey = targetCriterion?.key ?? null
  const targetCriterionToken = targetCriterion?.token ?? null
  const criterionErrorCount = subgroup.criteria.filter(
    (criterion) => criterionErrors[criterion.key]
  ).length
  const owner: TechnicalConfigurationBaselineEditorCriterionOwner = {
    groupKey,
    subgroupKey: subgroup.key,
  }
  const mode =
    !readOnly && authoring?.activeOwnerKey === subgroup.key && authoring.entryMode === "bulk"
      ? "bulk"
      : "row"
  const bulkSession = authoring?.getBulkSession(subgroup.key)
  const hasPendingBulkInput = hasTechnicalConfigurationBulkEntryInput(bulkSession?.input ?? "")
  const modeActionLabel = mode === "row" ? "Nhập nhiều dòng" : "Chỉnh từng dòng"
  const disclosureRef = React.useRef<HTMLButtonElement>(null)
  const subgroupNameRef = React.useRef<HTMLInputElement>(null)
  const modeActionRef = React.useRef<HTMLButtonElement>(null)
  const addCriterionRef = React.useRef<HTMLButtonElement>(null)
  const sortable = useSortable<
    TechnicalConfigurationBaselineDndSourceData & TechnicalConfigurationBaselineDndTargetData
  >({
    id: `baseline-subgroup-${subgroup.key}`,
    type: "baseline-subgroup",
    group: `baseline-subgroups-${groupKey}`,
    index: subgroupIndex,
    data: {
      active: {
        kind: "subgroup",
        groupKey,
        subgroupKey: subgroup.key,
        index: subgroupIndex,
      },
      label: `Nhóm con ${sectionOrdinal}.${subgroupOrdinal}: ${subgroupLabel}`,
      target: { kind: "subgroup", groupKey, index: subgroupIndex },
      targetMode: "sortable",
    },
    disabled: !authoring || readOnly || disabled,
  })

  React.useEffect(() => {
    if (!focusTarget || !("key" in focusTarget) || focusTarget.key !== subgroup.key) return

    const timeoutId = window.setTimeout(() => {
      if (focusTarget.kind === "subgroup-name") {
        focusTechnicalConfigurationBaselineElement(subgroupNameRef.current)
      } else if (focusTarget.kind === "subgroup-disclosure") {
        focusTechnicalConfigurationBaselineElement(disclosureRef.current)
      } else if (focusTarget.kind === "subgroup-mode-action") {
        focusTechnicalConfigurationBaselineElement(modeActionRef.current)
      } else if (focusTarget.kind === "add-subgroup-criterion") {
        focusTechnicalConfigurationBaselineElement(addCriterionRef.current)
      }
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [focusTarget, subgroup.key])

  return (
    <Collapsible open={expanded} onOpenChange={onExpandedChange}>
      <section
        ref={sortable.ref}
        aria-label={`Nhóm con ${subgroupOrdinal} của nhóm ${sectionOrdinal}: ${subgroupLabel}`}
        data-testid={`baseline-subgroup-${subgroup.key}`}
        data-hierarchy-level="subgroup"
        data-drag-source={sortable.isDragSource ? "true" : undefined}
        data-drop-target={sortable.isDropTarget ? "true" : undefined}
        className="relative ml-6 min-w-0 border-l border-border/70 before:absolute before:left-0 before:top-7 before:w-4 before:border-t before:border-border/70"
      >
        <div className="grid min-w-0 gap-3 border-b border-border/70 bg-muted/15 px-3 py-3 pl-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="flex min-w-0 items-start gap-2">
            <CollapsibleTrigger asChild>
              <Button
                ref={disclosureRef}
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={`${expanded ? "Thu gọn" : "Mở rộng"} ${subgroupContext}: ${subgroupLabel}`}
                aria-controls={contentId}
                aria-describedby={subgroupErrorId}
                title={expanded ? "Thu gọn nhóm con" : "Mở rộng nhóm con"}
              >
                <ChevronDown
                  className={`size-4 transition-transform ${expanded ? "" : "-rotate-90"}`}
                  aria-hidden="true"
                />
              </Button>
            </CollapsibleTrigger>
            {authoring && !readOnly ? (
              <Button
                ref={sortable.handleRef}
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
                aria-label={`Kéo để sắp xếp nhóm con ${subgroupOrdinal} của nhóm ${sectionOrdinal}`}
                title="Kéo để sắp xếp nhóm con"
              >
                <GripVertical className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
            <span className="flex h-9 min-w-12 shrink-0 items-center justify-center rounded-sm border border-border/80 bg-background px-2 text-sm font-semibold">
              {sectionOrdinal}.{subgroupOrdinal}
            </span>
            <div className="min-w-0 pt-1">
              <TechnicalConfigurationBaselineHierarchyNameField
                level="subgroup"
                inputRef={subgroupNameRef}
                id={`baseline-subgroup-name-${subgroup.key}`}
                ariaLabel={`Tên nhóm con ${subgroupOrdinal} của nhóm ${sectionOrdinal}`}
                value={subgroup.name}
                displayValue={subgroupLabel}
                locked={!authoring || readOnly}
                disabled={disabled}
                invalid={Boolean(subgroupError)}
                describedBy={subgroupErrorId}
                onChange={(value) => authoring?.onSubgroupNameChange(groupKey, subgroup.key, value)}
              />
              <TechnicalConfigurationBaselineHierarchySummary
                criterionCount={subgroup.criteria.length}
                errorCount={(subgroupError ? 1 : 0) + criterionErrorCount}
              />
              {subgroupError ? (
                <p id={subgroupErrorId} className="mt-1 text-sm text-destructive">
                  {subgroupError}
                </p>
              ) : null}
            </div>
          </div>
          {authoring && !readOnly ? (
            <div className="flex flex-wrap items-center gap-1 sm:justify-end">
              <Button
                ref={modeActionRef}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                aria-label={`${modeActionLabel} cho ${subgroupContext}`}
                onClick={() =>
                  authoring.onOwnerModeChange(subgroup.key, mode === "row" ? "bulk" : "row")
                }
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
                disabled={disabled}
                aria-label={`Thêm tiêu chí vào ${subgroupContext}`}
                onClick={() => authoring.onAddCriterion(owner)}
              >
                <Plus className="size-4" aria-hidden="true" />
                Thêm tiêu chí
              </Button>
              <IconButton
                label={`Di chuyển nhóm con ${subgroupOrdinal} của nhóm ${sectionOrdinal} lên`}
                title="Di chuyển lên"
                disabled={disabled || subgroupIndex === 0}
                onClick={() => authoring.onMoveSubgroup(groupKey, subgroupIndex, -1)}
              >
                <ArrowUp className="size-4" />
              </IconButton>
              <IconButton
                label={`Di chuyển nhóm con ${subgroupOrdinal} của nhóm ${sectionOrdinal} xuống`}
                title="Di chuyển xuống"
                disabled={disabled || subgroupIndex === subgroupCount - 1}
                onClick={() => authoring.onMoveSubgroup(groupKey, subgroupIndex, 1)}
              >
                <ArrowDown className="size-4" />
              </IconButton>
              <IconButton
                label={`Xóa nhóm con ${subgroupOrdinal} của nhóm ${sectionOrdinal}`}
                title="Xóa nhóm con"
                disabled={disabled}
                ariaDisabled={hasPendingBulkInput}
                ariaDescribedBy={hasPendingBulkInput ? pendingInputDescriptionId : undefined}
                destructive
                onClick={() => {
                  if (!hasPendingBulkInput) authoring.onDeleteSubgroup(groupKey, subgroup.key)
                }}
              >
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          ) : null}
        </div>

        <CollapsibleContent id={contentId}>
          <div role="region" aria-label={`Nội dung ${subgroupContext}`} className="pb-4">
            {authoring && mode === "bulk" && bulkSession ? (
              <TechnicalConfigurationBulkEntryWorkbench
                groupName={subgroupLabel}
                existingCriterionCount={subgroup.criteria.length}
                session={bulkSession}
                disabled={disabled}
                focusInputToken={
                  focusTarget?.kind === "subgroup-bulk-input" && focusTarget.key === subgroup.key
                    ? focusTarget.token
                    : null
                }
                onInputChange={(input) => authoring.onBulkInputChange(subgroup.key, input)}
                onPreview={() => authoring.onBulkPreview(subgroup.key)}
                onCancel={() => authoring.onBulkCancel(subgroup.key)}
                onAccept={() => authoring.onBulkAccept(owner)}
              />
            ) : (
              <TechnicalConfigurationBaselineSubgroupCriteria
                criteria={subgroup.criteria}
                owner={owner}
                sectionOrdinal={sectionOrdinal}
                subgroupOrdinal={subgroupOrdinal}
                criterionErrors={criterionErrors}
                focusCriterionKey={targetCriterionKey}
                focusCriterionToken={targetCriterionToken}
                authoring={
                  authoring && !readOnly
                    ? {
                        owner,
                        ownerOptions,
                        disabled,
                        onCriterionTextChange: (criterionKey, field, value) =>
                          authoring.onCriterionTextChange(owner, criterionKey, field, value),
                        onMoveCriterion: (criterionIndex, offset) =>
                          authoring.onMoveCriterionWithinOwner(owner, criterionIndex, offset),
                        onMoveCriterionToOwner: (criterionKey, targetOwner) =>
                          authoring.onMoveCriterionToOwner(owner, criterionKey, targetOwner),
                        onDeleteCriterion: (criterionKey) =>
                          authoring.onDeleteCriterion(owner, criterionKey),
                      }
                    : undefined
                }
              />
            )}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}
