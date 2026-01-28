/**
 * Files tab for equipment detail dialog
 * Manages file attachments: add, delete, and list
 * @module equipment/_components/EquipmentDetailDialog/EquipmentDetailFilesTab
 */

"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  Trash2,
} from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Attachment } from "@/app/(app)/equipment/types"

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

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFileName || !newFileUrl) return

    try {
      new URL(newFileUrl)
    } catch (_) {
      toast({
        variant: "destructive",
        title: "URL không hợp lệ",
        description: "Vui lòng nhập một đường dẫn URL hợp lệ.",
      })
      return
    }

    try {
      await onAddAttachment({ name: newFileName, url: newFileUrl })
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
    } finally {
      setDeletingAttachmentId(null)
    }
  }

  return (
    <div className="h-full flex flex-col gap-4 py-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Thêm file đính kèm mới</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddAttachment} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="file-name">Tên file</Label>
              <Input
                id="file-name"
                placeholder="VD: Giấy chứng nhận hiệu chuẩn"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                required
                disabled={isAdding}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="file-url">Đường dẫn (URL)</Label>
              <Input
                id="file-url"
                type="url"
                placeholder="https://..."
                value={newFileUrl}
                onChange={(e) => setNewFileUrl(e.target.value)}
                required
                disabled={isAdding}
              />
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Làm thế nào để lấy URL?</AlertTitle>
              <AlertDescription className="space-y-2">
                <div>
                  Tải file của bạn lên thư mục Drive chia sẻ của đơn vị, sau đó lấy link chia sẻ
                  công khai và dán vào đây.
                </div>
                {googleDriveFolderUrl && (
                  <Button type="button" variant="outline" size="sm" asChild className="mt-2">
                    <a
                      href={googleDriveFolderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Mở thư mục chung
                    </a>
                  </Button>
                )}
              </AlertDescription>
            </Alert>
            <Button
              type="submit"
              disabled={isAdding || !newFileName || !newFileUrl}
            >
              {isAdding && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Lưu liên kết
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="flex-grow overflow-hidden">
        <p className="font-medium mb-2">Danh sách file đã đính kèm</p>
        <ScrollArea className="h-full pr-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              Chưa có file nào được đính kèm.
            </p>
          ) : (
            <div className="space-y-2">
              {attachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2 border rounded-md bg-muted/50"
                >
                  <Link
                    href={file.duong_dan_luu_tru}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline truncate"
                  >
                    <LinkIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{file.ten_file}</span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteAttachment(file.id)}
                    disabled={!!deletingAttachmentId || isDeleting}
                  >
                    {deletingAttachmentId === file.id || isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
