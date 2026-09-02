"use client"

import { RotateCcw, SquareMinus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import type {
  DeviceQuotaDraftItemPatch,
  DeviceQuotaMergedItemRow,
} from "../device-quota-draft-catalog-types"
import { DeviceQuotaDraftCatalogRuleDisclosure } from "./DeviceQuotaDraftCatalogRuleDisclosure"

type DeviceQuotaDraftCatalogItemRowProps = {
  row: DeviceQuotaMergedItemRow
  validationMessage?: string
  isReadOnly: boolean
  isMutationPending: boolean
  onUpdate: (sourceIdentifier: string, patch: DeviceQuotaDraftItemPatch) => void
  onExclude: (sourceIdentifier: string) => void
  onRestore: (sourceIdentifier: string) => void
}

function sourceMetadata(row: DeviceQuotaMergedItemRow): string {
  const pages = row.sourcePages.length > 0 ? row.sourcePages.join(", ") : "Chưa rõ"
  return `Nguồn: ${row.sourceReference ?? "Chưa có tham chiếu"} · Trang ${pages} · Thứ tự nguồn: ${row.sourceOrder} · Cấp: ${row.level} · Thuộc: ${row.parentSourceIdentifier ?? "gốc"}`
}

/** Adapts one immutable regulatory item into staged draft fields and row actions. */
export function DeviceQuotaDraftCatalogItemRow({
  row,
  validationMessage,
  isReadOnly,
  isMutationPending,
  onUpdate,
  onExclude,
  onRestore,
}: DeviceQuotaDraftCatalogItemRowProps): React.JSX.Element {
  const itemName = row.regulatoryName
  const quantityId = `device-quota-quantity-${row.sourceIdentifier}`
  const appliedUnitId = `device-quota-applied-unit-${row.sourceIdentifier}`
  const notesId = `device-quota-notes-${row.sourceIdentifier}`
  const displayNameId = `device-quota-display-name-${row.sourceIdentifier}`

  return (
    <article
      className={`space-y-3 border-b px-4 py-4 ${row.isExcluded ? "bg-muted/40" : ""}`}
      data-testid={`device-quota-catalog-row-${row.sourceIdentifier}`}
      data-excluded={row.isExcluded || undefined}
      data-source-order={row.sourceOrder}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">{row.regulatoryName}</h3>
          <p className="text-xs leading-5 text-muted-foreground">{sourceMetadata(row)}</p>
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

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_10rem_10rem_minmax(0,1fr)]">
        <div className="space-y-1">
          {isReadOnly || row.isExcluded ? (
            <span className="text-sm font-medium">Tên hiển thị tại đơn vị - {itemName}</span>
          ) : (
            <label htmlFor={displayNameId} className="text-sm font-medium">
              Tên hiển thị tại đơn vị - {itemName}
            </label>
          )}
          {isReadOnly || row.isExcluded ? (
            <p className="min-h-9 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {row.displayNameOverride || "Mặc định theo tên Thông tư"}
            </p>
          ) : (
            <Input
              id={displayNameId}
              disabled={isMutationPending}
              value={row.displayNameOverride ?? ""}
              placeholder="Mặc định theo tên Thông tư"
              onChange={(event) =>
                onUpdate(row.sourceIdentifier, {
                  displayNameOverride: event.target.value === "" ? null : event.target.value,
                })
              }
            />
          )}
        </div>

        <div className="space-y-1">
          {isReadOnly || row.isExcluded ? (
            <span className="text-sm font-medium">Đơn vị áp dụng tại đơn vị - {itemName}</span>
          ) : (
            <label htmlFor={appliedUnitId} className="text-sm font-medium">
              Đơn vị áp dụng tại đơn vị - {itemName}
            </label>
          )}
          {isReadOnly || row.isExcluded ? (
            <p className="min-h-9 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {row.appliedUnit || "Chưa nhập"}
            </p>
          ) : (
            <Input
              id={appliedUnitId}
              disabled={isMutationPending}
              value={row.appliedUnit ?? ""}
              placeholder={row.regulatoryUnit || "Nhập đơn vị áp dụng"}
              onChange={(event) =>
                onUpdate(row.sourceIdentifier, {
                  appliedUnit: event.target.value === "" ? null : event.target.value,
                })
              }
            />
          )}
        </div>

        <div className="space-y-1">
          {isReadOnly || row.isExcluded ? (
            <span className="text-sm font-medium">
              Số lượng đề xuất trong bản nháp - {itemName}
            </span>
          ) : (
            <label htmlFor={quantityId} className="text-sm font-medium">
              Số lượng đề xuất trong bản nháp - {itemName}
            </label>
          )}
          {isReadOnly || row.isExcluded ? (
            <p className="min-h-9 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {row.appliedQuantity ?? "Chưa nhập"}
            </p>
          ) : (
            <Input
              id={quantityId}
              type="number"
              min="0"
              step="1"
              disabled={isMutationPending}
              value={row.appliedQuantity ?? ""}
              aria-invalid={!!validationMessage}
              aria-describedby={validationMessage ? `${quantityId}-error` : undefined}
              onChange={(event) => {
                const value = event.target.value
                onUpdate(row.sourceIdentifier, {
                  appliedQuantity: value === "" ? null : Number(value),
                })
              }}
            />
          )}
          {validationMessage ? (
            <p id={`${quantityId}-error`} className="text-xs text-destructive">
              {validationMessage}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          {isReadOnly || row.isExcluded ? (
            <span className="text-sm font-medium">Ghi chú - {itemName}</span>
          ) : (
            <label htmlFor={notesId} className="text-sm font-medium">
              Ghi chú - {itemName}
            </label>
          )}
          {isReadOnly || row.isExcluded ? (
            <p className="min-h-9 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {row.notes || "Không có"}
            </p>
          ) : (
            <Textarea
              id={notesId}
              disabled={isMutationPending}
              value={row.notes ?? ""}
              rows={1}
              onChange={(event) =>
                onUpdate(row.sourceIdentifier, {
                  notes: event.target.value === "" ? null : event.target.value,
                })
              }
            />
          )}
        </div>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <p>Đơn vị pháp quy: {row.regulatoryUnit || "Không nêu"}</p>
        <DeviceQuotaDraftCatalogRuleDisclosure itemName={itemName} rules={row.regulatoryRules} />
      </div>
    </article>
  )
}
