import type {
  TechnicalConfigurationBaselineImportPreviewError,
  TechnicalConfigurationBaselineImportPreviewWireResponse,
} from "@/app/(app)/technical-configurations/baseline-types"
import { BulkImportValidationErrors } from "@/components/bulk-import"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function formatPreviewError(error: TechnicalConfigurationBaselineImportPreviewError): string {
  const column = error.column ? ` · ${error.column}` : ""
  return `Dòng ${error.row}${column}: ${error.message}`
}

/** Renders the authoritative server preview before any baseline mutation. */
export function TechnicalConfigurationBaselineImportPreview({
  preview,
}: Readonly<{
  preview: TechnicalConfigurationBaselineImportPreviewWireResponse
}>) {
  return (
    <section
      role="region"
      aria-label="Xem trước cấu hình cơ sở"
      className="space-y-3 border-t pt-4"
    >
      <div>
        <h3 className="text-sm font-semibold">Bản xem trước từ máy chủ</h3>
        <p className="text-sm text-muted-foreground">
          Kiểm tra mã dự kiến và lỗi theo dòng trước khi áp dụng.
        </p>
      </div>

      <div
        role="alert"
        aria-label="Lỗi xem trước cấu hình cơ sở"
        aria-live="assertive"
        aria-atomic="true"
      >
        <BulkImportValidationErrors
          errors={preview.errors.map(formatPreviewError)}
          maxHeight="8rem"
        />
      </div>

      <div className="max-h-[42vh] overflow-auto border-y">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Dòng</TableHead>
              <TableHead className="w-28">Loại</TableHead>
              <TableHead className="w-32">Mã</TableHead>
              <TableHead>Nội dung</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.data.rows.map((row, index) => (
              <TableRow key={`${row.row_type}-${row.group_order}-${row.criterion_order ?? 0}`}>
                <TableCell>{index + 2}</TableCell>
                <TableCell>{row.row_type === "GROUP" ? "Nhóm" : "Tiêu chí"}</TableCell>
                <TableCell className="font-mono text-xs">
                  {row.row_type === "CRITERION" ? row.criterion_code : "—"}
                </TableCell>
                <TableCell className="min-w-64 whitespace-pre-wrap">
                  {row.row_type === "GROUP" ? (
                    row.group_name
                  ) : (
                    <div className="space-y-1">
                      {row.criterion_title ? (
                        <p className="font-medium">{row.criterion_title}</p>
                      ) : null}
                      <p>{row.requirement_text}</p>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
