import { ArrowDown, ArrowUp, LoaderCircle, Plus, Save, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import {
  createTechnicalConfigurationBaselineEditorCriterion,
  createTechnicalConfigurationBaselineEditorGroup,
  moveTechnicalConfigurationBaselineEditorItem,
} from "../technical-configuration-baseline-editor"
import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "../technical-configuration-baseline-editor"
import { TechnicalConfigurationBaselineEditorIconButton as IconButton } from "./TechnicalConfigurationBaselineEditorControls"

type TechnicalConfigurationBaselineEditorProps = {
  draft: TechnicalConfigurationBaselineEditorDraft
  validation: TechnicalConfigurationBaselineEditorValidation
  isDirty: boolean
  isSaving: boolean
  isConflict: boolean
  saveStatus: "idle" | "saved"
  onChange: (draft: TechnicalConfigurationBaselineEditorDraft) => void
  onSave: () => void
}

/** Renders the P3B two-level baseline form without owning server state. */
export function TechnicalConfigurationBaselineEditor({
  draft,
  validation,
  isDirty,
  isSaving,
  isConflict,
  saveStatus,
  onChange,
  onSave,
}: Readonly<TechnicalConfigurationBaselineEditorProps>) {
  const updateGroups = (groups: TechnicalConfigurationBaselineEditorDraft["groups"]) => {
    onChange({ ...draft, groups })
  }

  const updateGroup = (
    groupKey: string,
    update: (group: TechnicalConfigurationBaselineEditorDraft["groups"][number]) => void
  ) => {
    updateGroups(
      draft.groups.map((group) => {
        if (group.key !== groupKey) return group
        const nextGroup = {
          ...group,
          criteria: group.criteria.map((criterion) => ({ ...criterion })),
        }
        update(nextGroup)
        return nextGroup
      })
    )
  }

  return (
    <section aria-label="Trình soạn cấu hình cơ sở">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Bản nháp cấu hình cơ sở</h2>
            <Badge variant="secondary">Bản nháp</Badge>
          </div>
          {isDirty ? (
            <p className="mt-1 text-sm font-medium text-amber-700">Có thay đổi chưa lưu</p>
          ) : saveStatus === "saved" ? (
            <p className="mt-1 text-sm font-medium text-emerald-700">Đã lưu</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() =>
              updateGroups([...draft.groups, createTechnicalConfigurationBaselineEditorGroup()])
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            Thêm nhóm
          </Button>
          <Button type="button" disabled={!isDirty || isSaving || isConflict} onClick={onSave}>
            {isSaving ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {isSaving ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </div>

      <div>
        {draft.groups.map((group, groupIndex) => (
          <section key={group.key} className="border-b py-6 first:border-t">
            <div className="grid min-w-0 gap-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-start">
              <span className="flex size-10 items-center justify-center rounded-md border bg-muted text-sm font-semibold">
                {groupIndex + 1}
              </span>
              <div className="min-w-0">
                <label className="sr-only" htmlFor={`baseline-group-${group.key}`}>
                  Tên nhóm {groupIndex + 1}
                </label>
                <Input
                  id={`baseline-group-${group.key}`}
                  aria-label={`Tên nhóm ${groupIndex + 1}`}
                  value={group.name}
                  disabled={isSaving}
                  aria-invalid={Boolean(validation.groupErrors[group.key])}
                  onChange={(event) =>
                    updateGroup(group.key, (nextGroup) => {
                      nextGroup.name = event.target.value
                    })
                  }
                />
                {validation.groupErrors[group.key] ? (
                  <p className="mt-1 text-sm text-destructive">
                    {validation.groupErrors[group.key]}
                  </p>
                ) : null}
              </div>
              <div className="flex h-10 items-center gap-1">
                <IconButton
                  label={`Di chuyển nhóm ${groupIndex + 1} lên`}
                  title="Di chuyển lên"
                  disabled={isSaving || groupIndex === 0}
                  onClick={() =>
                    updateGroups([
                      ...moveTechnicalConfigurationBaselineEditorItem(draft.groups, groupIndex, -1),
                    ])
                  }
                >
                  <ArrowUp className="size-4" />
                </IconButton>
                <IconButton
                  label={`Di chuyển nhóm ${groupIndex + 1} xuống`}
                  title="Di chuyển xuống"
                  disabled={isSaving || groupIndex === draft.groups.length - 1}
                  onClick={() =>
                    updateGroups([
                      ...moveTechnicalConfigurationBaselineEditorItem(draft.groups, groupIndex, 1),
                    ])
                  }
                >
                  <ArrowDown className="size-4" />
                </IconButton>
                <IconButton
                  label={`Xóa nhóm ${groupIndex + 1}`}
                  title="Xóa nhóm"
                  disabled={isSaving}
                  destructive
                  onClick={() =>
                    updateGroups(draft.groups.filter((item) => item.key !== group.key))
                  }
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            </div>

            <div className="mt-5 space-y-4 sm:ml-[3.25rem]">
              {group.criteria.map((criterion, criterionIndex) => (
                <div
                  key={criterion.key}
                  className="grid min-w-0 gap-3 border-l-2 pl-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{criterion.criterionCode ?? "Mới"}</Badge>
                      <span className="text-sm text-muted-foreground">
                        Tiêu chí {groupIndex + 1}.{criterionIndex + 1}
                      </span>
                    </div>
                    <label className="sr-only" htmlFor={`baseline-title-${criterion.key}`}>
                      Tiêu đề tiêu chí {groupIndex + 1}.{criterionIndex + 1}
                    </label>
                    <Input
                      id={`baseline-title-${criterion.key}`}
                      aria-label={`Tiêu đề tiêu chí ${groupIndex + 1}.${criterionIndex + 1}`}
                      placeholder="Tiêu đề (không bắt buộc)"
                      value={criterion.title}
                      disabled={isSaving}
                      onChange={(event) =>
                        updateGroup(group.key, (nextGroup) => {
                          const nextCriterion = nextGroup.criteria.find(
                            (item) => item.key === criterion.key
                          )
                          if (nextCriterion) nextCriterion.title = event.target.value
                        })
                      }
                    />
                    <label className="sr-only" htmlFor={`baseline-requirement-${criterion.key}`}>
                      Nội dung yêu cầu {groupIndex + 1}.{criterionIndex + 1}
                    </label>
                    <Textarea
                      id={`baseline-requirement-${criterion.key}`}
                      aria-label={`Nội dung yêu cầu ${groupIndex + 1}.${criterionIndex + 1}`}
                      className="min-h-28 resize-y whitespace-pre-wrap"
                      value={criterion.requirementText}
                      disabled={isSaving}
                      aria-invalid={Boolean(validation.criterionErrors[criterion.key])}
                      onChange={(event) =>
                        updateGroup(group.key, (nextGroup) => {
                          const nextCriterion = nextGroup.criteria.find(
                            (item) => item.key === criterion.key
                          )
                          if (nextCriterion) nextCriterion.requirementText = event.target.value
                        })
                      }
                    />
                    {validation.criterionErrors[criterion.key] ? (
                      <p className="text-sm text-destructive">
                        {validation.criterionErrors[criterion.key]}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex h-9 items-center gap-1">
                    <IconButton
                      label={`Di chuyển tiêu chí ${groupIndex + 1}.${criterionIndex + 1} lên`}
                      title="Di chuyển lên"
                      disabled={isSaving || criterionIndex === 0}
                      onClick={() =>
                        updateGroup(group.key, (nextGroup) => {
                          nextGroup.criteria = [
                            ...moveTechnicalConfigurationBaselineEditorItem(
                              nextGroup.criteria,
                              criterionIndex,
                              -1
                            ),
                          ]
                        })
                      }
                    >
                      <ArrowUp className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Di chuyển tiêu chí ${groupIndex + 1}.${criterionIndex + 1} xuống`}
                      title="Di chuyển xuống"
                      disabled={isSaving || criterionIndex === group.criteria.length - 1}
                      onClick={() =>
                        updateGroup(group.key, (nextGroup) => {
                          nextGroup.criteria = [
                            ...moveTechnicalConfigurationBaselineEditorItem(
                              nextGroup.criteria,
                              criterionIndex,
                              1
                            ),
                          ]
                        })
                      }
                    >
                      <ArrowDown className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Xóa tiêu chí ${groupIndex + 1}.${criterionIndex + 1}`}
                      title="Xóa tiêu chí"
                      disabled={isSaving}
                      destructive
                      onClick={() =>
                        updateGroup(group.key, (nextGroup) => {
                          nextGroup.criteria = nextGroup.criteria.filter(
                            (item) => item.key !== criterion.key
                          )
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSaving}
                aria-label={`Thêm tiêu chí vào nhóm ${groupIndex + 1}`}
                onClick={() =>
                  updateGroup(group.key, (nextGroup) => {
                    nextGroup.criteria.push(createTechnicalConfigurationBaselineEditorCriterion())
                  })
                }
              >
                <Plus className="size-4" aria-hidden="true" />
                Thêm tiêu chí
              </Button>
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
