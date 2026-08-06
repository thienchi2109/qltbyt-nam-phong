import { FileText } from "lucide-react"

import { DataTablePagination } from "@/components/shared/DataTablePagination"
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

import type {
  TechnicalConfigurationDossierListItemWire,
  TechnicalConfigurationDossierWire,
} from "@/app/(app)/technical-configurations/types"
import { TechnicalConfigurationDossierRowActions } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationDossierRowActions"

type TechnicalConfigurationDossierPagination = {
  page: number
  pageCount: number
  canPreviousPage: boolean
  canNextPage: boolean
  onPageChange: (page: number) => void
}

type TechnicalConfigurationDossierTableProps = {
  dossiers: TechnicalConfigurationDossierListItemWire[]
  isLoading: boolean
  isActionPending: boolean
  openingDossierId: string | null
  pagination: TechnicalConfigurationDossierPagination
  onDelete: (dossier: TechnicalConfigurationDossierListItemWire) => void
  onEdit: (dossier: TechnicalConfigurationDossierWire) => void
  onOpen: (id: string) => void
}

/** Renders the paginated dossier list and open actions. */
export function TechnicalConfigurationDossierTable({
  dossiers,
  isLoading,
  isActionPending,
  openingDossierId,
  pagination,
  onDelete,
  onEdit,
  onOpen,
}: Readonly<TechnicalConfigurationDossierTableProps>) {
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
              <TableHead className="w-36 text-right">Thao tác</TableHead>
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
                    <TechnicalConfigurationDossierRowActions
                      dossier={dossier}
                      disabled={openingDossierId !== null || isActionPending}
                      isOpening={isOpening}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onOpen={onOpen}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {pagination.pageCount > 1 ? (
        <DataTablePagination.Navigation
          currentPage={pagination.page}
          totalPages={pagination.pageCount}
          canPreviousPage={pagination.canPreviousPage}
          canNextPage={pagination.canNextPage}
          onFirstPage={() => pagination.onPageChange(1)}
          onPreviousPage={() => pagination.onPageChange(pagination.page - 1)}
          onNextPage={() => pagination.onPageChange(pagination.page + 1)}
          onLastPage={() => pagination.onPageChange(pagination.pageCount)}
          className="sm:justify-between"
        />
      ) : null}
    </div>
  )
}
