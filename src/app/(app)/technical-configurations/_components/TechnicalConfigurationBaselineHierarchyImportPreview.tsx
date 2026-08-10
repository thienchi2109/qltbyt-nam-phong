"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import type {
  TechnicalConfigurationBaselineHierarchyImportEffectCounts,
  TechnicalConfigurationBaselineHierarchyImportPreviewRow,
  TechnicalConfigurationBaselineHierarchyImportPreviewWireResponse,
} from "../technical-configuration-baseline-hierarchy-import-types"
import { formatTechnicalConfigurationBaselineHierarchyImportPreviewError } from "../technical-configuration-baseline-hierarchy-import"
import { BulkImportValidationErrors } from "@/components/bulk-import"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const PREVIEW_PAGE_SIZE = 100

function getRowLabel(row: TechnicalConfigurationBaselineHierarchyImportPreviewRow): string {
  if (row.row_type === "GROUP") return "Mục chính"
  if (row.row_type === "SUBGROUP") return "Nhóm con"
  return "Tiêu chí"
}

function getRowContent(row: TechnicalConfigurationBaselineHierarchyImportPreviewRow) {
  if (row.row_type === "GROUP") return row.group_name
  if (row.row_type === "SUBGROUP") return row.subgroup_name
  return (
    <div className="space-y-1">
      {row.existing_title ? <p className="font-medium">{row.existing_title}</p> : null}
      <p>{row.requirement_text}</p>
    </div>
  )
}

function EffectCells({
  effects,
}: Readonly<{
  effects: TechnicalConfigurationBaselineHierarchyImportEffectCounts
}>) {
  return (
    <>
      <TableCell>{effects.create}</TableCell>
      <TableCell>{effects.update}</TableCell>
      <TableCell>{effects.move}</TableCell>
      <TableCell>{effects.delete}</TableCell>
    </>
  )
}

/** Renders only the normalized hierarchy and effects returned by the authoritative server preview. */
export function TechnicalConfigurationBaselineHierarchyImportPreview({
  preview,
}: Readonly<{
  preview: TechnicalConfigurationBaselineHierarchyImportPreviewWireResponse
}>) {
  const { counts, effects, rows } = preview.data
  const [pageIndex, setPageIndex] = useState(0)
  const pageCount = Math.max(1, Math.ceil(rows.length / PREVIEW_PAGE_SIZE))
  const currentPageIndex = Math.min(pageIndex, pageCount - 1)
  const visibleRows = rows.slice(
    currentPageIndex * PREVIEW_PAGE_SIZE,
    (currentPageIndex + 1) * PREVIEW_PAGE_SIZE
  )

  return (
    <section aria-label="Bản xem trước cấu hình phân cấp" className="space-y-4 border-t pt-4">
      <div>
        <h3 className="text-sm font-semibold">Bản xem trước authoritative từ máy chủ</h3>
        <p className="text-sm text-muted-foreground">
          Kiểm tra toàn bộ cây và tác động thay thế trước khi xác nhận.
        </p>
      </div>

      <section aria-label="Số lượng cấu hình phân cấp">
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Mục chính</dt>
            <dd className="font-semibold">{counts.groups}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Nhóm con</dt>
            <dd className="font-semibold">{counts.subgroups}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tiêu chí</dt>
            <dd className="font-semibold">{counts.criteria}</dd>
          </div>
        </dl>
      </section>

      {effects ? (
        <section aria-label="Tác động thay thế cấu hình" className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loại</TableHead>
                <TableHead>Tạo</TableHead>
                <TableHead>Cập nhật</TableHead>
                <TableHead>Di chuyển</TableHead>
                <TableHead>Xóa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Mục chính</TableCell>
                <EffectCells effects={effects.groups} />
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Nhóm con</TableCell>
                <EffectCells effects={effects.subgroups} />
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Tiêu chí</TableCell>
                <EffectCells effects={effects.criteria} />
              </TableRow>
            </TableBody>
          </Table>
        </section>
      ) : null}

      <div
        role="alert"
        aria-label="Lỗi bản xem trước cấu hình phân cấp"
        aria-live="assertive"
        aria-atomic="true"
      >
        <BulkImportValidationErrors
          errors={preview.errors.map(
            formatTechnicalConfigurationBaselineHierarchyImportPreviewError
          )}
          maxHeight="8rem"
        />
      </div>

      <div className="max-h-[42vh] overflow-auto border-y">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Dòng</TableHead>
              <TableHead className="w-28">Loại</TableHead>
              <TableHead className="w-28">Mã</TableHead>
              <TableHead>Nội dung</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={`${row.row}-${row.row_type}`}>
                <TableCell>{row.row}</TableCell>
                <TableCell>{getRowLabel(row)}</TableCell>
                <TableCell className="font-mono text-xs">
                  {row.row_type === "CRITERION" ? row.criterion_code : "—"}
                </TableCell>
                <TableCell className="min-w-64 whitespace-pre-wrap">{getRowContent(row)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Trang trước"
          disabled={currentPageIndex === 0}
          onClick={() => setPageIndex(Math.max(0, currentPageIndex - 1))}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <p
          role="status"
          aria-live="polite"
          className="min-w-24 text-center text-sm text-muted-foreground"
        >
          Trang {currentPageIndex + 1} / {pageCount}
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Trang sau"
          disabled={currentPageIndex >= pageCount - 1}
          onClick={() => setPageIndex(Math.min(pageCount - 1, currentPageIndex + 1))}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </section>
  )
}
