import { Badge } from "@/components/ui/badge"

type TechnicalConfigurationBaselineHierarchySummaryProps = Readonly<{
  criterionCount: number
  errorCount: number
  hasPendingBulkInput?: boolean
}>

/** Summarizes criterion count, validation errors, and pending bulk input for a hierarchy node. */
export function TechnicalConfigurationBaselineHierarchySummary({
  criterionCount,
  errorCount,
  hasPendingBulkInput = false,
}: TechnicalConfigurationBaselineHierarchySummaryProps): React.JSX.Element {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Badge variant="secondary">{criterionCount} tiêu chí</Badge>
      {errorCount > 0 ? <Badge variant="destructive">{errorCount} lỗi</Badge> : null}
      {hasPendingBulkInput ? <Badge variant="outline">Có nội dung nhập nhiều dòng</Badge> : null}
    </div>
  )
}
