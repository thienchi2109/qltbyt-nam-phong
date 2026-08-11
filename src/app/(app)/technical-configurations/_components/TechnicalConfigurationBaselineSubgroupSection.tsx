"use client"

import * as React from "react"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ClipboardPaste,
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
import { hasTechnicalConfigurationBulkEntryInput } from "@/app/(app)/technical-configurations/bulk-entry-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"

import { TechnicalConfigurationBaselineEditorIconButton as IconButton } from "./TechnicalConfigurationBaselineEditorControls"
import type {
  TechnicalConfigurationBaselineCriterionOwnerOption,
  TechnicalConfigurationBaselineHierarchyAuthoring,
} from "./TechnicalConfigurationBaselineHierarchyAuthoring"
import { focusTechnicalConfigurationBaselineElement } from "./TechnicalConfigurationBaselineFocus"

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
    authoring?.activeOwnerKey === subgroup.key && authoring.entryMode === "bulk" ? "bulk" : "row"
  const bulkSession = authoring?.getBulkSession(subgroup.key)
  const hasPendingBulkInput = hasTechnicalConfigurationBulkEntryInput(bulkSession?.input ?? "")
  const modeActionLabel = mode === "row" ? "Nhập nhiều dòng" : "Chỉnh từng dòng"
  const disclosureRef = React.useRef<HTMLButtonElement>(null)
  const subgroupNameRef = React.useRef<HTMLInputElement>(null)
  const modeActionRef = React.useRef<HTMLButtonElement>(null)
  const addCriterionRef = React.useRef<HTMLButtonElement>(null)

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
        aria-label={`Nhóm con ${subgroupOrdinal} của nhóm ${sectionOrdinal}: ${subgroupLabel}`}
        data-testid={`baseline-subgroup-${subgroup.key}`}
        className="min-w-0 border-t bg-muted/10"
      >
        <div className="grid min-w-0 gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
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
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-sm font-semibold">
              {subgroupOrdinal}
            </span>
            <div className="min-w-0 pt-1">
              {authoring ? (
                <Input
                  ref={subgroupNameRef}
                  aria-label={`Tên nhóm con ${subgroupOrdinal} của nhóm ${sectionOrdinal}`}
                  value={subgroup.name}
                  disabled={disabled}
                  aria-invalid={Boolean(subgroupError)}
                  aria-describedby={subgroupErrorId}
                  onChange={(event) =>
                    authoring.onSubgroupNameChange(groupKey, subgroup.key, event.target.value)
                  }
                />
              ) : (
                <h3 className="break-words text-sm font-semibold">{subgroupLabel}</h3>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{subgroup.criteria.length} tiêu chí</Badge>
                {subgroupError || criterionErrorCount > 0 ? (
                  <Badge variant="destructive">
                    {(subgroupError ? 1 : 0) + criterionErrorCount} lỗi
                  </Badge>
                ) : null}
              </div>
              {subgroupError ? (
                <p id={subgroupErrorId} className="mt-1 text-sm text-destructive">
                  {subgroupError}
                </p>
              ) : null}
            </div>
          </div>
          {authoring ? (
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
                sectionOrdinal={sectionOrdinal}
                subgroupOrdinal={subgroupOrdinal}
                criterionErrors={criterionErrors}
                focusCriterionKey={targetCriterionKey}
                focusCriterionToken={targetCriterionToken}
                authoring={
                  authoring
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
