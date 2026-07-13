"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"

import type { TechnicalConfigurationBaselineEditorGroup } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { TechnicalConfigurationBaselineEditorIconButton as IconButton } from "./TechnicalConfigurationBaselineEditorControls"

type CriterionTextField = "title" | "requirementText"

type TechnicalConfigurationCriteriaSpreadsheetProps = Readonly<{
  group: TechnicalConfigurationBaselineEditorGroup
  groupIndex: number
  criterionErrors: Record<string, string>
  disabled: boolean
  focusCriterionKey: string | null
  focusAddCriterionToken: number | null
  recentlyAcceptedCriterionKeys: ReadonlySet<string>
  onCriterionTextChange: (criterionKey: string, field: CriterionTextField, value: string) => void
  onMoveCriterion: (criterionIndex: number, offset: -1 | 1) => void
  onDeleteCriterion: (criterionKey: string) => void
  onAddCriterion: () => void
}>

const GRID_COLUMNS = "grid-cols-[3rem_7rem_minmax(12rem,0.8fr)_minmax(24rem,2fr)_9rem_7rem]"

/** Renders editable criteria for one selected group in a stable spreadsheet grid. */
export function TechnicalConfigurationCriteriaSpreadsheet({
  group,
  groupIndex,
  criterionErrors,
  disabled,
  focusCriterionKey,
  focusAddCriterionToken,
  recentlyAcceptedCriterionKeys,
  onCriterionTextChange,
  onMoveCriterion,
  onDeleteCriterion,
  onAddCriterion,
}: TechnicalConfigurationCriteriaSpreadsheetProps) {
  const requirementRefs = React.useRef(new Map<string, HTMLTextAreaElement>())
  const addCriterionRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (!focusCriterionKey) return
    const timeoutId = window.setTimeout(() => {
      const target = requirementRefs.current.get(focusCriterionKey)
      target?.focus()
      target?.scrollIntoView?.({ block: "nearest" })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [focusCriterionKey])

  React.useEffect(() => {
    if (focusAddCriterionToken === null) return
    const timeoutId = window.setTimeout(() => addCriterionRef.current?.focus(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [focusAddCriterionToken])

  return (
    <section aria-label={`Danh sách tiêu chí nhóm ${groupIndex}`} className="min-w-0">
      <div className="overflow-x-auto border-y">
        <div className="min-w-[960px]">
          <div
            className={`sticky top-0 z-10 grid ${GRID_COLUMNS} border-b bg-muted/95 text-xs font-semibold text-muted-foreground`}
          >
            <span className="px-3 py-2.5 text-center">STT</span>
            <span className="px-3 py-2.5">Mã</span>
            <span className="px-3 py-2.5">Tiêu đề</span>
            <span className="px-3 py-2.5">Nội dung yêu cầu</span>
            <span className="px-3 py-2.5">Trạng thái</span>
            <span className="px-3 py-2.5 text-center">Thao tác</span>
          </div>

          {group.criteria.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nhóm này chưa có tiêu chí.
            </div>
          ) : (
            <div className="divide-y">
              {group.criteria.map((criterion, criterionIndex) => {
                const criterionNumber = `${groupIndex}.${criterionIndex + 1}`
                const error = criterionErrors[criterion.key]
                const errorId = error ? `baseline-requirement-error-${criterion.key}` : undefined
                const isRecent = recentlyAcceptedCriterionKeys.has(criterion.key)

                return (
                  <div
                    key={criterion.key}
                    data-testid={`criterion-row-${criterion.key}`}
                    data-recently-accepted={isRecent ? "true" : undefined}
                    className={`grid ${GRID_COLUMNS} items-start transition-colors ${
                      isRecent ? "bg-emerald-50/70" : "bg-background"
                    }`}
                  >
                    <span className="px-3 py-4 text-center text-sm font-medium">
                      {criterionIndex + 1}
                    </span>
                    <div className="px-3 py-3">
                      <Badge variant={criterion.id === null ? "secondary" : "outline"}>
                        {criterion.criterionCode ?? "Mới"}
                      </Badge>
                    </div>
                    <div className="px-2 py-2">
                      <label className="sr-only" htmlFor={`baseline-title-${criterion.key}`}>
                        Tiêu đề tiêu chí {criterionNumber}
                      </label>
                      <Input
                        id={`baseline-title-${criterion.key}`}
                        aria-label={`Tiêu đề tiêu chí ${criterionNumber}`}
                        placeholder="Không bắt buộc"
                        value={criterion.title}
                        disabled={disabled}
                        onChange={(event) =>
                          onCriterionTextChange(criterion.key, "title", event.target.value)
                        }
                      />
                    </div>
                    <div className="px-2 py-2">
                      <label className="sr-only" htmlFor={`baseline-requirement-${criterion.key}`}>
                        Nội dung yêu cầu {criterionNumber}
                      </label>
                      <Textarea
                        ref={(node) => {
                          if (node) requirementRefs.current.set(criterion.key, node)
                          else requirementRefs.current.delete(criterion.key)
                        }}
                        id={`baseline-requirement-${criterion.key}`}
                        aria-label={`Nội dung yêu cầu ${criterionNumber}`}
                        className="min-h-20 resize-y whitespace-pre-wrap"
                        value={criterion.requirementText}
                        disabled={disabled}
                        aria-invalid={Boolean(error)}
                        aria-describedby={errorId}
                        onChange={(event) =>
                          onCriterionTextChange(
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
                    <div className="px-3 py-3">
                      {error ? (
                        <Badge variant="destructive">Có lỗi</Badge>
                      ) : criterion.id === null ? (
                        <Badge variant="secondary">Chưa lưu</Badge>
                      ) : (
                        <Badge variant="outline">Hợp lệ</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-1 px-2 py-2">
                      <IconButton
                        label={`Di chuyển tiêu chí ${criterionNumber} lên`}
                        title="Di chuyển lên"
                        disabled={disabled || criterionIndex === 0}
                        onClick={() => onMoveCriterion(criterionIndex, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </IconButton>
                      <IconButton
                        label={`Di chuyển tiêu chí ${criterionNumber} xuống`}
                        title="Di chuyển xuống"
                        disabled={disabled || criterionIndex === group.criteria.length - 1}
                        onClick={() => onMoveCriterion(criterionIndex, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </IconButton>
                      <IconButton
                        label={`Xóa tiêu chí ${criterionNumber}`}
                        title="Xóa tiêu chí"
                        disabled={disabled}
                        destructive
                        onClick={() => onDeleteCriterion(criterion.key)}
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-3">
        <Button
          ref={addCriterionRef}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={`Thêm tiêu chí vào nhóm ${groupIndex}`}
          onClick={onAddCriterion}
        >
          <Plus className="size-4" aria-hidden="true" />
          Thêm tiêu chí
        </Button>
      </div>
    </section>
  )
}
