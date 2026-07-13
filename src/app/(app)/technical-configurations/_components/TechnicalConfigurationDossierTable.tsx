import { ArrowRight, ChevronLeft, ChevronRight, FileText, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatVietnamDateTime } from "@/lib/vietnam-date-format"

import type { TechnicalConfigurationDossierWire } from "../types"

type TechnicalConfigurationDossierTableProps = {
  dossiers: TechnicalConfigurationDossierWire[]
  isLoading: boolean
  openingDossierId: string | null
  page: number
  pageSize: number
  total: number
  onOpen: (id: string) => void
  onPageChange: (page: number) => void
}

/** Renders the paginated dossier list and open actions. */
export function TechnicalConfigurationDossierTable({
  dossiers,
  isLoading,
  openingDossierId,
  page,
  pageSize,
  total,
  onOpen,
  onPageChange,
}: Readonly<TechnicalConfigurationDossierTableProps>) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  if (isLoading) {
    return (
      <div className="space-y-3" aria-label="Đang tải hồ sơ cấu hình">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (dossiers.length === 0) {
    return (
      <div className="border-y py-12 text-center">
        <FileText className="mx-auto size-9 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-4 text-base font-semibold">Chưa có hồ sơ cấu hình</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tạo hồ sơ đầu tiên để bắt đầu không gian làm việc.
        </p>
        {page > 1 ? (
          <Button
            type="button"
            variant="outline"
            className="mt-5"
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Quay lại trang trước
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-md border">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>Hồ sơ</TableHead>
              <TableHead>Loại thiết bị</TableHead>
              <TableHead>Cập nhật</TableHead>
              <TableHead className="w-24 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dossiers.map((dossier) => {
              const isOpening = openingDossierId === dossier.id

              return (
                <TableRow key={dossier.id}>
                  <TableCell className="max-w-[320px]">
                    <div className="font-medium text-foreground">{dossier.name}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {dossier.description || "Không có mô tả"}
                    </div>
                  </TableCell>
                  <TableCell>{dossier.device_type_name}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatVietnamDateTime(dossier.updated_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={openingDossierId !== null}
                      aria-label={`Mở ${dossier.name}`}
                      onClick={() => onOpen(dossier.id)}
                    >
                      {isOpening ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <ArrowRight className="size-4" aria-hidden="true" />
                      )}
                      Mở
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Trang {page} / {pageCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Trang trước"
              title="Trang trước"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Trang sau"
              title="Trang sau"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
