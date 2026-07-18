"use client"

import * as React from "react"
import { AlertDialog, Button, ListBox, Select } from "@heroui/react"

import { TechnicalConfigurationCitationEditor } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationCitationEditor"
import { TechnicalConfigurationDocumentsHeader } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationDocumentsHeader"
import { TechnicalConfigurationDocumentsQueryError } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationDocumentsQueryError"
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

type TechnicalConfigurationBaselineDocumentsProps = {
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
}: Readonly<TechnicalConfigurationBaselineDocumentsProps>) {
  const [name, setName] = React.useState("")
  const [url, setUrl] = React.useState("")
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string | null>(null)
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
  const selectedDocument =
    ownerDocuments.find((document) => document.id === selectedDocumentId) ?? null
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
  const documentDirty =
    selectedDocument === null
      ? Boolean(name || url)
      : name !== selectedDocument.name || url !== selectedDocument.url
  const isDirty = documentDirty || citationDirty

  React.useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const clearDraft = React.useCallback(() => {
    setSelectedDocumentId(null)
    setName("")
    setUrl("")
  }, [])

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
      setSelectedDocumentId(document.id)
      setName(document.name)
      setUrl(document.url)
    },
    [confirmDocumentChange, ownerDocuments, selectedDocumentId]
  )

  const handleSubmit = React.useCallback(async () => {
    const acceptedUrl = parseAbsoluteUrl(url)
    if (!name || !isAllowedDocumentUrl(acceptedUrl)) return

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
  }, [clearDraft, documentState, name, ownerId, ownerType, selectedDocument, url])

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
      hasSelectedDocument={selectedDocument !== null}
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

      <UrlDocumentForm
        name={name}
        url={url}
        onNameChange={setName}
        onUrlChange={setUrl}
        onSubmit={handleSubmit}
        isPending={documentState.isSaving}
        disabled={controlsDisabled}
        validationError={validationError}
        submitLabel={selectedDocument ? "Lưu thay đổi" : "Thêm tài liệu"}
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

      <AlertDialog
        isOpen={pendingDeleteDocument !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !documentState.isSaving) {
            setDeleteError(null)
            setPendingDeleteDocument(null)
          }
        }}
      >
        <Button className="hidden" aria-hidden="true">
          Mở xác nhận xóa
        </Button>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-md">
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>Xóa tài liệu?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  Tài liệu <strong>{pendingDeleteDocument?.name}</strong>
                  {pendingDeleteDocument?.citations.length
                    ? ` đang có ${pendingDeleteDocument.citations.length} trích dẫn liên kết.`
                    : " chưa có trích dẫn liên kết."}{" "}
                  Hành động này không thể hoàn tác.
                </p>
                {deleteError ? (
                  <p role="alert" className="mt-3 text-sm text-destructive">
                    Không thể xóa tài liệu. Vui lòng thử lại.
                  </p>
                ) : null}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  variant="tertiary"
                  isDisabled={documentState.isSaving}
                  onPress={() => {
                    setDeleteError(null)
                    setPendingDeleteDocument(null)
                  }}
                >
                  Hủy
                </Button>
                <Button
                  variant="danger"
                  isPending={documentState.isSaving}
                  onPress={() => void confirmDelete()}
                >
                  Xóa tài liệu
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </section>
  )
}
