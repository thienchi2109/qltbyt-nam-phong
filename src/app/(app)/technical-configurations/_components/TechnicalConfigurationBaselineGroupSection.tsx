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

import { useTechnicalConfigurationGroupDisclosure } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationGroupDisclosure"
import type { TechnicalConfigurationBaselineEditorGroup } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { formatTechnicalConfigurationBaselineSectionOrdinal } from "@/app/(app)/technical-configurations/technical-configuration-baseline-ordinals"
import { hasTechnicalConfigurationBulkEntryInput } from "@/app/(app)/technical-configurations/bulk-entry-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"

import { TechnicalConfigurationBaselineEditorIconButton as IconButton } from "./TechnicalConfigurationBaselineEditorControls"
import { focusTechnicalConfigurationBaselineElement } from "./TechnicalConfigurationBaselineFocus"
import { TechnicalConfigurationBaselineGroupContent } from "./TechnicalConfigurationBaselineGroupContent"
import type { TechnicalConfigurationBaselineGroupSectionProps } from "./TechnicalConfigurationBaselineGroupSectionTypes"

const EMPTY_SUBGROUPS: TechnicalConfigurationBaselineEditorGroup["subgroups"] = []

export type { TechnicalConfigurationBaselineGroupSectionProps } from "./TechnicalConfigurationBaselineGroupSectionTypes"

/** Renders one editable, independently collapsible baseline criterion group. */
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
  const addSubgroupRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
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
        focusTechnicalConfigurationBaselineElement(addSubgroupRef.current)
      }
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [focusTarget, group.key])

  const handleAddCriterion = (): void => {
    if (!expanded) onExpandedChange(true)
    onAddCriterion(group.key)
  }

  return (
    <Collapsible open={expanded} onOpenChange={onExpandedChange}>
      <section className="border-b" aria-label={`Nhóm tiêu chí ${sectionOrdinal}`}>
        <div className="grid gap-3 bg-muted/30 px-3 py-3 lg:grid-cols-[auto_minmax(12rem,1fr)_auto] lg:items-start">
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
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-sm font-semibold">
              {sectionOrdinal}
            </span>
          </div>

          <div className="min-w-0">
            <label className="sr-only" htmlFor={`baseline-group-${group.key}`}>
              Tên nhóm {sectionOrdinal}
            </label>
            <Input
              ref={groupNameRef}
              id={`baseline-group-${group.key}`}
              aria-label={`Tên nhóm ${sectionOrdinal}`}
              value={group.name}
              disabled={disabled}
              aria-invalid={Boolean(groupError)}
              aria-describedby={groupErrorId}
              onChange={(event) => onGroupNameChange(group.key, event.target.value)}
            />
            {groupError ? (
              <p id={groupErrorId} className="mt-1 text-sm text-destructive">
                {groupError}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{totalCriterionCount} tiêu chí</Badge>
              {summaryErrorCount > 0 ? (
                <Badge variant="destructive">{summaryErrorCount} lỗi</Badge>
              ) : null}
              {hasPendingBulkInput ? (
                <Badge variant="outline">Có nội dung nhập nhiều dòng</Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 lg:justify-end">
            <Button
              ref={modeActionRef}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
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
              disabled={disabled}
              aria-label={`Thêm tiêu chí vào nhóm ${sectionOrdinal}`}
              onClick={handleAddCriterion}
            >
              <Plus className="size-4" aria-hidden="true" />
              Thêm tiêu chí
            </Button>
            {hierarchyAuthoring ? (
              <Button
                ref={addSubgroupRef}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                aria-label={`Thêm nhóm con vào nhóm ${sectionOrdinal}`}
                onClick={() => hierarchyAuthoring.onAddSubgroup(group.key)}
              >
                <Plus className="size-4" aria-hidden="true" />
                Thêm nhóm con
              </Button>
            ) : null}
            <IconButton
              label={`Di chuyển nhóm ${sectionOrdinal} lên`}
              title="Di chuyển lên"
              disabled={disabled || groupIndex === 0}
              onClick={() => onMoveGroup(groupIndex, -1)}
            >
              <ArrowUp className="size-4" />
            </IconButton>
            <IconButton
              label={`Di chuyển nhóm ${sectionOrdinal} xuống`}
              title="Di chuyển xuống"
              disabled={disabled || groupIndex === groupCount - 1}
              onClick={() => onMoveGroup(groupIndex, 1)}
            >
              <ArrowDown className="size-4" />
            </IconButton>
            <IconButton
              label={`Xóa nhóm ${sectionOrdinal}`}
              title="Xóa nhóm"
              disabled={disabled}
              ariaDisabled={hasPendingBulkInput}
              ariaDescribedBy={hasPendingBulkInput ? pendingInputDescriptionId : undefined}
              destructive
              onClick={() => {
                if (!hasPendingBulkInput) onDeleteGroup(group.key)
              }}
            >
              <Trash2 className="size-4" />
            </IconButton>
          </div>
        </div>

        <TechnicalConfigurationBaselineGroupContent
          group={group}
          ordinal={ordinal}
          sectionOrdinal={sectionOrdinal}
          groupLabel={groupLabel}
          mode={mode}
          bulkSession={bulkSession}
          subgroups={subgroups}
          expandedSubgroupKeys={expandedSubgroupKeys}
          subgroupErrors={subgroupErrors}
          criterionErrors={criterionErrors}
          disabled={disabled}
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
