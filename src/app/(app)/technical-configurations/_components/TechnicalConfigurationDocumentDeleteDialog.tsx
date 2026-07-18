"use client"

import { AlertDialog, Button } from "@heroui/react"

import type { TechnicalConfigurationDocumentWire } from "@/app/(app)/technical-configurations/document-types"

interface TechnicalConfigurationDocumentDeleteDialogProps {
  document: TechnicalConfigurationDocumentWire | null
  deleteError: unknown
  isSaving: boolean
  onDismiss: () => void
  onConfirm: () => void
}

/** Confirms destructive evidence-document deletion and keeps mutation failures in context. */
export function TechnicalConfigurationDocumentDeleteDialog({
  document,
  deleteError,
  isSaving,
  onDismiss,
  onConfirm,
}: Readonly<TechnicalConfigurationDocumentDeleteDialogProps>): React.JSX.Element {
  return (
    <AlertDialog
      isOpen={document !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isSaving) onDismiss()
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
                Tài liệu <strong>{document?.name}</strong>
                {document?.citations.length
                  ? ` đang có ${document.citations.length} trích dẫn liên kết.`
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
              <Button variant="tertiary" isDisabled={isSaving} onPress={onDismiss}>
                Hủy
              </Button>
              <Button variant="danger" isPending={isSaving} onPress={onConfirm}>
                Xóa tài liệu
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
