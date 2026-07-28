"use client"

import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"

import type {
  TechnicalConfigurationComparisonEvidence,
  TechnicalConfigurationComparisonOptionValue,
  TechnicalConfigurationComparisonResult,
} from "../../comparison-types"
import type { TechnicalConfigurationCriterionDetail } from "./TechnicalConfigurationCriterionPanel"
import { Button } from "@/components/ui/button"

type TechnicalConfigurationMatrixProps = {
  hasRequest: boolean
  result?: TechnicalConfigurationComparisonResult
  isLoading?: boolean
  isError?: boolean
  error?: Error | null
  onRetry: () => void
  onPageChange: (page: number) => void
  onOpenDetail: (detail: TechnicalConfigurationCriterionDetail) => void
}

const EMPTY_EVIDENCE: TechnicalConfigurationComparisonEvidence = {
  documentCount: 0,
  citationCount: 0,
  hasEvidence: false,
}

type ComparisonCriterionRow = TechnicalConfigurationComparisonResult["data"]["criteria"][number]

type ComparisonCriterionGroup = {
  id: string
  name: string
  rows: ComparisonCriterionRow[]
}

function groupCriterionRows(criteria: readonly ComparisonCriterionRow[]) {
  const groups: ComparisonCriterionGroup[] = []

  for (const row of criteria) {
    const currentGroup = groups[groups.length - 1]

    if (currentGroup?.id === row.group.id) {
      currentGroup.rows.push(row)
    } else {
      groups.push({ id: row.group.id, name: row.group.name, rows: [row] })
    }
  }

  return groups
}

function formatEvidenceSummary(evidence: TechnicalConfigurationComparisonEvidence) {
  if (!evidence.hasEvidence) return "Chưa có bằng chứng"
  return `${evidence.documentCount} tài liệu · ${evidence.citationCount} trích dẫn`
}

function MatrixState({ children, role }: { children: React.ReactNode; role?: "alert" | "status" }) {
  return (
    <div
      className="flex min-h-72 items-center justify-center border-y px-6 py-12 text-center text-sm text-muted-foreground"
      role={role}
    >
      {children}
    </div>
  )
}

