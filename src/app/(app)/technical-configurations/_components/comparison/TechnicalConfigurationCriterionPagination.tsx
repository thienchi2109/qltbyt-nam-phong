"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"

type TechnicalConfigurationCriterionPaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

/** Renders the canonical criterion page summary and previous/next controls. */
export function TechnicalConfigurationCriterionPagination({
  page,
  pageSize,
  total,
  onPageChange,
  disabled = false,
}: Readonly<TechnicalConfigurationCriterionPaginationProps>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, total)

  return (
    <div className="flex min-h-10 flex-wrap items-center justify-between gap-3 text-sm">
      <p className="flex flex-wrap gap-x-2 text-muted-foreground">
        <span>
          Tiêu chí {startItem}-{endItem} trên {total}
        </span>
        <span>
          Trang {page}/{totalPages}
        </span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Trang trước"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Trang tiếp theo"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
