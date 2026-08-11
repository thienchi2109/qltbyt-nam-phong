"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react"

import type {
  TechnicalConfigurationBaselineEditorCriterion,
  TechnicalConfigurationBaselineEditorCriterionOwner,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { TechnicalConfigurationBaselineCriterionOwnerSelect } from "./TechnicalConfigurationBaselineCriterionOwnerSelect"
import { TechnicalConfigurationBaselineEditorIconButton as IconButton } from "./TechnicalConfigurationBaselineEditorControls"
import type { TechnicalConfigurationBaselineCriterionOwnerOption } from "./TechnicalConfigurationBaselineHierarchyAuthoring"

type CriterionTextField = "title" | "requirementText"

type SubgroupCriteriaAuthoring = Readonly<{
  owner: TechnicalConfigurationBaselineEditorCriterionOwner
  ownerOptions: readonly TechnicalConfigurationBaselineCriterionOwnerOption[]
  disabled: boolean
  onCriterionTextChange: (criterionKey: string, field: CriterionTextField, value: string) => void
  onMoveCriterion: (criterionIndex: number, offset: -1 | 1) => void
  onMoveCriterionToOwner: (
    criterionKey: string,
    owner: TechnicalConfigurationBaselineEditorCriterionOwner
  ) => void
  onDeleteCriterion: (criterionKey: string) => void
}>

type TechnicalConfigurationBaselineSubgroupCriteriaProps = Readonly<{
  criteria: readonly TechnicalConfigurationBaselineEditorCriterion[]
  sectionOrdinal: string
  subgroupOrdinal: number
  criterionErrors: Record<string, string>
  focusCriterionKey: string | null
  focusCriterionToken: number | null
  authoring?: SubgroupCriteriaAuthoring
}>

const RESPONSIVE_COLUMNS =
  "grid-cols-1 md:grid-cols-2 xl:grid-cols-[3rem_7rem_minmax(0,0.8fr)_minmax(0,2fr)_7rem]"
const AUTHORING_RESPONSIVE_COLUMNS =
  "grid-cols-1 md:grid-cols-2 xl:grid-cols-[3rem_7rem_minmax(0,0.8fr)_minmax(0,2fr)_minmax(0,1fr)_7rem_7rem]"

/** Presents subgroup criteria without mounting the P4C authoring controls. */
export function TechnicalConfigurationBaselineSubgroupCriteria({
  criteria,
  sectionOrdinal,
  subgroupOrdinal,
  criterionErrors,
  focusCriterionKey,
  focusCriterionToken,
  authoring,
}: TechnicalConfigurationBaselineSubgroupCriteriaProps): React.JSX.Element {
  const requirementRefs = React.useRef(new Map<string, HTMLTextAreaElement>())
  const subgroupContext = `nhóm con ${subgroupOrdinal}, nhóm ${sectionOrdinal}`
  const columns = authoring ? AUTHORING_RESPONSIVE_COLUMNS : RESPONSIVE_COLUMNS

  React.useEffect(() => {
    if (!focusCriterionKey) return
    const timeoutId = window.setTimeout(() => {
      const target = requirementRefs.current.get(focusCriterionKey)
      target?.focus()
      target?.scrollIntoView?.({ block: "nearest" })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [focusCriterionKey, focusCriterionToken])

  return (
    <section aria-label={`Danh sách tiêu chí của ${subgroupContext}`} className="min-w-0">
      {criteria.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nhóm con này chưa có tiêu chí.
        </p>
      ) : (
        <div className="divide-y border-y">
          {criteria.map((criterion, criterionIndex) => {
            const criterionOrdinal = criterionIndex + 1
            const criterionLabel = `tiêu chí ${criterionOrdinal} của ${subgroupContext}`
            const error = criterionErrors[criterion.key]
            const errorId = error
              ? `baseline-subgroup-requirement-error-${criterion.key}`
              : undefined

            return (
              <div
                key={criterion.key}
                data-testid="baseline-subgroup-criterion-grid"
                className={`grid ${columns} min-w-0 items-start gap-3 bg-background px-3 py-3 md:gap-0 md:px-0 md:py-0`}
              >
                <span className="text-sm font-medium md:px-3 md:py-4 md:text-center">
                  <span className="mr-2 text-xs text-muted-foreground">STT</span>
                  {criterionIndex + 1}
                </span>
                <div className="md:px-3 md:py-3">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Mã</span>
                  <Badge variant="outline">{criterion.criterionCode ?? "Mới"}</Badge>
                </div>
                <div className="min-w-0 md:px-2 md:py-2">
                  <label
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                    htmlFor={`baseline-subgroup-title-${criterion.key}`}
                  >
                    Tiêu đề {criterionLabel}
                  </label>
                  <Input
                    id={`baseline-subgroup-title-${criterion.key}`}
                    aria-label={`Tiêu đề ${criterionLabel}`}
                    value={criterion.title}
                    readOnly={!authoring}
                    disabled={authoring?.disabled}
                    onChange={(event) =>
                      authoring?.onCriterionTextChange(criterion.key, "title", event.target.value)
                    }
                  />
                </div>
                <div className="min-w-0 md:px-2 md:py-2">
                  <label
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                    htmlFor={`baseline-subgroup-requirement-${criterion.key}`}
                  >
                    Nội dung yêu cầu {criterionLabel}
                  </label>
                  <Textarea
                    ref={(node) => {
                      if (node) requirementRefs.current.set(criterion.key, node)
                      else requirementRefs.current.delete(criterion.key)
                    }}
                    id={`baseline-subgroup-requirement-${criterion.key}`}
                    aria-label={`Nội dung yêu cầu ${criterionLabel}`}
                    className="min-h-20 resize-y whitespace-pre-wrap"
                    value={criterion.requirementText}
                    readOnly={!authoring}
                    disabled={authoring?.disabled}
                    aria-invalid={Boolean(error)}
                    aria-describedby={errorId}
                    onChange={(event) =>
                      authoring?.onCriterionTextChange(
                        criterion.key,
                        "requirementText",
                        event.target.value
                      )
                    }
                  />
                  {error ? (
                    <p id={errorId} className="mt-1 text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}
                </div>
                {authoring ? (
                  <div className="min-w-0 md:px-2 md:py-2">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      Vị trí
                    </span>
                    <TechnicalConfigurationBaselineCriterionOwnerSelect
                      label={`Chuyển ${criterionLabel}`}
                      owner={authoring.owner}
                      options={authoring.ownerOptions}
                      disabled={authoring.disabled}
                      onMove={(owner) => authoring.onMoveCriterionToOwner(criterion.key, owner)}
                    />
                  </div>
                ) : null}
                <div className="md:px-3 md:py-3">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Trạng thái
                  </span>
                  <Badge variant={error ? "destructive" : "outline"}>
                    {error ? "Có lỗi" : "Hợp lệ"}
                  </Badge>
                </div>
                {authoring ? (
                  <div className="flex items-center gap-1 md:justify-center md:px-2 md:py-2">
                    <IconButton
                      label={`Di chuyển ${criterionLabel} lên`}
                      title="Di chuyển lên"
                      disabled={authoring.disabled || criterionIndex === 0}
                      onClick={() => authoring.onMoveCriterion(criterionIndex, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Di chuyển ${criterionLabel} xuống`}
                      title="Di chuyển xuống"
                      disabled={authoring.disabled || criterionIndex === criteria.length - 1}
                      onClick={() => authoring.onMoveCriterion(criterionIndex, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Xóa ${criterionLabel}`}
                      title="Xóa tiêu chí"
                      disabled={authoring.disabled}
                      destructive
                      onClick={() => authoring.onDeleteCriterion(criterion.key)}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
