"use client"

import * as React from "react"
import { Chip, ListBox, Select } from "@heroui/react"

import { TechnicalConfigurationCitationEditor } from "./TechnicalConfigurationCitationEditor"
import { TechnicalConfigurationDocumentDeleteDialog } from "./TechnicalConfigurationDocumentDeleteDialog"
import { TechnicalConfigurationDocumentsQueryError } from "./TechnicalConfigurationDocumentsQueryError"
import { useTechnicalConfigurationDiscardConfirmation } from "../_hooks/useTechnicalConfigurationDiscardConfirmation"
import { useTechnicalConfigurationDocumentDraft } from "../_hooks/useTechnicalConfigurationDocumentDraft"
import { useTechnicalConfigurationOptionDocuments } from "../_hooks/useTechnicalConfigurationOptionDocuments"
import type { TechnicalConfigurationBaselineDraftWire } from "../baseline-types"
import type { TechnicalConfigurationOptionDocumentWire } from "../document-types"
import type { TechnicalConfigurationOptionWire } from "../supplier-option-types"
import type { TechnicalConfigurationComparisonSetWire } from "../supplier-option-types"
import type { TechnicalConfigurationDossierWire } from "../types"
import { UrlDocumentForm } from "@/components/url-documents/UrlDocumentForm"
import { UrlDocumentList } from "@/components/url-documents/UrlDocumentList"
import {
  isAllowedDocumentUrl,
  parseAbsoluteUrl,
} from "@/components/url-documents/url-document-utils"

type TechnicalConfigurationOptionDocumentsProps = {
  dossier: TechnicalConfigurationDossierWire
  option: TechnicalConfigurationOptionWire
  baselineVersion: TechnicalConfigurationBaselineDraftWire
  comparisonSet?: TechnicalConfigurationComparisonSetWire | null
  criterionId?: string | null
  isExternalMutationBlocked?: boolean
  onRevisionChange?: (revision: number) => void
  onDirtyChange?: (dirty: boolean) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
}

