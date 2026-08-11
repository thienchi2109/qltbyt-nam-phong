"use client"

import * as React from "react"

import type { TechnicalConfigurationBaselineEditorCriterion } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type TechnicalConfigurationBaselineSubgroupCriteriaProps = Readonly<{
  criteria: readonly TechnicalConfigurationBaselineEditorCriterion[]
  sectionOrdinal: string
  subgroupOrdinal: number
  criterionErrors: Record<string, string>
  focusCriterionKey: string | null
  focusCriterionToken: number | null
}>

const RESPONSIVE_COLUMNS =
  "grid-cols-1 md:grid-cols-2 xl:grid-cols-[3rem_7rem_minmax(0,0.8fr)_minmax(0,2fr)_7rem]"

/** Presents subgroup criteria without mounting the P4C authoring controls. */
export function TechnicalConfigurationBaselineSubgroupCriteria({
  criteria,
  sectionOrdinal,
  subgroupOrdinal,
  criterionErrors,
  focusCriterionKey,
  focusCriterionToken,
}: TechnicalConfigurationBaselineSubgroupCriteriaProps): React.JSX.Element {
  const requirementRefs = React.useRef(new Map<string, HTMLTextAreaElement>())
  const subgroupContext = `nhóm con ${subgroupOrdinal}, nhóm ${sectionOrdinal}`

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
                className={`grid ${RESPONSIVE_COLUMNS} min-w-0 items-start gap-3 bg-background px-3 py-3 md:gap-0 md:px-0 md:py-0`}
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
                    readOnly
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
                    readOnly
                    aria-invalid={Boolean(error)}
                    aria-describedby={errorId}
                  />
                  {error ? (
                    <p id={errorId} className="mt-1 text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}
                </div>
                <div className="md:px-3 md:py-3">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Trạng thái
                  </span>
                  <Badge variant={error ? "destructive" : "outline"}>
                    {error ? "Có lỗi" : "Hợp lệ"}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
