# Transfers Page Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce `src/app/(app)/transfers/page.tsx` from 1246 lines to ~400 lines by extracting action handlers, row actions, and facility filter into separate modules.

**Architecture:** Extract a custom hook (`useTransferActions`) for all action logic, a component (`TransferRowActions`) for action button rendering, and a component (`FacilityFilter`) for the facility selection UI. The page becomes an orchestrator that wires these together.

**Tech Stack:** React 18, TypeScript, TanStack Query, NextAuth, shadcn/ui components

---

## Task 1: Create `useTransferActions` Hook

**Files:**
- Create: `src/hooks/useTransferActions.ts`

**Step 1: Create the hook file with types and shell**

```typescript
// src/hooks/useTransferActions.ts
import * as React from "react"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import type { TransferListItem } from "@/types/transfers-data-grid"
import type { TransferRequest } from "@/types/database"

interface UseTransferActionsOptions {
  onSuccess: () => Promise<void>
}

interface UseTransferActionsReturn {
  // Status transition actions
  approveTransfer: (item: TransferListItem) => Promise<void>
  startTransfer: (item: TransferListItem) => Promise<void>
  handoverToExternal: (item: TransferListItem) => Promise<void>
  returnFromExternal: (item: TransferListItem) => Promise<void>
  completeTransfer: (item: TransferListItem) => Promise<void>

  // CRUD actions
  confirmDelete: (item: TransferListItem) => Promise<void>

  // Permission checks
  canEditTransfer: (item: TransferListItem) => boolean
  canDeleteTransfer: (item: TransferListItem) => boolean

  // Utility
  mapToTransferRequest: (item: TransferListItem) => TransferRequest
  isRegionalLeader: boolean
  isTransferCoreRole: boolean
}

export function useTransferActions(
  options: UseTransferActionsOptions
): UseTransferActionsReturn {
  const { toast } = useToast()
  const { data: session } = useSession()
  const user = session?.user as any

  const isRegionalLeader = user?.role === "regional_leader"
  const isTransferCoreRole =
    user?.role === "global" || user?.role === "admin" || user?.role === "to_qltb"

  const notifyRegionalLeaderRestricted = React.useCallback(() => {
    toast({
      variant: "destructive",
      title: "Không thể thực hiện",
      description: "Vai trò Trưởng vùng chỉ được xem yêu cầu luân chuyển.",
    })
  }, [toast])

  // mapToTransferRequest - converts TransferListItem to TransferRequest
  const mapToTransferRequest = React.useCallback(
    (item: TransferListItem): TransferRequest => ({
      id: item.id,
      ma_yeu_cau: item.ma_yeu_cau,
      thiet_bi_id: item.thiet_bi_id,
      loai_hinh: item.loai_hinh,
      trang_thai: item.trang_thai,
      nguoi_yeu_cau_id: item.nguoi_yeu_cau_id ?? undefined,
      ly_do_luan_chuyen: item.ly_do_luan_chuyen,
      khoa_phong_hien_tai: item.khoa_phong_hien_tai ?? undefined,
      khoa_phong_nhan: item.khoa_phong_nhan ?? undefined,
      muc_dich: item.muc_dich ?? undefined,
      don_vi_nhan: item.don_vi_nhan ?? undefined,
      dia_chi_don_vi: item.dia_chi_don_vi ?? undefined,
      nguoi_lien_he: item.nguoi_lien_he ?? undefined,
      so_dien_thoai: item.so_dien_thoai ?? undefined,
      ngay_du_kien_tra: item.ngay_du_kien_tra ?? undefined,
      ngay_ban_giao: item.ngay_ban_giao ?? undefined,
      ngay_hoan_tra: item.ngay_hoan_tra ?? undefined,
      ngay_hoan_thanh: item.ngay_hoan_thanh ?? undefined,
      nguoi_duyet_id: item.nguoi_duyet_id ?? undefined,
      ngay_duyet: item.ngay_duyet ?? undefined,
      ghi_chu_duyet: item.ghi_chu_duyet ?? undefined,
      created_at: item.created_at,
      updated_at: item.updated_at ?? item.created_at,
      created_by: item.created_by ?? undefined,
      updated_by: item.updated_by ?? undefined,
      thiet_bi: item.thiet_bi
        ? {
            id: item.thiet_bi_id,
            ten_thiet_bi: item.thiet_bi.ten_thiet_bi ?? "",
            ma_thiet_bi: item.thiet_bi.ma_thiet_bi ?? "",
            model: item.thiet_bi.model ?? undefined,
            serial: item.thiet_bi.serial ?? undefined,
            serial_number: item.thiet_bi.serial ?? undefined,
            khoa_phong_quan_ly: item.thiet_bi.khoa_phong_quan_ly ?? undefined,
            don_vi: item.thiet_bi.facility_id ?? undefined,
            facility_name: item.thiet_bi.facility_name ?? undefined,
            facility_id: item.thiet_bi.facility_id ?? undefined,
            tinh_trang: null,
          }
        : null,
      nguoi_yeu_cau: undefined,
      nguoi_duyet: undefined,
      created_by_user: undefined,
      updated_by_user: undefined,
    }),
    []
  )

  // Permission checks
  const canEditTransfer = React.useCallback(
    (item: TransferListItem) => {
      if (!user || isRegionalLeader) return false
      const deptMatch =
        user.role === "qltb_khoa" &&
        (user.khoa_phong === item.khoa_phong_hien_tai || user.khoa_phong === item.khoa_phong_nhan)
      const allowedRole = isTransferCoreRole || deptMatch
      return (
        allowedRole && (item.trang_thai === "cho_duyet" || item.trang_thai === "da_duyet")
      )
    },
    [isRegionalLeader, isTransferCoreRole, user]
  )

  const canDeleteTransfer = React.useCallback(
    (item: TransferListItem) => {
      if (!user || isRegionalLeader) return false
      const deptMatch = user.role === "qltb_khoa" && user.khoa_phong === item.khoa_phong_hien_tai
      const allowedRole = isTransferCoreRole || deptMatch
      return allowedRole && item.trang_thai === "cho_duyet"
    },
    [isRegionalLeader, isTransferCoreRole, user]
  )

  // Action handlers
  const approveTransfer = React.useCallback(
    async (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      try {
        await callRpc({
          fn: "transfer_request_update_status",
          args: {
            p_id: item.id,
            p_status: "da_duyet",
            p_payload: { nguoi_duyet_id: user?.id ? parseInt(user.id, 10) : undefined },
          },
        })
        toast({ title: "Thành công", description: "Đã duyệt yêu cầu luân chuyển." })
        await options.onSuccess()
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: error.message || "Có lỗi xảy ra khi duyệt yêu cầu.",
        })
      }
    },
    [isRegionalLeader, notifyRegionalLeaderRestricted, options, toast, user?.id]
  )

  const startTransfer = React.useCallback(
    async (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      try {
        await callRpc({
          fn: "transfer_request_update_status",
          args: {
            p_id: item.id,
            p_status: "dang_luan_chuyen",
            p_payload: { ngay_ban_giao: new Date().toISOString() },
          },
        })
        toast({ title: "Thành công", description: "Đã bắt đầu luân chuyển thiết bị." })
        await options.onSuccess()
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: error.message || "Có lỗi xảy ra khi bắt đầu luân chuyển.",
        })
      }
    },
    [isRegionalLeader, notifyRegionalLeaderRestricted, options, toast]
  )

  const handoverToExternal = React.useCallback(
    async (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      try {
        await callRpc({
          fn: "transfer_request_update_status",
          args: {
            p_id: item.id,
            p_status: "da_ban_giao",
            p_payload: { ngay_ban_giao: new Date().toISOString() },
          },
        })
        toast({ title: "Thành công", description: "Đã bàn giao thiết bị cho đơn vị bên ngoài." })
        await options.onSuccess()
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: error.message || "Có lỗi xảy ra khi bàn giao thiết bị.",
        })
      }
    },
    [isRegionalLeader, notifyRegionalLeaderRestricted, options, toast]
  )

  const returnFromExternal = React.useCallback(
    async (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      try {
        await callRpc({
          fn: "transfer_request_complete",
          args: { p_id: item.id, p_payload: { ngay_hoan_tra: new Date().toISOString() } },
        })
        toast({ title: "Thành công", description: "Đã xác nhận hoàn trả thiết bị từ đơn vị bên ngoài." })
        await options.onSuccess()
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: error.message || "Có lỗi xảy ra khi xác nhận hoàn trả.",
        })
      }
    },
    [isRegionalLeader, notifyRegionalLeaderRestricted, options, toast]
  )

  const completeTransfer = React.useCallback(
    async (item: TransferListItem) => {
      if (isRegionalLeader) {
        notifyRegionalLeaderRestricted()
        return
      }
      try {
        await callRpc({ fn: "transfer_request_complete", args: { p_id: item.id } })
        toast({
          title: "Thành công",
          description:
            item.loai_hinh === "thanh_ly"
              ? "Đã hoàn tất yêu cầu thanh lý thiết bị."
              : item.loai_hinh === "noi_bo"
                ? "Đã hoàn thành luân chuyển nội bộ thiết bị."
                : "Đã xác nhận hoàn trả thiết bị.",
        })
        await options.onSuccess()
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: error.message || "Có lỗi xảy ra khi hoàn thành luân chuyển.",
        })
      }
    },
    [isRegionalLeader, notifyRegionalLeaderRestricted, options, toast]
  )

  const confirmDelete = React.useCallback(
    async (item: TransferListItem) => {
      try {
        await callRpc({ fn: "transfer_request_delete", args: { p_id: item.id } })
        toast({ title: "Thành công", description: "Đã xóa yêu cầu luân chuyển." })
        await options.onSuccess()
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: error.message || "Có lỗi xảy ra khi xóa yêu cầu.",
        })
      }
    },
    [options, toast]
  )

  return {
    approveTransfer,
    startTransfer,
    handoverToExternal,
    returnFromExternal,
    completeTransfer,
    confirmDelete,
    canEditTransfer,
    canDeleteTransfer,
    mapToTransferRequest,
    isRegionalLeader,
    isTransferCoreRole,
  }
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors related to useTransferActions.ts

**Step 3: Commit**

```bash
git add src/hooks/useTransferActions.ts
git commit -m "refactor(transfers): extract useTransferActions hook"
```

---

## Task 2: Create `TransferRowActions` Component

**Files:**
- Create: `src/components/transfers/TransferRowActions.tsx`

**Step 1: Create the component file**

```typescript
// src/components/transfers/TransferRowActions.tsx
import * as React from "react"
import {
  Check,
  CheckCircle,
  Edit,
  FileText,
  Play,
  Send,
  Trash2,
  Undo2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { TransferListItem } from "@/types/transfers-data-grid"

interface TransferRowActionsProps {
  item: TransferListItem
  canEdit: boolean
  canDelete: boolean
  isTransferCoreRole: boolean
  userRole: string
  userKhoaPhong?: number
  onEdit: () => void
  onDelete: () => void
  onApprove: () => void
  onStart: () => void
  onHandover: () => void
  onReturn: () => void
  onComplete: () => void
  onGenerateHandoverSheet: () => void
}

export const TransferRowActions = React.memo(function TransferRowActions({
  item,
  canEdit,
  canDelete,
  isTransferCoreRole,
  userRole,
  userKhoaPhong,
  onEdit,
  onDelete,
  onApprove,
  onStart,
  onHandover,
  onReturn,
  onComplete,
  onGenerateHandoverSheet,
}: TransferRowActionsProps) {
  const actions: React.ReactNode[] = []

  if (canEdit) {
    actions.push(
      <Tooltip key={`edit-${item.id}`}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 sm:h-8 sm:w-8"
            onClick={(event) => {
              event.stopPropagation()
              onEdit()
            }}
          >
            <Edit className="h-5 w-5 sm:h-4 sm:w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Sửa</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  switch (item.trang_thai) {
    case "cho_duyet":
      if (isTransferCoreRole) {
        actions.push(
          <Tooltip key={`approve-${item.id}`}>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="h-10 w-10 sm:h-8 sm:w-8"
                onClick={(event) => {
                  event.stopPropagation()
                  onApprove()
                }}
              >
                <Check className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Duyệt</p>
            </TooltipContent>
          </Tooltip>
        )
      }
      break
    case "da_duyet":
      if (
        isTransferCoreRole ||
        (userRole === "qltb_khoa" && userKhoaPhong === item.khoa_phong_hien_tai)
      ) {
        actions.push(
          <Tooltip key={`start-${item.id}`}>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="h-10 w-10 sm:h-8 sm:w-8"
                variant="secondary"
                onClick={(event) => {
                  event.stopPropagation()
                  onStart()
                }}
              >
                <Play className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Bắt đầu</p>
            </TooltipContent>
          </Tooltip>
        )
      }
      break
    case "dang_luan_chuyen":
      if (
        isTransferCoreRole ||
        (userRole === "qltb_khoa" &&
          (userKhoaPhong === item.khoa_phong_hien_tai || userKhoaPhong === item.khoa_phong_nhan))
      ) {
        if (item.loai_hinh === "noi_bo") {
          actions.push(
            <Tooltip key={`handover-sheet-${item.id}`}>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 sm:h-8 sm:w-8"
                  onClick={(event) => {
                    event.stopPropagation()
                    onGenerateHandoverSheet()
                  }}
                >
                  <FileText className="h-5 w-5 sm:h-4 sm:w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Biên bản bàn giao</p>
              </TooltipContent>
            </Tooltip>
          )
          actions.push(
            <Tooltip key={`complete-${item.id}`}>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  className="h-10 w-10 sm:h-8 sm:w-8"
                  onClick={(event) => {
                    event.stopPropagation()
                    onComplete()
                  }}
                >
                  <CheckCircle className="h-5 w-5 sm:h-4 sm:w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Hoàn thành</p>
              </TooltipContent>
            </Tooltip>
          )
        } else {
          actions.push(
            <Tooltip key={`handover-${item.id}`}>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  className="h-10 w-10 sm:h-8 sm:w-8"
                  variant="secondary"
                  onClick={(event) => {
                    event.stopPropagation()
                    onHandover()
                  }}
                >
                  <Send className="h-5 w-5 sm:h-4 sm:w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Bàn giao</p>
              </TooltipContent>
            </Tooltip>
          )
        }
      }
      break
    case "da_ban_giao":
      if (isTransferCoreRole) {
        actions.push(
          <Tooltip key={`return-${item.id}`}>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="h-10 w-10 sm:h-8 sm:w-8"
                onClick={(event) => {
                  event.stopPropagation()
                  onReturn()
                }}
              >
                <Undo2 className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Hoàn trả</p>
            </TooltipContent>
          </Tooltip>
        )
      }
      break
    default:
      break
  }

  if (canDelete) {
    actions.push(
      <Tooltip key={`delete-${item.id}`}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-destructive hover:text-destructive sm:h-8 sm:w-8"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Xóa</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  if (actions.length === 0) return null

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 sm:gap-1">{actions}</div>
    </TooltipProvider>
  )
})
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors related to TransferRowActions.tsx

**Step 3: Commit**

```bash
git add src/components/transfers/TransferRowActions.tsx
git commit -m "refactor(transfers): extract TransferRowActions component"
```

---

## Task 3: Create `FacilityFilter` Component

**Files:**
- Create: `src/components/transfers/FacilityFilter.tsx`

**Step 1: Create the component file**

```typescript
// src/components/transfers/FacilityFilter.tsx
import * as React from "react"
import { Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

interface FacilityFilterProps {
  facilities: Array<{ id: number; name: string }>
  selectedId: number | null
  onSelect: (id: number | null) => void
  show: boolean
}

export function FacilityFilter({
  facilities,
  selectedId,
  onSelect,
  show,
}: FacilityFilterProps) {
  const [tempFacilityId, setTempFacilityId] = React.useState<number | null>(null)
  const [isSheetOpen, setIsSheetOpen] = React.useState(false)

  if (!show) return null

  const selectedFacilityName = selectedId
    ? facilities.find((f) => f.id === selectedId)?.name || "Tất cả cơ sở"
    : "Tất cả cơ sở"

  return (
    <>
      {/* Desktop: Select dropdown */}
      <div className="hidden sm:block">
        <Select
          value={selectedId?.toString() || "all"}
          onValueChange={(value) =>
            onSelect(value === "all" ? null : Number(value))
          }
        >
          <SelectTrigger className="w-[200px]">
            <Building2 className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Tất cả cơ sở" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả cơ sở</SelectItem>
            {facilities.map((facility) => (
              <SelectItem key={facility.id} value={facility.id.toString()}>
                {facility.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: Bottom sheet with larger button */}
      <div className="sm:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="h-11 w-full justify-start font-medium"
              onClick={() => {
                setTempFacilityId(selectedId)
                setIsSheetOpen(true)
              }}
            >
              <Building2 className="mr-2 h-5 w-5" />
              <span className="truncate">{selectedFacilityName}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh]">
            <SheetHeader>
              <SheetTitle>Chọn cơ sở</SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-1 flex-col">
              <div className="flex-1 space-y-2 overflow-y-auto pb-4">
                <Button
                  variant={tempFacilityId === null ? "default" : "outline"}
                  className="h-12 w-full justify-start text-base"
                  onClick={() => setTempFacilityId(null)}
                >
                  <Building2 className="mr-3 h-5 w-5" />
                  Tất cả cơ sở
                </Button>
                {facilities.map((facility) => (
                  <Button
                    key={facility.id}
                    variant={tempFacilityId === facility.id ? "default" : "outline"}
                    className="h-12 w-full justify-start text-base"
                    onClick={() => setTempFacilityId(facility.id)}
                  >
                    <Building2 className="mr-3 h-5 w-5" />
                    {facility.name}
                  </Button>
                ))}
              </div>
              <SheetFooter className="flex flex-row gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  className="h-12 flex-1 text-base font-medium"
                  onClick={() => {
                    setTempFacilityId(selectedId)
                    setIsSheetOpen(false)
                  }}
                >
                  Hủy
                </Button>
                <Button
                  className="h-12 flex-1 text-base font-medium"
                  onClick={() => {
                    onSelect(tempFacilityId)
                    setIsSheetOpen(false)
                  }}
                >
                  Áp dụng
                </Button>
              </SheetFooter>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors related to FacilityFilter.tsx

**Step 3: Commit**

```bash
git add src/components/transfers/FacilityFilter.tsx
git commit -m "refactor(transfers): extract FacilityFilter component"
```

---

## Task 4: Refactor `page.tsx` to Use Extracted Modules

**Files:**
- Modify: `src/app/(app)/transfers/page.tsx`

**Step 1: Update imports**

Replace existing lucide imports and add new component/hook imports:

```typescript
// Remove these icons (moved to TransferRowActions):
// Check, CheckCircle, Edit, FileText, Play, Send, Trash2, Undo2

// Keep these icons:
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
} from "lucide-react"

// Add new imports:
import { useTransferActions } from "@/hooks/useTransferActions"
import { TransferRowActions } from "@/components/transfers/TransferRowActions"
import { FacilityFilter } from "@/components/transfers/FacilityFilter"
```

**Step 2: Replace inline action logic with hook**

After the existing hooks (useTransferList, useTransferCounts), add:

```typescript
const {
  approveTransfer,
  startTransfer,
  handoverToExternal,
  returnFromExternal,
  completeTransfer,
  confirmDelete,
  canEditTransfer,
  canDeleteTransfer,
  mapToTransferRequest,
  isRegionalLeader,
  isTransferCoreRole,
} = useTransferActions({
  onSuccess: async () => {
    await Promise.all([refetchList(), refetchCounts()])
  },
})
```

**Step 3: Remove extracted functions**

Delete these functions from page.tsx (now in useTransferActions):
- `notifyRegionalLeaderRestricted`
- `mapToTransferRequest`
- `canEditTransfer`
- `canDeleteTransfer`
- `handleApproveTransfer`
- `handleStartTransfer`
- `handleHandoverToExternal`
- `handleReturnFromExternal`
- `handleCompleteTransfer`

And the inline role checks:
- `isRegionalLeader` declaration
- `isTransferCoreRole` declaration

**Step 4: Simplify `handleConfirmDelete`**

Replace the full implementation with:

```typescript
const handleConfirmDelete = React.useCallback(async () => {
  if (!deletingTransfer) return
  await confirmDelete(deletingTransfer)
  setDeleteDialogOpen(false)
  setDeletingTransfer(null)
}, [confirmDelete, deletingTransfer])
```

**Step 5: Replace `rowActions` with `TransferRowActions` component**

Replace the entire `rowActions` callback with:

```typescript
const renderRowActions = React.useCallback(
  (item: TransferListItem) => (
    <TransferRowActions
      item={item}
      canEdit={canEditTransfer(item)}
      canDelete={canDeleteTransfer(item)}
      isTransferCoreRole={isTransferCoreRole}
      userRole={user?.role || ""}
      userKhoaPhong={user?.khoa_phong}
      onEdit={() => handleEditTransfer(item)}
      onDelete={() => handleOpenDeleteDialog(item)}
      onApprove={() => approveTransfer(item)}
      onStart={() => startTransfer(item)}
      onHandover={() => handoverToExternal(item)}
      onReturn={() => returnFromExternal(item)}
      onComplete={() => completeTransfer(item)}
      onGenerateHandoverSheet={() => handleGenerateHandoverSheet(item)}
    />
  ),
  [
    approveTransfer,
    canDeleteTransfer,
    canEditTransfer,
    completeTransfer,
    handleEditTransfer,
    handleGenerateHandoverSheet,
    handleOpenDeleteDialog,
    handoverToExternal,
    isTransferCoreRole,
    returnFromExternal,
    startTransfer,
    user?.khoa_phong,
    user?.role,
  ]
)
```

Update columns to use `renderRowActions`:

```typescript
const columns = React.useMemo(
  () => getColumnsForType(activeTab, { renderActions: renderRowActions, referenceDate }),
  [activeTab, referenceDate, renderRowActions]
)
```

**Step 6: Replace inline FacilityFilter with component**

Replace the entire facility filter section (desktop Select + mobile Sheet) with:

```typescript
<FacilityFilter
  facilities={facilityOptionsData || []}
  selectedId={selectedFacilityId}
  onSelect={setSelectedFacilityId}
  show={showFacilityFilter}
/>
```

**Step 7: Remove unused imports**

Remove imports that are no longer needed:
- `Sheet`, `SheetClose`, `SheetContent`, `SheetFooter`, `SheetHeader`, `SheetTitle`, `SheetTrigger` (moved to FacilityFilter)
- `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger` (moved to TransferRowActions)
- Unused icon imports

**Step 8: Remove unused state**

Remove these state variables (moved to FacilityFilter):
- `tempFacilityId`
- `isFacilitySheetOpen`

And the wrapper callback (no longer needed):
- `setSelectedFacilityId` wrapper

**Step 9: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 10: Commit**

```bash
git add src/app/(app)/transfers/page.tsx
git commit -m "refactor(transfers): use extracted hook and components in page"
```

---

## Task 5: Final Verification

**Step 1: Run full typecheck**

Run: `npm run typecheck`
Expected: All files pass

**Step 2: Verify line counts**

Run: `wc -l src/app/\(app\)/transfers/page.tsx src/hooks/useTransferActions.ts src/components/transfers/TransferRowActions.tsx src/components/transfers/FacilityFilter.tsx`

Expected:
- page.tsx: ~400 lines
- useTransferActions.ts: ~200 lines
- TransferRowActions.tsx: ~180 lines
- FacilityFilter.tsx: ~80 lines

**Step 3: Manual smoke test**

1. Navigate to /transfers
2. Verify tabs switch correctly
3. Verify facility filter works (desktop + mobile)
4. Verify action buttons appear based on status
5. Verify approve/start/complete actions work
6. Verify edit/delete dialogs work

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "refactor(transfers): fix issues from refactoring verification"
```

---

## Summary

| Task | Description | Est. Lines Changed |
|------|-------------|-------------------|
| 1 | Create useTransferActions hook | +200 |
| 2 | Create TransferRowActions component | +180 |
| 3 | Create FacilityFilter component | +80 |
| 4 | Refactor page.tsx | -800 |
| 5 | Verification | 0 |

**Result:** page.tsx reduced from 1246 → ~400 lines
