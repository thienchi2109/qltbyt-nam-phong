/**
 * Files tab for equipment detail dialog
 * Manages file attachments: add, delete, and list
 * @module equipment/_components/EquipmentDetailDialog/EquipmentDetailFilesTab
 */

"use client"

import * as React from "react"
import { AlertCircle, ExternalLink } from "lucide-react"

import type { Attachment } from "@/app/(app)/equipment/types"
import { UrlDocumentForm } from "@/components/url-documents/UrlDocumentForm"
import { UrlDocumentList } from "@/components/url-documents/UrlDocumentList"
import {
  isAllowedDocumentUrl,
  parseAbsoluteUrl,
} from "@/components/url-documents/url-document-utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

export interface EquipmentDetailFilesTabProps {
  /** List of attachments to display */
  attachments: Attachment[]
  /** Whether attachments are loading */
  isLoading: boolean
  /** Optional Google Drive folder URL for the equipment */
  googleDriveFolderUrl?: string | null
  /** Add attachment function from useEquipmentAttachments hook */
  onAddAttachment: (params: { name: string; url: string }) => Promise<void>
  /** Delete attachment function from useEquipmentAttachments hook */
  onDeleteAttachment: (attachmentId: string) => Promise<void>
  /** Whether an add operation is in progress */
  isAdding: boolean
  /** Whether a delete operation is in progress */
  isDeleting: boolean
}

/** Renders equipment attachment management through shared URL document primitives. */
export function EquipmentDetailFilesTab({
  attachments,
  isLoading,
  googleDriveFolderUrl,
  onAddAttachment,
  onDeleteAttachment,
  isAdding,
  isDeleting,
}: EquipmentDetailFilesTabProps) {
  const { toast } = useToast()

  // Local state for form inputs
  const [newFileName, setNewFileName] = React.useState("")
  const [newFileUrl, setNewFileUrl] = React.useState("")
  const [deletingAttachmentId, setDeletingAttachmentId] = React.useState<string | null>(null)

  const handleAddAttachment = async () => {
    if (!newFileName || !newFileUrl) return

    const parsedUrl = parseAbsoluteUrl(newFileUrl)
    if (!isAllowedDocumentUrl(parsedUrl)) {
      toast({
        variant: "destructive",
        title: "URL không hợp lệ",
        description: "Vui lòng nhập một đường dẫn URL hợp lệ.",
      })
      return
    }

    try {
      await onAddAttachment({ name: newFileName, url: parsedUrl.raw })
      // Only clear inputs on success - allows retry on error
      setNewFileName("")
      setNewFileUrl("")
    } catch {
      // Error already handled via toast in useEquipmentAttachments hook
      // Catch here to prevent unhandled rejection warning
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (deletingAttachmentId) return
    if (!confirm("Bạn có chắc chắn muốn xóa file đính kèm này không?")) return
    setDeletingAttachmentId(attachmentId)
    try {
      await onDeleteAttachment(attachmentId)
    } catch {
      // Error already handled via toast in useEquipmentAttachments hook
      // Catch here to prevent unhandled rejection warning
    } finally {
      setDeletingAttachmentId(null)
    }
  }

  const documentItems = attachments.map((file) => ({
    id: file.id,
    name: file.ten_file,
    url: file.duong_dan_luu_tru,
  }))
  const parsedGoogleDriveFolderUrl = googleDriveFolderUrl
    ? parseAbsoluteUrl(googleDriveFolderUrl)
    : null
  const canOpenGoogleDriveFolder = isAllowedDocumentUrl(parsedGoogleDriveFolderUrl)

  return (
    <div className="h-full flex flex-col gap-4 py-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Thêm file đính kèm mới</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <UrlDocumentForm
            name={newFileName}
            url={newFileUrl}
            onNameChange={setNewFileName}
            onUrlChange={setNewFileUrl}
            onSubmit={handleAddAttachment}
            isPending={isAdding}
            submitLabel="Lưu liên kết"
          />
          <Alert>
            <AlertCircle className="size-4" />
            <AlertTitle>Làm thế nào để lấy URL?</AlertTitle>
            <AlertDescription className="space-y-2">
              <div>
                Tải file của bạn lên thư mục Drive chia sẻ của đơn vị, sau đó lấy link chia sẻ công
                khai và dán vào đây.
              </div>
              {canOpenGoogleDriveFolder ? (
                <Button type="button" variant="outline" size="sm" asChild className="mt-2">
                  <a
                    href={parsedGoogleDriveFolderUrl.raw}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2"
                  >
                    <ExternalLink className="size-4" />
                    Mở thư mục chung
                  </a>
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
      <div className="flex-grow overflow-hidden">
        <p className="font-medium mb-2">Danh sách file đã đính kèm</p>
        <UrlDocumentList
          items={documentItems}
          isLoading={isLoading}
          onDelete={handleDeleteAttachment}
          deletingId={deletingAttachmentId}
          disabled={isDeleting}
          emptyMessage="Chưa có file nào được đính kèm."
        />
      </div>
    </div>
  )
}
