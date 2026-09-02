import type * as React from "react"
import { ChevronDown, RotateCcw, SquareMinus } from "lucide-react"

import { Button } from "@/components/ui/button"

import type { DeviceQuotaMergedItemRow } from "../device-quota-draft-catalog-types"
import { DeviceQuotaDraftCatalogRuleDisclosure } from "./DeviceQuotaDraftCatalogRuleDisclosure"

type DeviceQuotaDraftCatalogItemSummaryProps = Readonly<{
  row: DeviceQuotaMergedItemRow
  validationMessage?: string
  isReadOnly: boolean
  isMutationPending: boolean
  isExpanded: boolean
  onToggleExpanded: () => void
  onExclude: (sourceIdentifier: string) => void
  onRestore: (sourceIdentifier: string) => void
}>

function sourceMetadata(row: DeviceQuotaMergedItemRow): string {
  const pages = row.sourcePages.length > 0 ? row.sourcePages.join(", ") : "Chưa rõ"
  return `Nguồn: ${row.sourceReference ?? "Chưa có tham chiếu"} · Trang ${pages} · Thứ tự nguồn: ${row.sourceOrder} · Cấp: ${row.level} · Thuộc: ${row.parentSourceIdentifier ?? "gốc"}`
}

/** Renders compact item information, traceability, and actions in both modes. */
export function DeviceQuotaDraftCatalogItemSummary({
  row,
  validationMessage,
  isReadOnly,
  isMutationPending,
  isExpanded,
  onToggleExpanded,
  onExclude,
  onRestore,
}: DeviceQuotaDraftCatalogItemSummaryProps): React.JSX.Element {
  const itemName = row.regulatoryName
  const editorId = `device-quota-catalog-editor-${row.sourceIdentifier}`

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 size-8 shrink-0"
            aria-label={`${isExpanded ? "Thu gọn" : "Mở rộng"} ${itemName}`}
            aria-expanded={isExpanded}
            aria-controls={editorId}
            title={isExpanded ? "Thu gọn" : "Mở rộng"}
            onClick={onToggleExpanded}
          >
            <ChevronDown
              className={`size-4 transition-transform ${isExpanded ? "" : "-rotate-90"}`}
              aria-hidden="true"
            />
          </Button>
          <div className="min-w-0">
            <h3 className="font-medium">{row.regulatoryName}</h3>
            <p className="text-xs leading-5 text-muted-foreground">{sourceMetadata(row)}</p>
          </div>
        </div>
        {!isReadOnly ? (
          row.isExcluded ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isMutationPending}
              onClick={() => onRestore(row.sourceIdentifier)}
            >
              <RotateCcw className="size-4" />
              Khôi phục {itemName}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isMutationPending}
              onClick={() => onExclude(row.sourceIdentifier)}
            >
              <SquareMinus className="size-4" />
              Loại khỏi bản nháp {itemName}
            </Button>
          )
        ) : null}
      </div>

      <dl
        className="grid gap-x-4 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4"
        data-testid={`device-quota-catalog-summary-${row.sourceIdentifier}`}
      >
        <div>
          <dt className="text-xs">Tên hiển thị</dt>
          <dd className="truncate text-foreground">
            {row.displayNameOverride || "Mặc định theo tên Thông tư"}
          </dd>
        </div>
        <div>
          <dt className="text-xs">Đơn vị áp dụng</dt>
          <dd className="truncate text-foreground">{row.appliedUnit || "Chưa nhập"}</dd>
        </div>
        <div>
          <dt className="text-xs">Số lượng</dt>
          <dd className="text-foreground">{row.appliedQuantity ?? "Chưa nhập"}</dd>
        </div>
        <div>
          <dt className="text-xs">Ghi chú</dt>
          <dd className="truncate text-foreground">{row.notes || "Không có"}</dd>
        </div>
      </dl>

      <div className="space-y-2 text-xs text-muted-foreground">
        <p>Đơn vị pháp quy: {row.regulatoryUnit || "Không nêu"}</p>
        {validationMessage && !isExpanded ? (
          <p className="text-destructive">{validationMessage}</p>
        ) : null}
        <DeviceQuotaDraftCatalogRuleDisclosure itemName={itemName} rules={row.regulatoryRules} />
      </div>
    </>
  )
}
