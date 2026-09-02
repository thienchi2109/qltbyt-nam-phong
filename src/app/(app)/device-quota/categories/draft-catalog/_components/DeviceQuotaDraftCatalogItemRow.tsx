"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import type {
  DeviceQuotaDraftItemPatch,
  DeviceQuotaMergedItemRow,
} from "../device-quota-draft-catalog-types"
import { DeviceQuotaDraftCatalogItemSummary } from "./DeviceQuotaDraftCatalogItemSummary"

type DeviceQuotaDraftCatalogItemRowProps = {
  row: DeviceQuotaMergedItemRow
  validationMessage?: string
  isReadOnly: boolean
  isMutationPending: boolean
  isExpanded: boolean
  onToggleExpanded: () => void
  onUpdate: (sourceIdentifier: string, patch: DeviceQuotaDraftItemPatch) => void
  onExclude: (sourceIdentifier: string) => void
  onRestore: (sourceIdentifier: string) => void
}

/** Adapts one immutable regulatory item into staged draft fields and row actions. */
export function DeviceQuotaDraftCatalogItemRow({
  row,
  validationMessage,
  isReadOnly,
  isMutationPending,
  isExpanded,
  onToggleExpanded,
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
      className={`space-y-3 border-b px-3 py-3 ${row.isExcluded ? "bg-muted/40" : ""}`}
      data-testid={`device-quota-catalog-row-${row.sourceIdentifier}`}
      data-excluded={row.isExcluded || undefined}
      data-source-order={row.sourceOrder}
      data-expanded={isExpanded}
    >
      <DeviceQuotaDraftCatalogItemSummary
        row={row}
        validationMessage={validationMessage}
        isReadOnly={isReadOnly}
        isMutationPending={isMutationPending}
        isExpanded={isExpanded}
        onToggleExpanded={onToggleExpanded}
        onExclude={onExclude}
        onRestore={onRestore}
      />
      {isExpanded ? (
        <div
          id={`device-quota-catalog-editor-${row.sourceIdentifier}`}
          className="grid gap-x-4 gap-y-3 lg:grid-cols-2 min-[1200px]:grid-cols-[minmax(0,1.2fr)_10rem_10rem_minmax(0,1fr)]"
          data-field-grid="shared"
          data-testid={`device-quota-catalog-field-grid-${row.sourceIdentifier}`}
        >
          <div className="min-w-0 space-y-1">
            {isReadOnly || row.isExcluded ? (
              <span className="text-sm font-medium">Tên hiển thị</span>
            ) : (
              <label htmlFor={displayNameId} className="text-sm font-medium">
                Tên hiển thị
              </label>
            )}
            {isReadOnly || row.isExcluded ? (
              <p className="min-h-9 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                {row.displayNameOverride || "Mặc định theo tên Thông tư"}
              </p>
            ) : (
              <Input
                id={displayNameId}
                aria-label={`Tên hiển thị - ${itemName}`}
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

          <div className="min-w-0 space-y-1">
            {isReadOnly || row.isExcluded ? (
              <span className="text-sm font-medium">Đơn vị áp dụng</span>
            ) : (
              <label htmlFor={appliedUnitId} className="text-sm font-medium">
                Đơn vị áp dụng
              </label>
            )}
            {isReadOnly || row.isExcluded ? (
              <p className="min-h-9 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                {row.appliedUnit || "Chưa nhập"}
              </p>
            ) : (
              <Input
                id={appliedUnitId}
                aria-label={`Đơn vị áp dụng - ${itemName}`}
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

          <div className="min-w-0 space-y-1">
            {isReadOnly || row.isExcluded ? (
              <span className="text-sm font-medium">Số lượng đề xuất</span>
            ) : (
              <label htmlFor={quantityId} className="text-sm font-medium">
                Số lượng đề xuất
              </label>
            )}
            {isReadOnly || row.isExcluded ? (
              <p className="min-h-9 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                {row.appliedQuantity ?? "Chưa nhập"}
              </p>
            ) : (
              <Input
                id={quantityId}
                aria-label={`Số lượng đề xuất - ${itemName}`}
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

          <div className="min-w-0 space-y-1">
            {isReadOnly || row.isExcluded ? (
              <span className="text-sm font-medium">Ghi chú</span>
            ) : (
              <label htmlFor={notesId} className="text-sm font-medium">
                Ghi chú
              </label>
            )}
            {isReadOnly || row.isExcluded ? (
              <p className="min-h-9 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                {row.notes || "Không có"}
              </p>
            ) : (
              <Textarea
                id={notesId}
                aria-label={`Ghi chú - ${itemName}`}
                className="min-h-9 resize-y"
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
      ) : null}
    </article>
  )
}
