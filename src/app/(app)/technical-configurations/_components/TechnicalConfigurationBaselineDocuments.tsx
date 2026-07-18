"use client"

import * as React from "react"
import { ListBox, Select } from "@heroui/react"

import { TechnicalConfigurationCitationEditor } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationCitationEditor"
import { TechnicalConfigurationDocumentDeleteDialog } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationDocumentDeleteDialog"
import { TechnicalConfigurationDocumentsHeader } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationDocumentsHeader"
import { TechnicalConfigurationDocumentsQueryError } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationDocumentsQueryError"
import { useTechnicalConfigurationDocumentDraft } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDocumentDraft"
import { useTechnicalConfigurationDocuments } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDocuments"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import type { TechnicalConfigurationDocumentWire } from "@/app/(app)/technical-configurations/document-types"
import { UrlDocumentForm } from "@/components/url-documents/UrlDocumentForm"
import { UrlDocumentList } from "@/components/url-documents/UrlDocumentList"
import {
  isAllowedDocumentUrl,
  parseAbsoluteUrl,
} from "@/components/url-documents/url-document-utils"

export type TechnicalConfigurationEvidenceOwnerType = "baseline" | "reference_product"

interface TechnicalConfigurationBaselineDocumentsProps {
  baselineVersion: TechnicalConfigurationBaselineDraftWire
  ownerType: TechnicalConfigurationEvidenceOwnerType
  ownerId: string
  criterionId?: string | null
  readOnly?: boolean
  onRevisionChange?: (revision: number) => void
  onDirtyChange?: (dirty: boolean) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
}

/** Renders evidence-document controls for one baseline or reference-product owner. */
export function TechnicalConfigurationBaselineDocuments({
  baselineVersion,
  ownerType,
  ownerId,
  criterionId = null,
  readOnly = false,
  onRevisionChange,
  onDirtyChange,
  onNavigationBlockedChange,
}: Readonly<TechnicalConfigurationBaselineDocumentsProps>): React.JSX.Element {
  const [citationDirty, setCitationDirty] = React.useState(false)
  const [pendingDeleteDocument, setPendingDeleteDocument] =
    React.useState<TechnicalConfigurationDocumentWire | null>(null)
  const [deleteError, setDeleteError] = React.useState<unknown>(null)
  const documentState = useTechnicalConfigurationDocuments({
    baselineVersion,
    readOnly,
    onRevisionChange,
    onNavigationBlockedChange,
  })
  const ownerDocuments = documentState.getDocumentsForOwner(ownerType, ownerId)
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
  } = useTechnicalConfigurationDocumentDraft(ownerDocuments)
  const hasInitialDocumentsError =
    documentState.documentsQuery.isError && documentState.documentsQuery.data === undefined
  const hasStaleDocuments =
    documentState.documentsQuery.isError && documentState.documentsQuery.data !== undefined
  const controlsDisabled = documentState.isReadOnly || hasStaleDocuments
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

  const confirmDocumentChange = React.useCallback(
    () =>
      !documentDirty ||
      window.confirm("Chuyển tài liệu sẽ bỏ nội dung tài liệu chưa lưu. Tiếp tục?"),
    [documentDirty]
  )

  const resetDraft = React.useCallback(() => {
    if (!confirmDocumentChange()) return
    clearDraft()
  }, [clearDraft, confirmDocumentChange])

  const selectDocument = React.useCallback(
    (documentId: string) => {
      if (documentId === selectedDocumentId || !confirmDocumentChange()) return
      const document = ownerDocuments.find((item) => item.id === documentId)
      if (!document) return
      adoptSelectedDocument(document)
    },
    [adoptSelectedDocument, confirmDocumentChange, ownerDocuments, selectedDocumentId]
  )

  const handleSubmit = React.useCallback(async () => {
    const acceptedUrl = parseAbsoluteUrl(url)
    if (selectedDocumentMissing || !name || !isAllowedDocumentUrl(acceptedUrl)) return

    try {
      if (selectedDocument) {
        await documentState.updateDocument({
          document: selectedDocument,
          name,
          url,
        })
      } else {
        await documentState.createDocument({
          ownerType,
          ownerId,
          name,
          url,
        })
      }
      clearDraft()
    } catch {
      // Mutation state owns the rendered error while the controlled draft stays intact.
    }
  }, [
    clearDraft,
    documentState,
    name,
    ownerId,
    ownerType,
    selectedDocument,
    selectedDocumentMissing,
    url,
  ])

  const requestDelete = React.useCallback(
    (documentId: string) => {
      const document = ownerDocuments.find((item) => item.id === documentId)
      if (!document || documentState.isReadOnly) return
      setDeleteError(null)
      setPendingDeleteDocument(document)
    },
    [documentState.isReadOnly, ownerDocuments]
  )

  const confirmDelete = React.useCallback(async () => {
    if (!pendingDeleteDocument || documentState.isReadOnly) return
    setDeleteError(null)
    try {
      await documentState.deleteDocument(pendingDeleteDocument)
      if (selectedDocumentId === pendingDeleteDocument.id) clearDraft()
      setPendingDeleteDocument(null)
    } catch (error) {
      setDeleteError(error)
    }
  }, [clearDraft, documentState, pendingDeleteDocument, selectedDocumentId])

  const header = (
    <TechnicalConfigurationDocumentsHeader
      ownerType={ownerType}
      isReadOnly={documentState.isReadOnly}
      hasSelectedDocument={selectedDocumentId !== null}
      isCreateDisabled={hasStaleDocuments}
      onCreateNew={resetDraft}
    />
  )

  if (hasInitialDocumentsError) {
    return (
      <section aria-label="Tài liệu và trích dẫn" className="space-y-5">
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
    <section aria-label="Tài liệu và trích dẫn" className="space-y-5">
      {header}

      {hasStaleDocuments ? (
        <TechnicalConfigurationDocumentsQueryError
          isInitialLoad={false}
          isRetrying={documentState.documentsQuery.isFetching}
          onRetry={() => void documentState.documentsQuery.refetch()}
        />
      ) : null}

      {ownerDocuments.length > 0 ? (
        <Select
          className="max-w-md"
          selectedKey={selectedDocumentId}
          onSelectionChange={(key) => selectDocument(String(key))}
          isDisabled={controlsDisabled || documentState.isSaving}
          placeholder="Chọn tài liệu"
          aria-label="Tài liệu đang chỉnh sửa"
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {ownerDocuments.map((document) => (
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
            ? "Phiên bản đã thay đổi trên máy chủ. Nội dung đang nhập được giữ lại để thử lại."
            : "Không thể lưu thay đổi tài liệu. Vui lòng thử lại."}
        </p>
      ) : null}

      <UrlDocumentList
        items={ownerDocuments}
        isLoading={documentState.documentsQuery.isLoading}
        onDelete={controlsDisabled ? undefined : requestDelete}
        disabled={documentState.isSaving || hasStaleDocuments}
      />

      <TechnicalConfigurationCitationEditor
        documents={ownerDocuments}
        criteria={criteria}
        fixedCriterionId={criterionId}
        isPending={documentState.isSaving}
        disabled={controlsDisabled}
        onSave={documentState.upsertCitation}
        onDelete={documentState.deleteCitation}
        onDirtyChange={setCitationDirty}
      />

      <TechnicalConfigurationDocumentDeleteDialog
        document={pendingDeleteDocument}
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
