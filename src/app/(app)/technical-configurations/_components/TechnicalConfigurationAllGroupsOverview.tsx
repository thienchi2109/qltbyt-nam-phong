"use client"

import * as React from "react"

import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type OverviewFilter = "all" | "errors" | "new"

type TechnicalConfigurationAllGroupsOverviewProps = Readonly<{
  draft: TechnicalConfigurationBaselineEditorDraft
  validation: TechnicalConfigurationBaselineEditorValidation
  onCriterionActivate: (groupKey: string, criterionKey: string) => void
}>

const FILTERS: ReadonlyArray<{ value: OverviewFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "errors", label: "Có lỗi" },
  { value: "new", label: "Mới thêm" },
]

/** Renders a filtered, read-only review of every group in the current draft. */
export function TechnicalConfigurationAllGroupsOverview({
  draft,
  validation,
  onCriterionActivate,
}: TechnicalConfigurationAllGroupsOverviewProps) {
  const [filter, setFilter] = React.useState<OverviewFilter>("all")
  const headingRef = React.useRef<HTMLHeadingElement>(null)

  React.useEffect(() => {
    headingRef.current?.focus()
    const timeoutId = window.setTimeout(() => headingRef.current?.focus(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const visibleGroups = React.useMemo(() => {
    const groups = []

    for (const [groupIndex, group] of draft.groups.entries()) {
      const hasGroupError = Boolean(validation.groupErrors[group.key])
      let criteria = group.criteria
      if (filter === "errors" && !hasGroupError) {
        criteria = group.criteria.filter((criterion) => validation.criterionErrors[criterion.key])
      } else if (filter === "new") {
        criteria = group.criteria.filter((criterion) => criterion.id === null)
      }
      if (criteria.length > 0 || (filter === "errors" && hasGroupError)) {
        groups.push({ group, groupIndex, criteria, hasGroupError })
      }
    }

    return groups
  }, [draft.groups, filter, validation.criterionErrors, validation.groupErrors])

  return (
    <section aria-label="Tổng quan tất cả nhóm" className="space-y-5 py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="text-base font-semibold">
            Xem tất cả nhóm
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {draft.groups.length} nhóm,{" "}
            {draft.groups.reduce((count, group) => count + group.criteria.length, 0)} tiêu chí
          </p>
        </div>
        <div className="flex w-fit rounded-md bg-muted p-1" aria-label="Lọc tiêu chí">
          {FILTERS.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={filter === item.value ? "secondary" : "ghost"}
              className="h-8"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <div className="border-y py-10 text-center text-sm text-muted-foreground">
          Không có tiêu chí phù hợp bộ lọc.
        </div>
      ) : (
        <div className="space-y-6">
          {visibleGroups.map(({ group, groupIndex, criteria, hasGroupError }) => {
            const criterionErrorCount = group.criteria.filter(
              (criterion) => validation.criterionErrors[criterion.key]
            ).length
            const errorCount = criterionErrorCount + (hasGroupError ? 1 : 0)

            return (
              <section key={group.key} aria-labelledby={`overview-group-${group.key}`}>
                <div className="flex flex-wrap items-center gap-2 border-b pb-2">
                  <h3 id={`overview-group-${group.key}`} className="font-semibold">
                    {groupIndex + 1}. {group.name.trim() || `Nhóm ${groupIndex + 1}`}
                  </h3>
                  <span className="text-sm text-muted-foreground">
                    {group.criteria.length} tiêu chí
                  </span>
                  {errorCount > 0 ? <Badge variant="destructive">{errorCount} lỗi</Badge> : null}
                </div>
                {validation.groupErrors[group.key] ? (
                  <p className="border-b py-2 text-sm text-destructive">
                    {validation.groupErrors[group.key]}
                  </p>
                ) : null}

                <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    <div className="grid grid-cols-[7rem_minmax(12rem,0.8fr)_minmax(24rem,2fr)_10rem] border-b bg-muted/70 text-xs font-semibold text-muted-foreground">
                      <span className="px-3 py-2">Mã</span>
                      <span className="px-3 py-2">Tiêu đề</span>
                      <span className="px-3 py-2">Nội dung yêu cầu</span>
                      <span className="px-3 py-2">Trạng thái</span>
                    </div>
                    <div className="divide-y">
                      {criteria.map((criterion) => {
                        const error = validation.criterionErrors[criterion.key]

                        return (
                          <button
                            key={criterion.key}
                            type="button"
                            className="grid w-full grid-cols-[7rem_minmax(12rem,0.8fr)_minmax(24rem,2fr)_10rem] text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            onClick={() => onCriterionActivate(group.key, criterion.key)}
                          >
                            <span className="px-3 py-3">
                              <Badge variant={criterion.id === null ? "secondary" : "outline"}>
                                {criterion.criterionCode ?? "Mới"}
                              </Badge>
                            </span>
                            <span className="px-3 py-3 text-sm">
                              {criterion.title || "Không có tiêu đề"}
                            </span>
                            <span className="whitespace-pre-wrap px-3 py-3 text-sm">
                              {criterion.requirementText || "Chưa nhập nội dung"}
                            </span>
                            <span className="px-3 py-3 text-sm">
                              {error ?? (criterion.id === null ? "Chưa lưu" : "Hợp lệ")}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}