/** Renders the bounded read-only comparison page with frozen desktop columns. */
export function TechnicalConfigurationMatrix({
  hasRequest,
  result,
  isLoading = false,
  isError = false,
  error,
  onRetry,
  onPageChange,
  onOpenDetail,
}: Readonly<TechnicalConfigurationMatrixProps>) {
  if (!hasRequest) {
    return (
      <MatrixState>Chọn phiên bản cơ sở và ít nhất một phương án để bắt đầu so sánh.</MatrixState>
    )
  }

  if (isLoading) {
    return <MatrixState role="status">Đang tải ma trận so sánh...</MatrixState>
  }

  if (isError) {
    return (
      <MatrixState role="alert">
        <div className="space-y-3">
          <p>{error?.message || "Không thể tải ma trận so sánh."}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            Thử lại
          </Button>
        </div>
      </MatrixState>
    )
  }

  if (!result || result.data.criteria.length === 0) {
    return <MatrixState>Trang này chưa có tiêu chí để so sánh.</MatrixState>
  }

  const { criteria, options } = result.data
  const criterionGroups = groupCriterionRows(criteria)
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))
  const startItem = (result.page - 1) * result.pageSize + 1
  const endItem = Math.min(result.page * result.pageSize, result.total)

  return (
    <div className="space-y-3">
      <div
        data-testid="comparison-matrix-scroll"
        className="relative max-h-[calc(100vh-20rem)] min-h-[28rem] w-full overflow-auto rounded-md border"
      >
        <table className="min-w-max border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              <th
                data-testid="comparison-criterion-header"
                className="sticky left-0 top-0 z-50 w-[220px] min-w-[220px] max-w-[220px] border-b border-r bg-muted px-3 py-3 font-semibold"
                scope="col"
              >
                Tiêu chí
              </th>
              <th
                data-testid="comparison-baseline-header"
                className="sticky left-[220px] top-0 z-50 w-[360px] min-w-[360px] max-w-[360px] border-b border-r bg-muted px-3 py-3 font-semibold"
                scope="col"
              >
                Yêu cầu cơ sở
              </th>
              {options.map((option) => (
                <th
                  key={option.id}
                  data-testid="comparison-option-header"
                  className="sticky top-0 z-40 w-[320px] min-w-[320px] max-w-[320px] border-b border-r bg-muted px-3 py-3 font-semibold"
                  scope="col"
                >
                  <span className="block break-words">{option.displayLabel}</span>
                </th>
              ))}
            </tr>
          </thead>
          {criterionGroups.map((group) => (
            <tbody key={group.id} data-testid="comparison-group-body">
              <tr>
                <th
                  className="border-b bg-muted/70 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground"
                  colSpan={options.length + 2}
                  scope="rowgroup"
                >
                  {group.name}
                </th>
              </tr>
              {group.rows.map((row) => (
                <MatrixRow
                  key={row.criterion.id}
                  row={row}
                  options={options}
                  valueByOptionId={
                    new Map(row.optionValues.map((value) => [value.optionId, value]))
                  }
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <div className="flex min-h-10 items-center justify-between gap-4 text-sm">
        <p className="text-muted-foreground">
          Tiêu chí {startItem}-{endItem} trên {result.total} · Trang {result.page}/{totalPages}
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Trang trước"
            disabled={result.page <= 1}
            onClick={() => onPageChange(result.page - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Trang tiếp theo"
            disabled={result.page >= totalPages}
            onClick={() => onPageChange(result.page + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}

type MatrixRowProps = {
  row: TechnicalConfigurationComparisonResult["data"]["criteria"][number]
  options: TechnicalConfigurationComparisonResult["data"]["options"]
  valueByOptionId: ReadonlyMap<string, TechnicalConfigurationComparisonOptionValue>
  onOpenDetail: (detail: TechnicalConfigurationCriterionDetail) => void
}

function MatrixRow({ row, options, valueByOptionId, onOpenDetail }: Readonly<MatrixRowProps>) {
  const title = row.criterion.title ?? "Chưa có tiêu đề"

  return (
    <tr
      data-testid="comparison-criterion-row"
      data-criterion-id={row.criterion.id}
      className="align-top"
    >
      <th
        className="sticky left-0 z-30 w-[220px] min-w-[220px] max-w-[220px] border-b border-r bg-background px-3 py-3 font-medium"
        scope="row"
      >
        <span className="block text-xs text-muted-foreground">{row.criterion.criterionCode}</span>
        <span className="mt-1 block break-words">{title}</span>
      </th>
      <td className="sticky left-[220px] z-30 w-[360px] min-w-[360px] max-w-[360px] border-b border-r bg-background p-0">
        <button
          type="button"
          className="h-full w-full space-y-2 px-3 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-label={`Xem chi tiết ${row.criterion.criterionCode} · Yêu cầu cơ sở`}
          onClick={() =>
            onOpenDetail({
              criterionCode: row.criterion.criterionCode,
              criterionTitle: row.criterion.title,
              optionLabel: null,
              requirementText: row.criterion.requirementText,
              responseText: null,
              supplementaryInformation: null,
              evidence: row.baselineEvidence,
            })
          }
        >
          <p className="line-clamp-4 whitespace-pre-wrap break-words leading-5">
            {row.criterion.requirementText}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatEvidenceSummary(row.baselineEvidence)}
          </p>
        </button>
      </td>
      {options.map((option) => {
        const value = valueByOptionId.get(option.id)
        const response = value?.response
        const evidence = value?.evidence ?? EMPTY_EVIDENCE

        return (
          <td
            key={option.id}
            className="w-[320px] min-w-[320px] max-w-[320px] border-b border-r bg-background p-0"
          >
            <button
              type="button"
              className="h-full w-full space-y-2 px-3 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              aria-label={`Xem chi tiết ${row.criterion.criterionCode} · ${option.displayLabel}`}
              onClick={() =>
                onOpenDetail({
                  criterionCode: row.criterion.criterionCode,
                  criterionTitle: row.criterion.title,
                  optionLabel: option.displayLabel,
                  requirementText: row.criterion.requirementText,
                  responseText: response?.responseText ?? null,
                  supplementaryInformation: response?.supplementaryInformation ?? null,
                  evidence,
                })
              }
            >
              {response ? (
                <>
                  <p className="line-clamp-4 whitespace-pre-wrap break-words leading-5">
                    {response.responseText}
                  </p>
                  {response.supplementaryInformation ? (
                    <p className="text-xs font-medium text-foreground">Có thông tin bổ sung</p>
                  ) : null}
                </>
              ) : (
                <p className="text-muted-foreground">Chưa có phản hồi</p>
              )}
              <p className="text-xs text-muted-foreground">{formatEvidenceSummary(evidence)}</p>
            </button>
          </td>
        )
      })}
    </tr>
  )
}
