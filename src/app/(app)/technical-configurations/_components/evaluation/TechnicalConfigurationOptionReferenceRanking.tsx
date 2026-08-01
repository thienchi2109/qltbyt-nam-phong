"use client"

import * as React from "react"
import { AlertCircle, Info, ListOrdered, Loader2, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import { useTechnicalConfigurationReferenceRankingQuery } from "../../_hooks/useTechnicalConfigurationReferenceRanking"
import type {
  TechnicalConfigurationReferenceRankingItemWire,
  TechnicalConfigurationReferenceRankingSnapshot,
} from "../../reference-ranking-types"

type TechnicalConfigurationOptionReferenceRankingProps = {
  dossierId: string
  baselineVersionId: string
}

function TechnicalConfigurationEligibleRanking({
  items,
}: Readonly<{ items: TechnicalConfigurationReferenceRankingItemWire[] }>) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Chưa có phương án đủ dữ liệu để xếp hạng.</p>
    )
  }

  return (
    <ol className="divide-y border-y">
      {items.map((item) => (
        <li
          key={item.option_id}
          data-testid="reference-ranking-option"
          data-option-id={item.option_id}
          className="grid min-w-0 gap-2 py-3 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:items-start"
        >
          <span className="text-sm font-semibold tabular-nums">Hạng {item.rank}</span>
          <div className="min-w-0 space-y-1">
            <p className="break-words text-sm font-medium">{item.display_label}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Không đạt: {item.failed_count}</span>
              <span>Chưa đủ bằng chứng: {item.insufficient_evidence_count}</span>
              <span>Vượt yêu cầu: {item.exceeds_count}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function TechnicalConfigurationIncompleteRanking({
  items,
}: Readonly<{ items: TechnicalConfigurationReferenceRankingItemWire[] }>) {
  if (items.length === 0) return null

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Phương án chưa hoàn tất đánh giá</h4>
      <ul className="divide-y border-y">
        {items.map((item) => (
          <li key={item.option_id} className="min-w-0 space-y-1 py-3">
            <p className="break-words text-sm font-medium">{item.display_label}</p>
            <p className="text-sm text-muted-foreground">Chưa đủ dữ liệu để xếp hạng</p>
            <p className="text-xs text-muted-foreground">
              Còn thiếu đánh giá cho {item.incomplete_criterion_count} tiêu chí áp dụng.
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TechnicalConfigurationRankingResult({
  ranking,
}: Readonly<{ ranking: TechnicalConfigurationReferenceRankingSnapshot }>) {
  if (ranking.total === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có phương án để xếp hạng.</p>
  }

  const eligibleItems = ranking.data.filter((item) => item.eligibility === "eligible")
  const incompleteItems = ranking.data.filter((item) => item.eligibility === "incomplete")

  return (
    <div className="space-y-4" aria-live="polite">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Ưu tiên ít Không đạt, ít Chưa đủ bằng chứng, rồi nhiều Vượt yêu cầu.
        </p>
        <TechnicalConfigurationEligibleRanking items={eligibleItems} />
      </div>
      <TechnicalConfigurationIncompleteRanking items={incompleteItems} />
    </div>
  )
}

/** Renders the dossier-wide ranking only after an explicit request for the active baseline. */
export function TechnicalConfigurationOptionReferenceRanking({
  dossierId,
  baselineVersionId,
}: Readonly<TechnicalConfigurationOptionReferenceRankingProps>) {
  const scopeKey = `${dossierId}:${baselineVersionId}`
  const scopeToken = React.useMemo(() => Symbol(scopeKey), [scopeKey])
  const [requestedScopeToken, setRequestedScopeToken] = React.useState<symbol | null>(null)
  const isRequested = requestedScopeToken === scopeToken
  const rankingQuery = useTechnicalConfigurationReferenceRankingQuery(
    { dossierId, baselineVersionId },
    isRequested
  )
  const ranking = rankingQuery.data

  return (
    <section className="min-w-0 space-y-3 border-y py-4" aria-labelledby="reference-ranking-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 id="reference-ranking-title" className="text-sm font-semibold">
            Xếp hạng tham khảo
          </h3>
          <p className="text-sm text-muted-foreground">
            So sánh toàn bộ phương án theo các đánh giá thủ công đã hoàn tất.
          </p>
        </div>
        {!isRequested ? (
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={() => setRequestedScopeToken(scopeToken)}
          >
            <ListOrdered className="size-4" aria-hidden="true" />
            Xem xếp hạng tham khảo
          </Button>
        ) : null}
      </div>

      {isRequested ? (
        <Alert>
          <Info className="size-4" aria-hidden="true" />
          <AlertTitle>Chỉ dùng để tham khảo</AlertTitle>
          <AlertDescription>
            Xếp hạng này chỉ để tham khảo, không phải quyết định lựa chọn nhà cung cấp.
          </AlertDescription>
        </Alert>
      ) : null}

      {isRequested && rankingQuery.isFetching ? (
        <div
          className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Đang tổng hợp xếp hạng...
        </div>
      ) : null}

      {isRequested && rankingQuery.isError && !rankingQuery.isFetching ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>Không thể tải xếp hạng tham khảo</AlertTitle>
          <AlertDescription>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void rankingQuery.refetch()}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {isRequested && rankingQuery.isSuccess && ranking && !rankingQuery.isFetching ? (
        <TechnicalConfigurationRankingResult ranking={ranking} />
      ) : null}
    </section>
  )
}
