"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle, PackageOpen, X } from "lucide-react"

import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  MappingPreviewLoadingState,
  type EquipmentPreviewItem,
} from "@/app/(app)/device-quota/_components/mapping-preview/MappingPreviewPrimitives"
import { deviceQuotaCategoryAssignedEquipmentQueryOptions } from "../_queries/deviceQuotaCategoryAssignedEquipmentQuery"

// ============================================
// Types
// ============================================

export interface DeviceQuotaCategoryUnassignmentRequest {
  equipmentId: number
  expectedCategoryId: number
  donViId: number
}

interface DeviceQuotaCategoryAssignedEquipmentProps {
  nhomId: number
  donViId: number | null
  variant?: "inline" | "panel"
  reconciledEquipmentIds?: Set<number>
  canUnassign?: boolean
  categoryName?: string
  onUnassign?: (request: DeviceQuotaCategoryUnassignmentRequest) => void | Promise<void>
}

interface EquipmentUnassignment {
  categoryId: number
  categoryName: string
  donViId: number
  onUnassign: (request: DeviceQuotaCategoryUnassignmentRequest) => void | Promise<void>
}

// ============================================
// Status badge styles
// ============================================

const STATUS_STYLES: Record<string, string> = {
  "Hoạt động": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Bảo trì": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Hỏng: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
}

// ============================================
// Equipment Row
// ============================================

function EquipmentUnassignmentAction({
  item,
  unassignment,
}: {
  item: EquipmentPreviewItem
  unassignment: EquipmentUnassignment
}) {
  const actionRef = React.useRef<HTMLButtonElement>(null)
  const wasOpenRef = React.useRef(false)
  const [isOpen, setIsOpen] = React.useState(false)
  const [isPending, setIsPending] = React.useState(false)

  React.useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      actionRef.current?.focus()
    }
    wasOpenRef.current = isOpen
  }, [isOpen])

  const handleConfirm = React.useCallback(async () => {
    if (isPending) return

    setIsPending(true)
    try {
      await unassignment.onUnassign({
        equipmentId: item.id,
        expectedCategoryId: unassignment.categoryId,
        donViId: unassignment.donViId,
      })
      setIsOpen(false)
    } catch {
      // Mutation feedback belongs to the Phase 3 caller; keep the dialog open for retry.
    } finally {
      setIsPending(false)
    }
  }, [isPending, item.id, unassignment])

  return (
    <div
      className="inline-flex"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={actionRef}
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label="Bỏ khỏi danh mục"
            disabled={isPending}
            onClick={() => setIsOpen(true)}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Bỏ khỏi danh mục</TooltipContent>
      </Tooltip>
      <DestructiveConfirmDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Bỏ thiết bị khỏi danh mục?"
        description={
          <>
            Thiết bị <strong>{item.ten_thiet_bi}</strong> sẽ được bỏ khỏi danh mục{" "}
            <strong>{unassignment.categoryName}</strong>.
          </>
        }
        confirmLabel="Bỏ khỏi danh mục"
        isPending={isPending}
        onConfirm={handleConfirm}
      />
    </div>
  )
}

function EquipmentRow({
  item,
  isReconciled,
  unassignment,
}: {
  item: EquipmentPreviewItem
  isReconciled: boolean
  unassignment?: EquipmentUnassignment
}) {
  const statusStyle = STATUS_STYLES[item.tinh_trang ?? ""] ?? ""

  return (
    <tr
      className={cn(
        "text-xs transition-colors hover:bg-accent/30",
        isReconciled && "bg-emerald-50 dark:bg-emerald-950/30"
      )}
      data-testid="assigned-equipment-row"
      data-reconciled={isReconciled ? "true" : undefined}
    >
      <td className="max-w-[5rem] truncate px-3 py-2 font-mono text-muted-foreground">
        {item.ma_thiet_bi}
      </td>
      <td className="px-3 py-2 font-medium">
        <span className="line-clamp-2" title={item.ten_thiet_bi}>
          {item.ten_thiet_bi}
        </span>
      </td>
      <td className="max-w-[6rem] truncate px-3 py-2 text-muted-foreground">{item.model ?? "–"}</td>
      <td className="max-w-[6rem] truncate px-3 py-2 text-muted-foreground">
        {item.serial ?? "–"}
      </td>
      <td className="max-w-[7rem] truncate px-3 py-2 text-muted-foreground">
        {item.khoa_phong_quan_ly ?? "–"}
      </td>
      <td className="px-3 py-2">
        {item.tinh_trang ? (
          <Badge variant="outline" className={`px-1.5 py-0 text-[10px] font-normal ${statusStyle}`}>
            {item.tinh_trang}
          </Badge>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </td>
      {unassignment ? (
        <td className="px-2 py-1.5 text-right">
          <EquipmentUnassignmentAction item={item} unassignment={unassignment} />
        </td>
      ) : null}
    </tr>
  )
}

// ============================================
// Main Component
// ============================================

/**
 * Read-only panel showing equipment assigned directly to a category.
 * Fetches data via the existing dinh_muc_thiet_bi_by_nhom RPC.
 */
export function DeviceQuotaCategoryAssignedEquipment({
  nhomId,
  donViId,
  variant = "inline",
  reconciledEquipmentIds = new Set<number>(),
  canUnassign = false,
  categoryName,
  onUnassign,
}: DeviceQuotaCategoryAssignedEquipmentProps) {
  const {
    data: equipment,
    isError,
    isLoading,
  } = useQuery(deviceQuotaCategoryAssignedEquipmentQueryOptions(nhomId, donViId))
  const isPanel = variant === "panel"
  const unassignment =
    canUnassign && categoryName && donViId !== null && onUnassign
      ? {
          categoryId: nhomId,
          categoryName,
          donViId,
          onUnassign,
        }
      : undefined

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "overflow-hidden rounded-md border border-border/50 bg-muted/30",
          isPanel ? "border-l-0" : "ml-6 mt-1 mb-2 border-l-2 border-l-primary/20"
        )}
      >
        {isLoading ? (
          <div className="p-3">
            <MappingPreviewLoadingState count={2} />
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-destructive">
            <AlertCircle className="size-4" />
            <span>Không thể tải danh sách thiết bị được gán</span>
          </div>
        ) : !equipment || equipment.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <PackageOpen className="size-4" />
            <span>Chưa có thiết bị nào được gán</span>
          </div>
        ) : (
          <div
            data-testid="assigned-equipment-table-scroll"
            className={cn(isPanel && "overflow-x-auto")}
          >
            <table className={cn("w-full text-left", isPanel && "min-w-[760px]")}>
              <thead>
                <tr className="border-b text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-1.5 font-medium">
                    Mã TB
                  </th>
                  <th scope="col" className="px-3 py-1.5 font-medium">
                    Tên thiết bị
                  </th>
                  <th scope="col" className="px-3 py-1.5 font-medium">
                    Model
                  </th>
                  <th scope="col" className="px-3 py-1.5 font-medium">
                    Serial
                  </th>
                  <th scope="col" className="px-3 py-1.5 font-medium">
                    Khoa phòng
                  </th>
                  <th scope="col" className="px-3 py-1.5 font-medium">
                    Tình trạng
                  </th>
                  {unassignment ? (
                    <th scope="col" className="w-10 px-2 py-1.5 text-right font-medium">
                      <span className="sr-only">Hành động</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {equipment.map((item) => (
                  <EquipmentRow
                    key={item.id}
                    item={item}
                    isReconciled={reconciledEquipmentIds.has(item.id)}
                    unassignment={unassignment}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
