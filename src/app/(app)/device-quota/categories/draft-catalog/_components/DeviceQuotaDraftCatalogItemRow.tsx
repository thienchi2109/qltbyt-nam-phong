"use client"

import { useState } from "react"
import { Pencil, RotateCcw, SquareMinus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import type {
  DeviceQuotaDraftItemPatch,
  DeviceQuotaMergedItemRow,
} from "../device-quota-draft-catalog-types"
import { DeviceQuotaDraftCatalogRuleDisclosure } from "./DeviceQuotaDraftCatalogRuleDisclosure"
import { DeviceQuotaDraftCatalogSourceDisclosure } from "./DeviceQuotaDraftCatalogSourceDisclosure"

type DeviceQuotaDraftCatalogItemRowProps = Readonly<{
  row: DeviceQuotaMergedItemRow
  validationMessage?: string
  isReadOnly: boolean
  isMutationPending: boolean
  onUpdate: (sourceIdentifier: string, patch: DeviceQuotaDraftItemPatch) => void
  onExclude: (sourceIdentifier: string) => void
  onRestore: (sourceIdentifier: string) => void
}>

/** Renders one immutable appendix item with the existing staged draft controls. */
export function DeviceQuotaDraftCatalogItemRow({
  row,
  validationMessage,
  isReadOnly,
  isMutationPending,
  onUpdate,
  onExclude,
  onRestore,
}: DeviceQuotaDraftCatalogItemRowProps): React.JSX.Element {
  const [isNameEditing, setIsNameEditing] = useState(false)
  const itemName = row.regulatoryName
  const quantityId = `device-quota-quantity-${row.sourceIdentifier}`
  const appliedUnitId = `device-quota-applied-unit-${row.sourceIdentifier}`
  const notesId = `device-quota-notes-${row.sourceIdentifier}`
  const displayNameId = `device-quota-display-name-${row.sourceIdentifier}`
  return (
    <tr
      data-testid={`device-quota-catalog-row-${row.sourceIdentifier}`}
      data-excluded={row.isExcluded || undefined}
      data-source-order={row.sourceOrder}
      data-parent-source={row.parentSourceIdentifier ?? undefined}
      aria-describedby={
        row.parentSourceIdentifier
          ? `device-quota-section-header-${row.parentSourceIdentifier}`
          : undefined
      }
      className={row.isExcluded ? "border-b bg-muted/40" : "border-b"}
    >
      <td className="sticky left-0 z-10 w-20 bg-background px-4 py-3 align-top font-medium">
        {row.sourceLabel}
      </td>
      <th
        scope="row"
        className="sticky left-20 z-10 min-w-[22rem] bg-background px-4 py-3 text-left align-top"
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium">{row.regulatoryName}</div>
              <div className="text-xs font-normal text-muted-foreground">
                <DeviceQuotaDraftCatalogSourceDisclosure row={row} />
              </div>
            </div>
            {!isReadOnly ? (
              row.isExcluded ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Khôi phục"
                  aria-label={`Khôi phục ${itemName}`}
                  disabled={isMutationPending}
                  onClick={() => onRestore(row.sourceIdentifier)}
                >
                  <RotateCcw aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Loại khỏi bản nháp"
                  aria-label={`Loại khỏi bản nháp ${itemName}`}
                  disabled={isMutationPending}
                  onClick={() => onExclude(row.sourceIdentifier)}
                >
                  <SquareMinus aria-hidden="true" />
                </Button>
              )
            ) : null}
          </div>
          {row.isExcluded ? (
            <p className="text-xs font-medium text-muted-foreground">Đã loại khỏi bản nháp</p>
          ) : null}
          {!isReadOnly && !row.isExcluded ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-0 text-xs text-muted-foreground"
                aria-expanded={isNameEditing}
                aria-label={`Chỉnh tên hiển thị ${itemName}`}
                disabled={isMutationPending}
                onClick={() => setIsNameEditing((current) => !current)}
              >
                <Pencil aria-hidden="true" />
                Tên hiển thị
              </Button>
              {isNameEditing ? (
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
              ) : null}
            </>
          ) : row.displayNameOverride ? (
            <p className="text-xs font-normal text-muted-foreground">
              Tên hiển thị dự thảo: {row.displayNameOverride}
            </p>
          ) : null}
        </div>
      </th>
      <td data-source-unit className="px-4 py-3 align-top">
        {row.regulatoryUnit || "Không nêu"}
      </td>
      <td className="max-w-[28rem] px-4 py-3 align-top">
        <ol className="list-decimal space-y-1 pl-5">
          {row.regulatoryQuotaLines.map((line, index) => (
            <li key={`${row.sourceIdentifier}-quota-${index}`}>{line}</li>
          ))}
        </ol>
        <div className="mt-2 text-xs font-normal text-muted-foreground">
          <DeviceQuotaDraftCatalogRuleDisclosure itemName={itemName} rules={row.regulatoryRules} />
        </div>
      </td>
      <td className="bg-primary/5 px-4 py-3 align-top">
        {isReadOnly || row.isExcluded ? (
          row.appliedUnit || row.regulatoryUnit || "Chưa nhập"
        ) : (
          <Input
            id={appliedUnitId}
            aria-label={`ĐVT áp dụng - ${itemName}`}
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
      </td>
      <td className="bg-primary/5 px-4 py-3 align-top">
        {isReadOnly || row.isExcluded ? (
          (row.appliedQuantity ?? "Chưa nhập")
        ) : (
          <Input
            id={quantityId}
            aria-label={`SL đề xuất - ${itemName}`}
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
          <p id={`${quantityId}-error`} className="mt-1 text-xs text-destructive">
            {validationMessage}
          </p>
        ) : null}
      </td>
      <td className="bg-primary/5 px-4 py-3 align-top">
        {isReadOnly || row.isExcluded ? (
          row.notes || "Không có"
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
      </td>
    </tr>
  )
}
