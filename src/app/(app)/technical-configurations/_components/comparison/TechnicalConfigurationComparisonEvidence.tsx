"use client"

import { AlertCircle, ExternalLink, Loader2, RefreshCw } from "lucide-react"

import {
  type TechnicalConfigurationComparisonEvidenceTarget,
  useTechnicalConfigurationComparisonEvidence,
} from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationComparisonEvidence"
import { Button } from "@/components/ui/button"

type TechnicalConfigurationComparisonEvidenceProps = {
  target: TechnicalConfigurationComparisonEvidenceTarget
}

/** Renders bounded documents and criterion citations without authoring controls. */
export function TechnicalConfigurationComparisonEvidence({
  target,
}: Readonly<TechnicalConfigurationComparisonEvidenceProps>) {
  const { documents, evidenceQuery } = useTechnicalConfigurationComparisonEvidence(target)
  const applicableDocuments = documents.flatMap((document) => {
    const citations = document.citations.filter(
      (citation) => citation.criterion_id === target.criterionId
    )
    return citations.length > 0 ? [{ ...document, citations }] : []
  })
  const hasInitialError = evidenceQuery.isError && evidenceQuery.data === undefined
  const hasLoadedDocuments = applicableDocuments.length > 0

  if (evidenceQuery.isLoading) {
    return (
      <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Đang tải bằng chứng...
      </div>
    )
  }

  if (hasInitialError) {
    return (
      <div className="space-y-3 rounded-md border border-destructive/40 p-4" role="alert">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          Không thể tải bằng chứng.
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={evidenceQuery.isFetching}
          onClick={() => void evidenceQuery.refetch()}
        >
          <RefreshCw className={evidenceQuery.isFetching ? "animate-spin" : undefined} />
          Thử lại
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {evidenceQuery.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm" role="alert">
          <span className="text-destructive">Không thể tải thêm bằng chứng.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={evidenceQuery.isFetchingNextPage}
            onClick={() => void evidenceQuery.fetchNextPage()}
          >
            <RefreshCw className={evidenceQuery.isFetchingNextPage ? "animate-spin" : undefined} />
            Thử lại
          </Button>
        </div>
      ) : null}

      {hasLoadedDocuments ? (
        <div className="divide-y rounded-md border">
          {applicableDocuments.map((document) => (
            <article key={document.id} className="space-y-3 p-4">
              <a
                className="inline-flex max-w-full items-start gap-1.5 font-medium text-primary hover:underline"
                href={document.url}
                target="_blank"
                rel="noreferrer"
              >
                <span className="break-words">{document.name}</span>
                <ExternalLink className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              </a>

              <ul className="space-y-3">
                {document.citations.map((citation) => (
                  <li key={citation.id} className="space-y-1 border-l-2 pl-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {citation.page_section || "Không ghi trang hoặc mục"}
                    </p>
                    <p className="whitespace-pre-wrap break-words leading-6">
                      {citation.excerpt || "Không có đoạn trích."}
                    </p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Chưa có tài liệu phù hợp trên các trang đã tải.
        </p>
      )}

      {evidenceQuery.hasNextPage && !evidenceQuery.isError ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={evidenceQuery.isFetchingNextPage}
          onClick={() => void evidenceQuery.fetchNextPage()}
        >
          {evidenceQuery.isFetchingNextPage ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : null}
          Tải thêm
        </Button>
      ) : null}
    </div>
  )
}
