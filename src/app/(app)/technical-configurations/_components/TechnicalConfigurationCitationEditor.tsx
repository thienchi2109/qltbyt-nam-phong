"use client"

import * as React from "react"
import { Button, Chip, Input, Label, ListBox, Select, TextArea, TextField } from "@heroui/react"

import {
  getTechnicalConfigurationCitationValues,
  type TechnicalConfigurationCitationSelectionSnapshot,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationCitationEditorState"
import type { TechnicalConfigurationDocumentWire } from "@/app/(app)/technical-configurations/document-types"
import { isTechnicalConfigurationBaselineConflict } from "@/app/(app)/technical-configurations/technical-configuration-baseline-version-state"

export type TechnicalConfigurationCitationCriterion = {
  id: string
  criterionCode: string
  title: string
}

export type TechnicalConfigurationCitationSaveInput = {
  document: TechnicalConfigurationDocumentWire
  criterionId: string
  pageSection: string | null
  excerpt: string | null
}

type TechnicalConfigurationCitationEditorProps = {
  documents: readonly TechnicalConfigurationDocumentWire[]
  criteria: readonly TechnicalConfigurationCitationCriterion[]
  fixedCriterionId?: string | null
  isPending: boolean
  disabled: boolean
  onSave: (input: TechnicalConfigurationCitationSaveInput) => Promise<unknown>
  onDelete: (input: {
    document: TechnicalConfigurationDocumentWire
    citationId: string
  }) => Promise<unknown>
  onDirtyChange?: (dirty: boolean) => void
}

/** Renders controlled criterion-level citation fields with explicit persistence. */
export function TechnicalConfigurationCitationEditor({
  documents,
  criteria,
  fixedCriterionId = null,
  isPending,
  disabled,
  onSave,
  onDelete,
  onDirtyChange,
}: Readonly<TechnicalConfigurationCitationEditorProps>): React.JSX.Element {
  const initialDocumentId = documents[0]?.id ?? null
  const initialCriterionId = fixedCriterionId ?? criteria[0]?.id ?? null
  const initialDocument = documents.find((document) => document.id === initialDocumentId) ?? null
  const initialValues = getTechnicalConfigurationCitationValues(initialDocument, initialCriterionId)
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string | null>(
    initialDocumentId
  )
  const [selectedCriterionId, setSelectedCriterionId] = React.useState<string | null>(
    initialCriterionId
  )
  const [pageSection, setPageSection] = React.useState(initialValues.pageSection)
  const [excerpt, setExcerpt] = React.useState(initialValues.excerpt)
  const [baseValues, setBaseValues] = React.useState(initialValues)
  const [saveError, setSaveError] = React.useState<unknown>(null)
  const observedSelectionRef = React.useRef<TechnicalConfigurationCitationSelectionSnapshot>({
    documentId: initialDocumentId,
    criterionId: initialCriterionId,
    ...initialValues,
  })
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? null
  const selectedCriterion =
    criteria.find((criterion) => criterion.id === selectedCriterionId) ?? null
  const selectedCitation = selectedDocument?.citations.find(
    (citation) => citation.criterion_id === selectedCriterionId
  )
  const isDirty = pageSection !== baseValues.pageSection || excerpt !== baseValues.excerpt
  const canSave =
    !disabled && !isPending && selectedDocument !== null && selectedCriterionId !== null && isDirty

  React.useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const adoptSelection = React.useCallback(
    (documentId: string | null, criterionId: string | null) => {
      const document = documents.find((item) => item.id === documentId) ?? null
      const values = getTechnicalConfigurationCitationValues(document, criterionId)
      observedSelectionRef.current = { documentId, criterionId, ...values }
      setSelectedDocumentId(documentId)
      setSelectedCriterionId(criterionId)
      setPageSection(values.pageSection)
      setExcerpt(values.excerpt)
      setBaseValues(values)
      setSaveError(null)
    },
    [documents]
  )

  React.useEffect(() => {
    const documentId = selectedDocument?.id ?? documents[0]?.id ?? null
    const criterionId = fixedCriterionId ?? selectedCriterion?.id ?? criteria[0]?.id ?? null
    const document = documents.find((item) => item.id === documentId) ?? null
    const values = getTechnicalConfigurationCitationValues(document, criterionId)
    const observed = observedSelectionRef.current
    const serverSelectionChanged =
      observed.documentId !== documentId ||
      observed.criterionId !== criterionId ||
      observed.pageSection !== values.pageSection ||
      observed.excerpt !== values.excerpt

    if (!serverSelectionChanged || isDirty) return
    adoptSelection(documentId, criterionId)
  }, [
    adoptSelection,
    criteria,
    documents,
    fixedCriterionId,
    isDirty,
    selectedCriterion,
    selectedDocument,
  ])

  const requestSelection = React.useCallback(
    (documentId: string | null, criterionId: string | null) => {
      if (documentId === selectedDocumentId && criterionId === selectedCriterionId) {
        return
      }
      if (
        isDirty &&
        !window.confirm("Chuyển lựa chọn sẽ bỏ nội dung trích dẫn chưa lưu. Tiếp tục?")
      ) {
        return
      }
      adoptSelection(documentId, criterionId)
    },
    [adoptSelection, isDirty, selectedCriterionId, selectedDocumentId]
  )

  const handleSave = React.useCallback(async () => {
    if (!canSave || !selectedDocument || !selectedCriterionId) return
    setSaveError(null)
    try {
      await onSave({
        document: selectedDocument,
        criterionId: selectedCriterionId,
        pageSection: pageSection || null,
        excerpt: excerpt || null,
      })
      setBaseValues({ pageSection, excerpt })
    } catch (error) {
      setSaveError(error)
    }
  }, [canSave, excerpt, onSave, pageSection, selectedCriterionId, selectedDocument])

  const handleDelete = React.useCallback(async () => {
    if (disabled || isPending || !selectedDocument || !selectedCitation) return
    setSaveError(null)
    try {
      await onDelete({
        document: selectedDocument,
        citationId: selectedCitation.id,
      })
      const emptyValues = { pageSection: "", excerpt: "" }
      observedSelectionRef.current = {
        documentId: selectedDocument.id,
        criterionId: selectedCriterionId,
        ...emptyValues,
      }
      setPageSection("")
      setExcerpt("")
      setBaseValues(emptyValues)
    } catch (error) {
      setSaveError(error)
    }
  }, [disabled, isPending, onDelete, selectedCitation, selectedCriterionId, selectedDocument])

  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Thêm ít nhất một tài liệu trước khi tạo trích dẫn.
      </p>
    )
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex flex-wrap items-end gap-3">
        {documents.length === 1 && selectedDocument ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">Tài liệu</p>
            <Chip size="sm" variant="soft">
              {selectedDocument?.name}
            </Chip>
          </div>
        ) : (
          <Select
            className="min-w-56 flex-1"
            selectedKey={selectedDocument?.id ?? null}
            onSelectionChange={(key) =>
              requestSelection(key === null ? null : String(key), selectedCriterionId)
            }
            isDisabled={disabled || isPending}
            placeholder="Chọn tài liệu"
          >
            <Label>Tài liệu</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {documents.map((document) => (
                  <ListBox.Item key={document.id} id={document.id} textValue={document.name}>
                    {document.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        )}

        {fixedCriterionId ? (
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium">Tiêu chí</p>
            <p className="truncate text-sm text-muted-foreground">
              {selectedCriterion
                ? `${selectedCriterion.criterionCode} · ${selectedCriterion.title}`
                : "Tiêu chí đang chọn"}
            </p>
          </div>
        ) : (
          <Select
            className="min-w-56 flex-1"
            selectedKey={selectedCriterion?.id ?? null}
            onSelectionChange={(key) =>
              requestSelection(selectedDocumentId, key === null ? null : String(key))
            }
            isDisabled={disabled || isPending}
            placeholder="Chọn tiêu chí"
          >
            <Label>Tiêu chí</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {criteria.map((criterion) => (
                  <ListBox.Item
                    key={criterion.id}
                    id={criterion.id}
                    textValue={`${criterion.criterionCode} ${criterion.title}`}
                  >
                    {criterion.criterionCode} · {criterion.title}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        )}
      </div>

      <TextField value={pageSection} onChange={setPageSection} isDisabled={disabled || isPending}>
        <Label>Trang hoặc mục</Label>
        <Input placeholder="Ví dụ: Trang 12, Mục 4.2" />
      </TextField>
      <TextField value={excerpt} onChange={setExcerpt} isDisabled={disabled || isPending}>
        <Label>Trích đoạn</Label>
        <TextArea rows={5} placeholder="Nhập nguyên văn đoạn chứng minh cho tiêu chí." />
      </TextField>

      {selectedDocumentId !== null && selectedDocument === null ? (
        <p role="alert" className="text-sm text-destructive">
          Tài liệu đang chỉnh sửa không còn trong danh sách. Nội dung chưa lưu được giữ lại.
        </p>
      ) : null}

      {saveError ? (
        <p role="alert" className="text-sm text-destructive">
          {isTechnicalConfigurationBaselineConflict(saveError)
            ? "Phiên bản đã thay đổi trên máy chủ. Nội dung trích dẫn được giữ lại để thử lại."
            : "Không thể lưu trích dẫn. Vui lòng thử lại."}
        </p>
      ) : null}

      {!disabled ? (
        <div className="flex flex-wrap justify-end gap-2">
          {selectedCitation ? (
            <Button
              variant="danger-soft"
              isDisabled={isPending}
              onPress={() => void handleDelete()}
            >
              Xóa trích dẫn
            </Button>
          ) : null}
          <Button isPending={isPending} isDisabled={!canSave} onPress={() => void handleSave()}>
            Lưu trích dẫn
          </Button>
        </div>
      ) : null}
    </div>
  )
}
