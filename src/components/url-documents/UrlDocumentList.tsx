"use client"

import { ExternalLink, Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

import { isAllowedDocumentUrl, parseAbsoluteUrl } from "./url-document-utils"

export interface UrlDocumentItem {
  id: string
  name: string
  url: string
}

export interface UrlDocumentListProps {
  items: readonly UrlDocumentItem[]
  isLoading: boolean
  onDelete?: (id: string) => void
  deletingId?: string | null
  disabled?: boolean
  emptyMessage?: string
}

/** Renders loading, empty, and URL-document rows with optional controlled delete actions. */
export function UrlDocumentList({
  items,
  isLoading,
  onDelete,
  deletingId = null,
  disabled = false,
  emptyMessage = "Chưa có tài liệu nào.",
}: UrlDocumentListProps) {
  if (isLoading) {
    return (
      <ScrollArea className="h-full pr-4">
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </ScrollArea>
    )
  }

  if (items.length === 0) {
    return (
      <ScrollArea className="h-full pr-4">
        <p className="py-4 text-center text-sm italic text-muted-foreground">{emptyMessage}</p>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-2">
        {items.map((item) => {
          const parsed = parseAbsoluteUrl(item.url)
          const linkAllowed = isAllowedDocumentUrl(parsed)
          const itemDeleting = deletingId === item.id

          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/50 p-2"
            >
              {linkAllowed ? (
                <a
                  href={parsed.raw}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-2 truncate text-primary hover:underline"
                >
                  <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </a>
              ) : (
                <span className="min-w-0 truncate">{item.name}</span>
              )}

              {onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-destructive hover:bg-destructive/10"
                  aria-label={itemDeleting ? `Đang xóa ${item.name}` : `Xóa ${item.name}`}
                  disabled={disabled || deletingId !== null}
                  onClick={() => onDelete(item.id)}
                >
                  {itemDeleting ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <Trash2 aria-hidden="true" className="size-4" />
                  )}
                </Button>
              ) : null}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
