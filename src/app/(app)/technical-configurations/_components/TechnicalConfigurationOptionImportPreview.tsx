import type { TechnicalConfigurationOptionImportPreviewWireResponse } from "../supplier-option-types"

/** Renders the authoritative full-snapshot preview without exposing editable controls. */
export function TechnicalConfigurationOptionImportPreview({
  preview,
  isStale,
}: Readonly<{
  preview: TechnicalConfigurationOptionImportPreviewWireResponse
  isStale: boolean
}>) {
  const clearedRowCount = preview.data.rows.filter(
    (row) => !row.response_text && !row.supplementary_information
  ).length

  return (
    <section aria-label="Bản xem trước import" className="space-y-3 border-y py-4 text-sm">
      <div>
        <p className="font-medium">Bản xem trước toàn bộ {preview.data.rows.length} dòng</p>
        <p className="mt-1 text-muted-foreground">
          {clearedRowCount} dòng trống hoàn toàn sẽ xóa phản hồi đã lưu sau khi xác nhận.
        </p>
        {isStale ? (
          <p className="mt-2 text-destructive">
            Bản xem trước đang được xác thực lại theo revision mới.
          </p>
        ) : null}
      </div>

      <div className="max-h-80 overflow-y-auto border-y">
        <ol className="divide-y">
          {preview.data.rows.map((row) => (
            <li key={row.criterion_id} className="space-y-3 py-3">
              <div>
                <p className="font-medium">{row.criterion_code}</p>
                <p className="text-muted-foreground">
                  {row.criterion_title ?? row.requirement_text}
                </p>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Phản hồi</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words">
                    {row.response_text || (
                      <span className="text-destructive">Xóa phản hồi đã lưu</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Thông tin bổ sung</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words">
                    {row.supplementary_information || (
                      <span className="text-destructive">Xóa thông tin bổ sung</span>
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