/** Renders shared option documents with citations scoped to one exact baseline. */
export function TechnicalConfigurationOptionDocuments({
  dossier,
  option,
  baselineVersion,
  comparisonSet = null,
  criterionId = null,
  isExternalMutationBlocked = false,
  onRevisionChange,
  onDirtyChange,
  onNavigationBlockedChange,
}: Readonly<TechnicalConfigurationOptionDocumentsProps>): React.JSX.Element {
  const [citationDirty, setCitationDirty] = React.useState(false)
  const [pendingDeleteDocument, setPendingDeleteDocument] =
    React.useState<TechnicalConfigurationOptionDocumentWire | null>(null)
  const [deleteError, setDeleteError] = React.useState<unknown>(null)
  const { discardConfirmationDialog, requestDiscardConfirmation } =
    useTechnicalConfigurationDiscardConfirmation()
  const documentState = useTechnicalConfigurationOptionDocuments({
    dossier,
    option,
    baselineVersion,
    comparisonSet,
    isMutationBlocked: isExternalMutationBlocked,
    onRevisionChange,
    onNavigationBlockedChange,
  })
  const {
    name,
    url,
    selectedDocumentId,
    selectedDocument,
    selectedDocumentMissing,
    documentDirty,
    setName,
    setUrl,
    clearDraft,
    selectDocument: adoptSelectedDocument,
  } = useTechnicalConfigurationDocumentDraft(documentState.documents)
  const hasInitialDocumentsError =
    documentState.documentsQuery.isError && documentState.documentsQuery.data === undefined
  const hasStaleDocuments =
    documentState.documentsQuery.isError && documentState.documentsQuery.data !== undefined
  const controlsDisabled =
    documentState.isReadOnly || documentState.isMutationBlocked || hasStaleDocuments
  const criteria = React.useMemo(
    () =>
      baselineVersion.groups.flatMap((group) =>
        group.criteria.map((criterion) => ({
          id: criterion.id,
          criterionCode: criterion.criterion_code,
          title: criterion.title ?? criterion.requirement_text,
        }))
      ),
    [baselineVersion.groups]
  )
  const parsedUrl = parseAbsoluteUrl(url)
  const validationError =
    url && !isAllowedDocumentUrl(parsedUrl)
      ? "Chỉ chấp nhận đường dẫn HTTP hoặc HTTPS hợp lệ."
      : null
  const isDirty = documentDirty || citationDirty

  React.useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])
  React.useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const resetDraft = React.useCallback(() => {
    if (documentDirty) {
      requestDiscardConfirmation(
        "Chuyển tài liệu sẽ bỏ nội dung tài liệu chưa lưu. Tiếp tục?",
        clearDraft
      )
      return
    }
    clearDraft()
  }, [clearDraft, documentDirty, requestDiscardConfirmation])

  const selectDocument = React.useCallback(
    (documentId: string) => {
      if (documentId === selectedDocumentId) return
      const document = documentState.documents.find((item) => item.id === documentId)
      if (!document) return
      if (documentDirty) {
        requestDiscardConfirmation(
          "Chuyển tài liệu sẽ bỏ nội dung tài liệu chưa lưu. Tiếp tục?",
          () => adoptSelectedDocument(document)
        )
        return
      }
      adoptSelectedDocument(document)
    },
    [
      adoptSelectedDocument,
      documentDirty,
      documentState.documents,
      requestDiscardConfirmation,
      selectedDocumentId,
    ]
  )

  const handleSubmit = React.useCallback(async () => {
    const acceptedUrl = parseAbsoluteUrl(url)
    if (selectedDocumentMissing || !name || !isAllowedDocumentUrl(acceptedUrl)) return
    try {
      if (selectedDocument) {
        await documentState.updateDocument({ document: selectedDocument, name, url })
      } else {
        await documentState.createDocument({ name, url })
      }
      clearDraft()
    } catch {
      // The hook owns the mutation error while the controlled draft remains retryable.
    }
  }, [clearDraft, documentState, name, selectedDocument, selectedDocumentMissing, url])

  const requestDelete = React.useCallback(
    (documentId: string) => {
      const document = documentState.documents.find((item) => item.id === documentId)
      if (!document || controlsDisabled) return
      setDeleteError(null)
      setPendingDeleteDocument(document)
    },
    [controlsDisabled, documentState.documents]
  )

  const confirmDelete = React.useCallback(async () => {
    if (!pendingDeleteDocument || controlsDisabled) return
    setDeleteError(null)
    try {
      await documentState.deleteDocument(pendingDeleteDocument)
      if (selectedDocumentId === pendingDeleteDocument.id) clearDraft()
      setPendingDeleteDocument(null)
    } catch (error) {
      setDeleteError(error)
    }
  }, [clearDraft, controlsDisabled, documentState, pendingDeleteDocument, selectedDocumentId])

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <div className="min-w-0">
        <h3 className="text-base font-semibold">Tài liệu và trích dẫn phương án</h3>
        <p className="text-sm text-muted-foreground">
          Tài liệu dùng chung cho phương án; trích dẫn theo đúng phiên bản và tiêu chí đang chọn.
        </p>
      </div>
      {documentState.isReadOnly ? (
        <Chip color="warning" size="sm" variant="soft">
          Chỉ đọc
        </Chip>
      ) : selectedDocumentId ? (
        <button
          type="button"
          className="text-sm font-medium text-primary hover:underline disabled:text-muted-foreground"
          disabled={hasStaleDocuments || documentState.isSaving}
          onClick={resetDraft}
        >
          Tạo tài liệu mới
        </button>
      ) : null}
    </div>
  )

  if (hasInitialDocumentsError) {
    return (
      <section aria-label="Tài liệu và trích dẫn phương án" className="space-y-5 border-t pt-5">
        {header}
        <TechnicalConfigurationDocumentsQueryError
          isInitialLoad
          isRetrying={documentState.documentsQuery.isFetching}
          onRetry={() => void documentState.documentsQuery.refetch()}
        />
      </section>
    )
  }

  return (
    <section aria-label="Tài liệu và trích dẫn phương án" className="space-y-5 border-t pt-5">
      {header}
      {hasStaleDocuments ? (
        <TechnicalConfigurationDocumentsQueryError
          isInitialLoad={false}
          isRetrying={documentState.documentsQuery.isFetching}
          onRetry={() => void documentState.documentsQuery.refetch()}
        />
      ) : null}

      {documentState.documents.length > 0 ? (
        <Select
          className="max-w-md"
          selectedKey={selectedDocumentId}
          onSelectionChange={(key) => selectDocument(String(key))}
          isDisabled={controlsDisabled || documentState.isSaving}
          placeholder="Chọn tài liệu"
          aria-label="Tài liệu phương án đang chỉnh sửa"
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {documentState.documents.map((document) => (
                <ListBox.Item key={document.id} id={document.id} textValue={document.name}>
                  {document.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      ) : null}

      {selectedDocumentMissing ? (
        <p role="alert" className="text-sm text-destructive">
          Tài liệu đang chỉnh sửa không còn trong danh sách. Chọn tài liệu khác hoặc tạo tài liệu
          mới.
        </p>
      ) : null}

      <UrlDocumentForm
        name={name}
        url={url}
        onNameChange={setName}
        onUrlChange={setUrl}
        onSubmit={handleSubmit}
        isPending={documentState.isSaving}
        disabled={controlsDisabled || selectedDocumentMissing}
        validationError={validationError}
        submitLabel={selectedDocumentId ? "Lưu thay đổi" : "Thêm tài liệu"}
      />

      {documentState.mutationError ? (
        <p role="alert" className="text-sm text-destructive">
          {documentState.isConflict
            ? "Hồ sơ đã thay đổi trên máy chủ. Nội dung đang nhập được giữ lại để thử lại."
            : "Không thể lưu thay đổi tài liệu. Vui lòng thử lại."}
        </p>
      ) : null}

      <UrlDocumentList
        items={documentState.documents}
        isLoading={documentState.documentsQuery.isLoading}
        onDelete={controlsDisabled ? undefined : requestDelete}
        disabled={documentState.isSaving || hasStaleDocuments}
      />

      <TechnicalConfigurationCitationEditor
        documents={documentState.documents}
        criteria={criteria}
        fixedCriterionId={criterionId}
        isPending={documentState.isSaving}
        disabled={controlsDisabled}
        onSave={documentState.upsertCitation}
        onDelete={documentState.deleteCitation}
        onDirtyChange={setCitationDirty}
      />

      {discardConfirmationDialog}
      <TechnicalConfigurationDocumentDeleteDialog
        document={pendingDeleteDocument}
        affectedCitationCount={pendingDeleteDocument?.affected_citation_count}
        deleteError={deleteError}
        isSaving={documentState.isSaving}
        onDismiss={() => {
          setDeleteError(null)
          setPendingDeleteDocument(null)
        }}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  )
}
